#!/usr/bin/env bash
# ── review.sh ────────────────────────────────────────────────────────────────
# Claude CLI invocation and report file writing.
# Depends on: helpers.sh, prompt.sh

# run_review <target_dir> <project_name> <profile> <model> <max_turns> <output_dir> <dry_run>
# Generates two reports (FR + EN) by calling Claude CLI.
run_review() {
  local target_dir="$1"
  local project_name="$2"
  local profile="$3"
  local model="$4"
  local max_turns="$5"
  local output_dir="$6"
  local dry_run="$7"
  local today
  today=$(date +%Y-%m-%d)

  mkdir -p "$output_dir"

  local report_fr="${output_dir}/${project_name}-${today}-fr.md"
  local report_en="${output_dir}/${project_name}-${today}-en.md"

  if [[ "$dry_run" == "true" ]]; then
    _dry_run_output "$project_name" "$profile" "$model" "$today"
    return 0
  fi

  info "Starting audit of ${BOLD}${project_name}${RESET}${CYAN} (profile: ${profile}, model: ${model})"
  echo ""

  _run_single_report "$target_dir" "$project_name" "$profile" "$model" "$max_turns" "$today" "fr" "$report_fr"
  _run_single_report "$target_dir" "$project_name" "$profile" "$model" "$max_turns" "$today" "en" "$report_en"

  echo ""
  ok "Reports generated:"
  info "  FR: ${report_fr}"
  info "  EN: ${report_en}"
}

_run_single_report() {
  local target_dir="$1"
  local project_name="$2"
  local profile="$3"
  local model="$4"
  local max_turns="$5"
  local today="$6"
  local lang="$7"
  local output_file="$8"

  local lang_label="French"
  [[ "$lang" == "en" ]] && lang_label="English"

  info "Generating ${lang_label} report..."

  local system_prompt
  system_prompt=$(build_system_prompt "$profile" "$lang")

  local user_prompt
  user_prompt=$(build_user_prompt "$project_name" "$profile" "$lang" "$today" "$model")

  local result
  result=$(cd "$target_dir" && claude -p "$user_prompt" \
    --model "$model" \
    --system-prompt "$system_prompt" \
    --max-turns "$max_turns" \
    --allowedTools "Read,Glob,Grep" \
    --output-format text 2>&1)

  local exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    err "Claude CLI failed for ${lang_label} report (exit code: ${exit_code})"
    err "Output: ${result}"
    return 1
  fi

  echo "$result" > "$output_file"
  ok "${lang_label} report written to ${output_file}"
}

_dry_run_output() {
  local project_name="$1"
  local profile="$2"
  local model="$3"
  local today="$4"

  bold "=== DRY RUN ==="
  echo ""
  info "Project:    ${project_name}"
  info "Profile:    ${profile}"
  info "Model:      ${model}"
  info "Date:       ${today}"
  echo ""

  bold "--- System Prompt (EN) ---"
  echo ""
  build_system_prompt "$profile" "en"
  echo ""

  bold "--- User Prompt (EN) ---"
  echo ""
  build_user_prompt "$project_name" "$profile" "en" "$today" "$model"
  echo ""

  bold "--- System Prompt (FR) ---"
  echo ""
  build_system_prompt "$profile" "fr"
  echo ""

  bold "--- User Prompt (FR) ---"
  echo ""
  build_user_prompt "$project_name" "$profile" "fr" "$today" "$model"
}
