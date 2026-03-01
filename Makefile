PREFIX     ?= $(HOME)/.local
BIN_DIR     = $(PREFIX)/bin
LIB_DIR     = $(PREFIX)/lib/gen-env
CONFIG_DIR  = $(HOME)/.config/gen-env
SCRIPT      = gen-env/gen-env
LIB_FILES   = gen-env/lib/colors.sh gen-env/lib/helpers.sh gen-env/lib/config.sh gen-env/lib/ui.sh gen-env/lib/auth.sh gen-env/lib/sources.sh
EXAMPLE     = gen-env/config.example.json

.PHONY: install uninstall check-deps

install: check-deps
	@mkdir -p $(BIN_DIR) $(LIB_DIR) $(CONFIG_DIR)
	@cp $(SCRIPT) $(BIN_DIR)/gen-env && chmod +x $(BIN_DIR)/gen-env
	@cp $(LIB_FILES) $(LIB_DIR)/
	@ln -sfn $(LIB_DIR) $(BIN_DIR)/lib
	@if [ ! -f $(CONFIG_DIR)/config.json ]; then \
		cp $(EXAMPLE) $(CONFIG_DIR)/config.json; \
		echo "  Config created at $(CONFIG_DIR)/config.json"; \
		echo "  Edit it to add your companies and projects."; \
	else \
		echo "  Config already exists — not overwriting."; \
	fi
	@echo "  gen-env installed at $(BIN_DIR)/gen-env"

uninstall:
	@rm -f $(BIN_DIR)/gen-env
	@rm -f $(BIN_DIR)/lib
	@rm -rf $(LIB_DIR)
	@echo "  gen-env removed."

check-deps:
	@command -v aws  >/dev/null || (echo "ERROR: aws CLI not found" && exit 1)
	@command -v jq   >/dev/null || (echo "ERROR: jq not found" && exit 1)
	@echo "  Dependencies OK (fzf: $$(command -v fzf >/dev/null && echo yes || echo 'no — fallback menus will be used'))"

# ── audit ─────────────────────────────────────────────────────────────────────

AUDIT_SCRIPT     = audit/audit
AUDIT_LIB_DIR    = $(PREFIX)/lib/audit
AUDIT_LIB_FILES  = audit/lib/colors.sh audit/lib/helpers.sh audit/lib/detect.sh audit/lib/prompt.sh audit/lib/review.sh audit/lib/watchlist.sh audit/lib/hook.sh
AUDIT_HOOK_START = \# --- audit-hook-start ---
AUDIT_HOOK_END   = \# --- audit-hook-end ---

.PHONY: install-audit uninstall-audit check-audit-deps

install-audit: check-audit-deps
	@mkdir -p $(BIN_DIR) $(AUDIT_LIB_DIR) $(HOME)/reports $(HOME)/.config/audit
	@cp $(AUDIT_SCRIPT) $(BIN_DIR)/audit && chmod +x $(BIN_DIR)/audit
	@cp $(AUDIT_LIB_FILES) $(AUDIT_LIB_DIR)/
	@ln -sfn $(AUDIT_LIB_DIR) $(BIN_DIR)/audit-lib
	@echo "  audit installed at $(BIN_DIR)/audit"
	@# Install shell hook
	@if [ -n "$$ZSH_VERSION" ] || grep -q 'zsh' "$$SHELL" 2>/dev/null; then \
		RCFILE="$(HOME)/.zshrc"; \
		HOOK_BODY='source "$(AUDIT_LIB_DIR)/hook.sh"\nautoload -Uz add-zsh-hook\nadd-zsh-hook chpwd _audit_chpwd_hook'; \
	else \
		RCFILE="$(HOME)/.bashrc"; \
		HOOK_BODY='source "$(AUDIT_LIB_DIR)/hook.sh"\nPROMPT_COMMAND="_audit_chpwd_hook;$${PROMPT_COMMAND}"'; \
	fi; \
	if ! grep -q 'audit-hook-start' "$$RCFILE" 2>/dev/null; then \
		printf '\n$(AUDIT_HOOK_START)\n'"$$HOOK_BODY"'\n$(AUDIT_HOOK_END)\n' >> "$$RCFILE"; \
		echo "  Shell hook added to $$RCFILE"; \
		echo "  Run: source $$RCFILE (or open a new terminal)"; \
	else \
		echo "  Shell hook already present in $$RCFILE"; \
	fi

uninstall-audit:
	@rm -f $(BIN_DIR)/audit
	@rm -f $(BIN_DIR)/audit-lib
	@rm -rf $(AUDIT_LIB_DIR)
	@# Remove shell hook from rc files
	@for RCFILE in "$(HOME)/.zshrc" "$(HOME)/.bashrc"; do \
		if [ -f "$$RCFILE" ] && grep -q 'audit-hook-start' "$$RCFILE" 2>/dev/null; then \
			sed '/$(AUDIT_HOOK_START)/,/$(AUDIT_HOOK_END)/d' "$$RCFILE" > "$$RCFILE.tmp" && \
			mv "$$RCFILE.tmp" "$$RCFILE"; \
			echo "  Shell hook removed from $$RCFILE"; \
		fi; \
	done
	@echo "  audit removed (reports in ~/reports kept)."

check-audit-deps:
	@command -v claude >/dev/null || (echo "ERROR: claude CLI not found. Install: https://docs.anthropic.com/en/docs/claude-code" && exit 1)
	@command -v jq    >/dev/null || (echo "ERROR: jq not found" && exit 1)
	@echo "  Dependencies OK"

# ── API Regression Validator ─────────────────────────────────────────────────

.PHONY: api-regression-validator

api-regression-validator:
	@echo "Installing api-regression-validator dependencies..."
	@cd api-regression-validator && npm install
	@cd api-regression-validator/web && npm install
	@echo "  api-regression-validator ready. Run: cd api-regression-validator && npm run dev"
