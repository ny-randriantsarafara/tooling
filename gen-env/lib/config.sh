#!/usr/bin/env bash
# ── config.sh ────────────────────────────────────────────────────────────────
# Loads and queries the JSON config file.
# Depends on: helpers.sh
#
# After calling load_config, the full JSON is stored in the global $CONFIG
# variable. Use cfg "jq expression" to query it.

# Global that holds the entire parsed config
CONFIG=""

# Load and validate the config file
load_config() {
  [[ -f "$CONFIG_FILE" ]] || die "Config not found: $CONFIG_FILE\n  Run: make install"
  jq -e . "$CONFIG_FILE" >/dev/null 2>&1 || die "Config is not valid JSON: $CONFIG_FILE"
  CONFIG=$(jq '.' "$CONFIG_FILE")
}

# Shortcut: run a jq expression against $CONFIG and return raw output
cfg() {
  echo "$CONFIG" | jq -r "${1}"
}
