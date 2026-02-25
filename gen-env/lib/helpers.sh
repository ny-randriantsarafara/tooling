#!/usr/bin/env bash
# ── helpers.sh ───────────────────────────────────────────────────────────────
# Small utility functions used everywhere.
# Depends on: colors.sh

# ── Logging ──────────────────────────────────────────────────────────────────
info()    { echo -e "  ${CYAN}${*}${RESET}"; }
ok()      { echo -e "  ${GREEN}✓${RESET} ${*}"; }
warn()    { echo -e "  ${YELLOW}⚠${RESET}  ${*}" >&2; }
err()     { echo -e "  ${RED}✗${RESET}  ${*}" >&2; }
die()     { err "${*}"; exit 1; }
bold()    { echo -e "${BOLD}${*}${RESET}"; }

# ── Path helpers ─────────────────────────────────────────────────────────────

# Expand leading ~ to $HOME
expand_path() {
  echo "${1/#\~/$HOME}"
}

# Count non-empty lines in a string
count_lines() {
  if [[ -z "$1" ]]; then echo 0; return; fi
  echo "$1" | grep -c '.' || echo 0
}
