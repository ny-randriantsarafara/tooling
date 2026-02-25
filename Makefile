PREFIX    ?= $(HOME)/.local
BIN_DIR    = $(PREFIX)/bin
CONFIG_DIR = $(HOME)/.config/gen-env
SCRIPT     = gen-env/gen-env
EXAMPLE    = gen-env/config.example.json

.PHONY: install uninstall check-deps

install: check-deps
	@mkdir -p $(BIN_DIR) $(CONFIG_DIR)
	@cp $(SCRIPT) $(BIN_DIR)/gen-env && chmod +x $(BIN_DIR)/gen-env
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
	@echo "  gen-env removed."

check-deps:
	@command -v aws  >/dev/null || (echo "ERROR: aws CLI not found" && exit 1)
	@command -v jq   >/dev/null || (echo "ERROR: jq not found" && exit 1)
	@echo "  Dependencies OK (fzf: $$(command -v fzf >/dev/null && echo yes || echo 'no — fallback menus will be used'))"
