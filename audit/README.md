# audit

A single command that runs a senior-level code review on any codebase using Claude CLI. It auto-detects what kind of project you're in, analyzes it along 5 axes with risk-based findings, and generates prioritized reports in French and English.

---

## What you need before starting

- **Claude CLI** — `claude --version` ([install guide](https://docs.anthropic.com/en/docs/claude-code))
- **jq** — `jq --version`

Make sure `~/.local/bin` is in your `PATH`. If `audit` isn't found after install, add this to your `~/.zshrc` or `~/.bashrc`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

---

## Install

```bash
cd ~/works/tooling
make install-audit
```

This does four things:
1. Copies the script to `~/.local/bin/audit`
2. Copies lib files to `~/.local/lib/audit/`
3. Adds the auto-trigger shell hook to your `~/.zshrc` (or `~/.bashrc`)
4. Creates `~/reports/` and `~/.config/audit/`

---

## Use it

### Run an audit manually

```bash
cd ~/projects/my-api
audit
```

That's it. The tool will:
1. Detect what the codebase is (backend, frontend, infra, fullstack)
2. Build a tailored review prompt
3. Call Claude CLI (Opus by default)
4. Write two reports: `~/reports/my-api-2026-03-01-fr.md` and `~/reports/my-api-2026-03-01-en.md`

### Override defaults

```bash
# Use a different model
audit --model sonnet

# Force a specific profile
audit --profile infra

# See the prompts without calling Claude
audit --dry-run

# Save reports somewhere else
audit --output-dir ./reports

# Limit agent turns (default: 10)
audit --max-turns 5
```

---

## Auto-trigger on cd

You can register **parent directories** (workspaces) so `audit` runs automatically when you `cd` into any of their immediate children — but only if no recent report exists.

No files are created inside your project folders. Everything is configured externally in `~/.config/audit/watchlist.json`.

### Watch a parent directory

```bash
# Watch ~/projects — audit triggers when you cd into ~/projects/my-api, ~/projects/infra, etc.
audit --watch ~/projects

# Watch with overrides
audit --watch ~/projects --stale-days 14

# Watch the current directory (its children will be auto-audited)
audit --watch
```

### Unwatch a directory

```bash
audit --unwatch ~/projects
audit --unwatch
```

### List watched directories

```bash
audit --list-watched
```

### How it works

When you `cd` into a folder, the shell hook checks if the **parent** of that folder is in the watchlist. If it is, it looks for the latest report in `~/reports/` matching that project name. If no report exists, or the latest report is older than `stale_days` (default: 7), it runs `audit` automatically. Otherwise it does nothing.

For example, if you `audit --watch ~/projects`:
- `cd ~/projects/my-api` — triggers audit (immediate child)
- `cd ~/projects/infra` — triggers audit (immediate child)
- `cd ~/projects/my-api/src` — does NOT trigger (not an immediate child)
- `cd ~/projects` — does NOT trigger (the watched dir itself, not a child)

### Watchlist file

The watchlist lives at `~/.config/audit/watchlist.json`. You can also edit it directly:

```json
{
  "version": "1",
  "watched": [
    {
      "path": "/Users/me/projects",
      "stale_days": 7
    },
    {
      "path": "/Users/me/work/client-a",
      "profile": "infra",
      "stale_days": 14
    }
  ]
}
```

| Field | Required | Default | Description |
|---|---|---|---|
| `path` | yes | — | Absolute path to the parent directory |
| `profile` | no | auto-detected | Force a review profile for all children: `infra`, `backend`, `frontend`, `fullstack` |
| `stale_days` | no | 7 | Days before a report is considered stale |

---

## Profiles and review axes

The tool auto-detects your codebase type by scanning for marker files.

### Detection rules

| Profile | Detected when |
|---|---|
| **infra** | `*.tf`, `*.tfvars`, `Pulumi.yaml`, `helm/`, `k8s/`, `kustomization.yaml` |
| **backend** | `package.json` with express/fastify/nestjs, `go.mod`, `Cargo.toml`, `requirements.txt` with flask/django/fastapi, `pom.xml`, `build.gradle` |
| **frontend** | `package.json` with react/vue/angular/svelte, `next.config.*`, `nuxt.config.*` |
| **fullstack** | Both backend and frontend markers found |
| **unknown** | Fallback — uses generic review axes |

### Review axes per profile

**infra**: Security (IAM, least privilege) · Reliability (RPO/RTO, HA) · Deployment (IaC, GitOps) · Observability (Golden Signals) · Cost optimization

**backend**: Security (auth, injection, secrets) · Reliability (error handling, retries) · Performance (N+1, caching) · Observability (logging, tracing) · Code quality (SOLID, DRY)

**frontend**: Security (XSS, CSP, secrets) · Performance (bundle size, rendering) · Accessibility (a11y) · UX patterns (error states, loading) · Code quality (components, state)

**fullstack**: Combined backend + frontend axes

---

## Report format

Each report follows this structure:

```
# Code Audit — my-api
> Date: 2026-03-01 | Profile: backend | Model: opus

## Method
I will analyze this codebase along 5 axes: ...

## 1. Security
### Finding 1.1: Hardcoded API keys in config
- **Observation**: ...
- **Risk**: ...
- **Proposal**: ...

## 2. Reliability
...

## Prioritization

### P0 — Critical (before production)
- [ ] Finding 1.1 — Hardcoded API keys

### P1 — Important
- [ ] Finding 3.2 — No caching layer

### P2 — Improvement
- [ ] Finding 5.1 — Missing JSDoc on public API
```

Reports are saved as `~/reports/<project>-<date>-fr.md` and `~/reports/<project>-<date>-en.md`.

---

## All flags

| Flag | Default | Description |
|---|---|---|
| `--model <model>` | `opus` | Claude model alias or full model ID |
| `--profile <profile>` | auto-detected | Force a review profile |
| `--dry-run` | — | Show prompts without calling Claude |
| `--output-dir <path>` | `~/reports` | Where to save reports |
| `--max-turns <n>` | `10` | Max Claude agent turns |
| `--watch [path]` | — | Watch a parent directory (default: current dir) |
| `--unwatch [path]` | — | Remove a parent directory from watchlist |
| `--list-watched` | — | Show all watched directories |
| `--stale-days <n>` | `7` | Staleness threshold (used with `--watch`) |
| `--help` | — | Show usage |

---

## Uninstall

```bash
make uninstall-audit
```

This removes the script, libs, and the shell hook from your rc file. Your reports in `~/reports/` and watchlist in `~/.config/audit/` are kept.

---

## Platform support

Works on macOS and Linux/WSL. Pure Bash, no OS-specific dependencies.

- macOS: hooks into `~/.zshrc` via `chpwd`
- WSL/Linux (bash): hooks into `~/.bashrc` via `PROMPT_COMMAND`
