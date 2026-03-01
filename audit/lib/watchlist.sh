#!/usr/bin/env bash
# ── watchlist.sh ─────────────────────────────────────────────────────────────
# Manages ~/.config/audit/watchlist.json — the external configuration for
# auto-triggering audits on cd.
#
# The watchlist stores parent directories (workspaces), not individual projects.
# When you cd into an immediate child of a watched path, the hook triggers.
# Example: watch ~/projects → audit runs when you cd into ~/projects/my-api.
#
# Depends on: helpers.sh

WATCHLIST_DIR="${HOME}/.config/audit"
WATCHLIST_FILE="${WATCHLIST_DIR}/watchlist.json"

_ensure_watchlist() {
  if [[ ! -f "$WATCHLIST_FILE" ]]; then
    mkdir -p "$WATCHLIST_DIR"
    echo '{"version":"1","watched":[]}' > "$WATCHLIST_FILE"
  fi
}

# watchlist_add <path> [profile] [stale_days]
# Registers a parent directory. Any immediate child folder will auto-trigger audit.
watchlist_add() {
  local watch_path="$1"
  local profile="${2:-}"
  local stale_days="${3:-}"

  _ensure_watchlist

  local abs_path
  abs_path=$(cd "$watch_path" 2>/dev/null && pwd) || die "Directory not found: ${watch_path}"

  local existing
  existing=$(jq -r --arg p "$abs_path" '.watched[] | select(.path == $p) | .path' "$WATCHLIST_FILE" 2>/dev/null)

  local new_entry
  new_entry=$(jq -n --arg p "$abs_path" '{path: $p}')

  if [[ -n "$profile" ]]; then
    new_entry=$(echo "$new_entry" | jq --arg pr "$profile" '. + {profile: $pr}')
  fi

  if [[ -n "$stale_days" ]]; then
    new_entry=$(echo "$new_entry" | jq --argjson sd "$stale_days" '. + {stale_days: $sd}')
  fi

  if [[ -n "$existing" ]]; then
    local tmp
    tmp=$(jq --arg p "$abs_path" --argjson entry "$new_entry" \
      '(.watched[] | select(.path == $p)) = $entry' "$WATCHLIST_FILE")
    echo "$tmp" > "$WATCHLIST_FILE"
    ok "Updated watch: ${abs_path}"
  else
    local tmp
    tmp=$(jq --argjson entry "$new_entry" '.watched += [$entry]' "$WATCHLIST_FILE")
    echo "$tmp" > "$WATCHLIST_FILE"
    ok "Added watch: ${abs_path}"
  fi

  _show_entry "$new_entry"
}

# watchlist_remove <path>
watchlist_remove() {
  local watch_path="$1"

  _ensure_watchlist

  local abs_path
  abs_path=$(cd "$watch_path" 2>/dev/null && pwd) || abs_path="$watch_path"

  local existing
  existing=$(jq -r --arg p "$abs_path" '.watched[] | select(.path == $p) | .path' "$WATCHLIST_FILE" 2>/dev/null)

  if [[ -z "$existing" ]]; then
    warn "Not watched: ${abs_path}"
    return 1
  fi

  local tmp
  tmp=$(jq --arg p "$abs_path" '.watched = [.watched[] | select(.path != $p)]' "$WATCHLIST_FILE")
  echo "$tmp" > "$WATCHLIST_FILE"
  ok "Removed watch: ${abs_path}"
}

# watchlist_list
# Prints all watched entries in a human-readable format.
watchlist_list() {
  _ensure_watchlist

  local count
  count=$(jq '.watched | length' "$WATCHLIST_FILE" 2>/dev/null)

  if [[ "$count" -eq 0 ]]; then
    info "No watched directories."
    return 0
  fi

  bold "Watched directories (${count}):"
  echo ""

  jq -r '.watched[] | "  \(.path)/  profile=\(.profile // "auto")  stale_days=\(.stale_days // 7)"' \
    "$WATCHLIST_FILE" 2>/dev/null

  echo ""
  info "Audit auto-triggers when you cd into any immediate child of these directories."
}

# watchlist_lookup <path>
# Prints the JSON entry for a watched path. Returns 1 if not found.
watchlist_lookup() {
  local watch_path="$1"

  [[ -f "$WATCHLIST_FILE" ]] || return 1

  local entry
  entry=$(jq -r --arg p "$watch_path" '.watched[] | select(.path == $p)' "$WATCHLIST_FILE" 2>/dev/null)

  if [[ -z "$entry" ]]; then
    return 1
  fi

  echo "$entry"
}

_show_entry() {
  local entry="$1"
  local profile stale_days
  profile=$(echo "$entry" | jq -r '.profile // "auto"')
  stale_days=$(echo "$entry" | jq -r '.stale_days // 7')
  info "  profile=${profile}  stale_days=${stale_days}"
  info "  Audit will auto-trigger when you cd into any immediate child of this directory."
}
