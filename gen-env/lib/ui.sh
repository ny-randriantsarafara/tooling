#!/usr/bin/env bash
# ── ui.sh ────────────────────────────────────────────────────────────────────
# Interactive menus and banner.
# Depends on: colors.sh, helpers.sh
#
# Uses fzf for fuzzy selection if available, otherwise falls back to
# numbered menus. All display output goes to stderr so these functions
# work safely inside $() command substitution.

HAS_FZF=false
command -v fzf >/dev/null 2>&1 && HAS_FZF=true

# ── Banner ───────────────────────────────────────────────────────────────────

print_banner() {
  echo
  echo -e "${BOLD}╔══════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}║  gen-env  v${VERSION}$(printf '%*s' $((24 - ${#VERSION})) '')║${RESET}"
  echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}"
  echo
  echo -e "  ${DIM}Config: ${CONFIG_FILE}${RESET}"
  echo
}

# ── select_from_list ─────────────────────────────────────────────────────────
# Usage: selected=$(select_from_list "Prompt" "item1" "item2" "item3")
#
# If there's only 1 item, it's returned automatically (no menu shown).
# The selected item name is printed to stdout.

select_from_list() {
  local prompt="$1"; shift
  local items=("$@")
  local count=${#items[@]}

  if [[ $count -eq 0 ]]; then
    die "No items to select from"
  fi

  # Only one option — just return it, no menu needed
  if [[ $count -eq 1 ]]; then
    echo "${items[0]}"
    return 0
  fi

  if $HAS_FZF; then
    local selected
    selected=$(printf '%s\n' "${items[@]}" | fzf --prompt="  $prompt > " --height=~10 --border=none --no-info --ansi 2>/dev/tty)
    echo "$selected"
  else
    # Print the menu to stderr (NOT stdout) so $() doesn't capture it
    echo -e "\n  ${prompt}:" >&2
    local i=1
    for item in "${items[@]}"; do
      echo -e "    ${DIM}[${i}]${RESET} ${item}" >&2
      (( i++ )) || true
    done

    # Loop until we get a valid number
    local choice
    while true; do
      echo -ne "\n  Select [1-${count}]: " >&2
      read -r choice </dev/tty
      [[ -z "$choice" ]] && choice=1
      if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= count )); then
        echo "${items[$((choice - 1))]}"
        return 0
      fi
      warn "Invalid selection — enter a number between 1 and ${count}"
    done
  fi
}

# ── select_with_all ──────────────────────────────────────────────────────────
# Same as select_from_list but adds an "[A] All services" option.
# Returns "ALL" if the user picks that, otherwise the selected item name.

select_with_all() {
  local prompt="$1"; shift
  local items=("$@")
  local count=${#items[@]}

  if $HAS_FZF; then
    local all_items=("${items[@]}" "All services")
    local selected
    selected=$(printf '%s\n' "${all_items[@]}" | fzf --prompt="  $prompt > " --height=~12 --border=none --no-info --ansi 2>/dev/tty)
    if [[ "$selected" == "All services" ]]; then
      echo "ALL"
    else
      echo "$selected"
    fi
  else
    echo -e "\n  ${prompt}:" >&2
    local i=1
    for item in "${items[@]}"; do
      echo -e "    ${DIM}[${i}]${RESET} ${item}" >&2
      (( i++ )) || true
    done
    echo -e "    ${DIM}[A]${RESET} All services" >&2

    local choice
    while true; do
      echo -ne "\n  Select [1-${count}/A]: " >&2
      read -r choice </dev/tty
      [[ -z "$choice" ]] && choice=1
      if [[ "${choice,,}" == "a" ]]; then
        echo "ALL"
        return 0
      elif [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= count )); then
        echo "${items[$((choice - 1))]}"
        return 0
      fi
      warn "Invalid selection — enter a number between 1 and ${count}, or A for all"
    done
  fi
}
