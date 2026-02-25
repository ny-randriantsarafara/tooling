#!/usr/bin/env bash
# ── sources.sh ───────────────────────────────────────────────────────────────
# AWS source handlers — fetch env vars from ECS, SSM, Secrets Manager.
# Depends on: helpers.sh
#
# Each handler prints KEY="VALUE" lines to stdout.
#
# HOW TO ADD A NEW SOURCE TYPE:
#   1. Add a handle_source_<type>() function that prints KEY="VALUE" lines.
#   2. Add a case entry in fetch_sources().
#   That's it.

# Common AWS CLI flags to prevent hangs
AWS_OPTS=(--no-cli-pager --cli-read-timeout 30 --cli-connect-timeout 10)

# ── ECS ──────────────────────────────────────────────────────────────────────
# Reads environment variables from a running ECS service's task definition.

handle_source_ecs() {
  local cluster="$1" service="$2" profile="$3" region="$4"

  # Step 1: get the task definition ARN from the service
  local task_def
  task_def=$(AWS_PAGER="" aws ecs describe-services \
    "${AWS_OPTS[@]}" \
    --cluster "$cluster" --services "$service" \
    --profile "$profile" --region "$region" \
    --query "services[0].taskDefinition" --output text) \
    || die "ECS describe-services failed for $cluster/$service"

  [[ "$task_def" == "None" || -z "$task_def" ]] && \
    die "Service '$service' not found in cluster '$cluster'"

  # Step 2: get the env vars from the task definition's containers
  AWS_PAGER="" aws ecs describe-task-definition \
    "${AWS_OPTS[@]}" \
    --task-definition "$task_def" \
    --profile "$profile" --region "$region" \
    --query "taskDefinition.containerDefinitions[].environment[]" \
    --output json \
    | jq -r '.[] | "\(.name)=\"\(.value)\""'
}

# ── SSM Parameter Store ─────────────────────────────────────────────────────
# Reads all parameters under a path. The parameter name (last segment) becomes
# the env var key.

handle_source_ssm() {
  local path="$1" profile="$2" region="$3"

  AWS_PAGER="" aws ssm get-parameters-by-path \
    "${AWS_OPTS[@]}" \
    --path "$path" --recursive --with-decryption \
    --profile "$profile" --region "$region" \
    --output json \
    | jq -r '.Parameters[] | ((.Name | split("/") | last) + "=\"" + .Value + "\"")'
}

# ── Secrets Manager ──────────────────────────────────────────────────────────
# Reads a secret. If the secret is a JSON object, each key becomes an env var.
# If it's a plain string, it's stored as SECRET="value".

handle_source_secrets_manager() {
  local secret_id="$1" profile="$2" region="$3"

  local value
  value=$(AWS_PAGER="" aws secretsmanager get-secret-value \
    "${AWS_OPTS[@]}" \
    --secret-id "$secret_id" \
    --profile "$profile" --region "$region" \
    --output json | jq -r '.SecretString')

  if echo "$value" | jq -e 'type == "object"' >/dev/null 2>&1; then
    echo "$value" | jq -r 'to_entries[] | "\(.key)=\"\(.value)\""'
  else
    echo "SECRET=\"$value\""
  fi
}

# ── Fetch + merge ────────────────────────────────────────────────────────────
# Takes a JSON array of source objects, fetches each one, and merges the
# results. Later sources override earlier ones if the same key appears.

fetch_sources() {
  local sources_json="$1" profile="$2" region="$3"
  local combined=""

  while IFS= read -r source; do
    local type
    type=$(echo "$source" | jq -r '.type')

    local output=""
    case "$type" in
      ecs)
        output=$(handle_source_ecs \
          "$(echo "$source" | jq -r '.cluster')" \
          "$(echo "$source" | jq -r '.service')" \
          "$profile" "$region")
        ;;
      ssm)
        output=$(handle_source_ssm \
          "$(echo "$source" | jq -r '.path')" \
          "$profile" "$region")
        ;;
      secrets_manager)
        output=$(handle_source_secrets_manager \
          "$(echo "$source" | jq -r '.secret_id')" \
          "$profile" "$region")
        ;;
      *)
        warn "Unknown source type: $type — skipping"
        continue
        ;;
    esac

    combined=$(merge_env_lines "$combined" "$output")
  done < <(echo "$sources_json" | jq -c '.[]')

  echo "$combined"
}

# ── merge_env_lines ──────────────────────────────────────────────────────────
# Merges two blocks of KEY="VALUE" lines. If the same key appears in both,
# the second block (override) wins. Insertion order is preserved.

merge_env_lines() {
  local base="$1" override="$2"
  if [[ -z "$base" ]]; then echo "$override"; return; fi
  if [[ -z "$override" ]]; then echo "$base"; return; fi

  local -A kv
  local order=()
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local key="${line%%=*}"
    if [[ -z "${kv[$key]+_}" ]]; then
      order+=("$key")
    fi
    kv["$key"]="${line#*=}"
  done < <(printf '%s\n' "$base" "$override")

  for k in "${order[@]}"; do
    echo "${k}=${kv[$k]}"
  done
}

# ── merge_with_template ─────────────────────────────────────────────────────
# Takes fetched KEY="VALUE" lines and a template file (.env.example).
# Any keys in the template that weren't fetched get added with their
# default values from the template.

merge_with_template() {
  local fetched="$1" template_path="$2"
  [[ -z "$template_path" || ! -f "$template_path" ]] && { echo "$fetched"; return; }

  local -A kv
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    local key="${line%%=*}"
    [[ -z "${kv[$key]+_}" ]] && kv["$key"]="${line#*=}"
  done < <(printf '%s\n' "$fetched")

  local result="$fetched"
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    local key="${line%%=*}"
    if [[ -z "${kv[$key]+_}" ]]; then
      result=$(printf '%s\n%s' "$result" "$line")
      kv["$key"]="${line#*=}"
    fi
  done < "$template_path"

  echo "$result"
}

# ── filter_env_lines ─────────────────────────────────────────────────────────
# Removes lines whose key matches any entry in exclude_json (a JSON array).
# Entries without anchors (^ or $) are auto-wrapped as exact-name matches.
# Entries with anchors are used as-is (full regex).
#
# Usage: filtered=$(filter_env_lines "$lines" "$exclude_json")

filter_env_lines() {
  local lines="$1" exclude_json="$2"

  if [[ -z "$lines" || -z "$exclude_json" || "$exclude_json" == "[]" || "$exclude_json" == "null" ]]; then
    echo "$lines"
    return
  fi

  local patterns=()
  while IFS= read -r pattern; do
    patterns+=("$pattern")
  done < <(echo "$exclude_json" | jq -r '.[]')

  (( ${#patterns[@]} == 0 )) && { echo "$lines"; return; }

  local result=""
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local key="${line%%=*}"
    local excluded=false

    for pattern in "${patterns[@]}"; do
      local regex="$pattern"
      # Auto-wrap as exact match when the pattern has no anchors at all
      if [[ "$pattern" != *'^'* && "$pattern" != *'$'* ]]; then
        regex="^${pattern}$"
      fi
      if [[ "$key" =~ $regex ]]; then
        excluded=true
        break
      fi
    done

    $excluded || result=$(printf '%s\n%s' "$result" "$line")
  done < <(printf '%s\n' "$lines")

  echo "${result#$'\n'}"
}

# ── sort_env_lines ───────────────────────────────────────────────────────────
# Sorts KEY="VALUE" lines alphabetically by key name (case-sensitive, LC_ALL=C).
# Empty lines are dropped.
#
# Usage: sorted=$(sort_env_lines "$lines")

sort_env_lines() {
  local lines="$1"
  [[ -z "$lines" ]] && return
  printf '%s\n' "$lines" | grep -v '^$' | LC_ALL=C sort
}

# ── override_env_lines ───────────────────────────────────────────────────────
# Applies overrides from a JSON object to the env lines.
# Keys in the override object replace existing values or add new ones.
#
# Usage: overridden=$(override_env_lines "$lines" "$overrides_json")

override_env_lines() {
  local lines="$1" overrides_json="$2"

  if [[ -z "$overrides_json" || "$overrides_json" == "{}" || "$overrides_json" == "null" ]]; then
    echo "$lines"
    return
  fi

  local -A kv
  local order=()

  # Parse existing lines
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local key="${line%%=*}"
    if [[ -z "${kv[$key]+_}" ]]; then
      order+=("$key")
    fi
    kv["$key"]="${line#*=}"
  done < <(printf '%s\n' "$lines")

  # Apply overrides
  while IFS= read -r key; do
    local value
    value=$(echo "$overrides_json" | jq -r --arg k "$key" '.[$k]')
    if [[ -z "${kv[$key]+_}" ]]; then
      order+=("$key")
    fi
    kv["$key"]="\"$value\""
  done < <(echo "$overrides_json" | jq -r 'keys[]')

  # Reconstruct lines
  for k in "${order[@]}"; do
    echo "${k}=${kv[$k]}"
  done
}
