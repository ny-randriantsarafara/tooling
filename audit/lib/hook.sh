#!/usr/bin/env bash
# ── hook.sh ──────────────────────────────────────────────────────────────────
# Shell hook function for auto-triggering audits on cd.
# Reads ~/.config/audit/watchlist.json for watched parent directories.
# Triggers audit when entering an immediate child of a watched path,
# if the report is missing or stale.
#
# For zsh:  registered via add-zsh-hook chpwd _audit_chpwd_hook
# For bash: appended to PROMPT_COMMAND

_audit_chpwd_hook() {
  local config="$HOME/.config/audit/watchlist.json"
  [[ -f "$config" ]] || return

  command -v jq >/dev/null 2>&1 || return
  command -v audit >/dev/null 2>&1 || return

  local parent_dir="${PWD%/*}"
  local entry
  entry=$(jq -r --arg p "$parent_dir" '.watched[] | select(.path == $p)' "$config" 2>/dev/null)
  [[ -n "$entry" ]] || return

  local project_name="${PWD##*/}"
  local stale_days
  stale_days=$(echo "$entry" | jq -r '.stale_days // 7')
  local report_dir="$HOME/reports"
  local latest
  latest=$(ls -t "${report_dir}/${project_name}"-*-en.md 2>/dev/null | head -1)

  if [[ -z "$latest" ]]; then
    echo "[audit] No report found for ${project_name}. Running audit..."
    audit
  elif [[ $(find "$latest" -mtime +"${stale_days}" 2>/dev/null) ]]; then
    echo "[audit] Report older than ${stale_days} days. Re-running audit..."
    audit
  fi
}
