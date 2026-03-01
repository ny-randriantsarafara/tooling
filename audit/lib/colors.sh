#!/usr/bin/env bash
# ── colors.sh ────────────────────────────────────────────────────────────────
# ANSI color codes. Disabled automatically when stdout is not a terminal
# (e.g. when piping output to a file).

if [[ -t 1 ]]; then
  BOLD='\033[1m'
  DIM='\033[2m'
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  CYAN='\033[0;36m'
  RESET='\033[0m'
else
  BOLD='' DIM='' RED='' GREEN='' YELLOW='' CYAN='' RESET=''
fi
