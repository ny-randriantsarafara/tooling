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

# API Regression Validator
.PHONY: api-regression-validator

api-regression-validator:
	@echo "Installing api-regression-validator dependencies..."
	@cd api-regression-validator && npm install
	@cd api-regression-validator/web && npm install
	@echo "  api-regression-validator ready. Run: cd api-regression-validator && npm run dev"
