#!/usr/bin/env bash
# ── auth.sh ──────────────────────────────────────────────────────────────────
# AWS credential checking and refreshing.
# Depends on: colors.sh, helpers.sh
#
# HOW TO ADD A NEW AUTH TYPE:
#   1. Add a check_auth_<type>() function that prints one of:
#      "valid:<details>"  |  "expired"  |  "unknown"  |  "static"
#   2. Add a refresh_auth_<type>() function that runs the refresh command.
#   That's it. The dispatch functions below pick them up automatically.

# ── gimme-aws-creds (Okta SAML) ─────────────────────────────────────────────

check_auth_gimme_aws_creds() {
  local profile="$1"
  local creds_file="$HOME/.aws/credentials"
  [[ -f "$creds_file" ]] || { echo "no_file"; return; }

  # Parse the expiry timestamp from the credentials file
  local expires
  expires=$(awk -v p="[$profile]" '
    $0 == p { found=1; next }
    found && /^\[/ { found=0 }
    found && /x_security_token_expires/ { print $3; exit }
  ' "$creds_file")

  if [[ -z "$expires" ]]; then
    echo "unknown"
    return
  fi

  # Compare expiry to current time
  local exp_epoch now_epoch
  exp_epoch=$(date -d "$expires" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${expires%%+*}" +%s 2>/dev/null || echo 0)
  now_epoch=$(date +%s)

  if (( exp_epoch > now_epoch )); then
    local remaining=$(( exp_epoch - now_epoch ))
    local h=$(( remaining / 3600 ))
    local m=$(( (remaining % 3600) / 60 ))
    echo "valid:${h}h ${m}m"
  else
    echo "expired"
  fi
}

refresh_auth_gimme_aws_creds() {
  local profile="$1"
  echo -e "\n  Refreshing credentials via gimme-aws-creds..."
  gimme-aws-creds --profile "$profile"
}

# ── AWS SSO ──────────────────────────────────────────────────────────────────

check_auth_aws_sso() {
  local profile="$1"
  local result
  result=$(AWS_PAGER="" aws sts get-caller-identity \
    --no-cli-pager --cli-read-timeout 5 --cli-connect-timeout 5 \
    --profile "$profile" --output text 2>&1)

  if echo "$result" | grep -q "SSO token has expired\|Error loading SSO Token\|No SSO Token"; then
    echo "expired"
  elif echo "$result" | grep -q "^[0-9]"; then
    echo "valid:SSO"
  else
    echo "unknown"
  fi
}

refresh_auth_aws_sso() {
  local profile="$1"
  echo -e "\n  Refreshing SSO session..."
  aws sso login --profile "$profile"
}

# ── Static profile (long-lived keys, no refresh needed) ─────────────────────

check_auth_static_profile() { echo "static"; }
refresh_auth_static_profile() { warn "Static profile — no refresh available."; }

# ── Dispatch ─────────────────────────────────────────────────────────────────
# These two functions look up the right handler by auth type name.
# You never need to touch these when adding a new auth type.

check_credentials() {
  local auth_type="$1" profile="$2"
  local fn="check_auth_${auth_type//-/_}"
  if declare -f "$fn" >/dev/null; then
    "$fn" "$profile"
  else
    echo "unknown"
  fi
}

offer_refresh() {
  local auth_type="$1" profile="$2"
  echo -ne "  ${YELLOW}Credentials expired.${RESET} Refresh now? [Y/n]: "
  local ans
  read -r ans
  if [[ "${ans,,}" != "n" ]]; then
    local fn="refresh_auth_${auth_type//-/_}"
    if declare -f "$fn" >/dev/null; then
      "$fn" "$profile"
    else
      warn "No refresh handler for auth type: $auth_type"
    fi
  fi
}
