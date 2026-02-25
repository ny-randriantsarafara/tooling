# gen-env

Tired of maintaining a different `get-env.sh` in every repo? `gen-env` is a single command that pulls `.env` files from AWS (ECS, SSM, Secrets Manager) for any project, driven by one config file you keep on your machine.

---

## What you need before starting

- **AWS CLI** — `aws --version`
- **jq** — `jq --version`
- **fzf** (optional) — if installed, menus are fuzzy-searchable instead of numbered
- Your AWS credentials already set up (via `gimme-aws-creds`, AWS SSO, or static profiles)

---

## Install

```bash
cd ~/works/tooling
make install
```

This does three things:
1. Copies the script to `~/.local/bin/gen-env`
2. Creates `~/.config/gen-env/config.json` from the example template
3. Checks that `aws` and `jq` are available

Make sure `~/.local/bin` is in your `PATH`. If `gen-env` isn't found after install, add this to your `~/.zshrc` or `~/.bashrc`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

---

## Configure

Open `~/.config/gen-env/config.json`. This is your private config — it never goes into git.

The structure is: **companies → projects → environments → sources**.

### Minimal example

Say you work at one company with one project that lives in ECS:

```json
{
  "version": "1",
  "companies": [
    {
      "id": "myco",
      "name": "My Company",
      "auth": {
        "type": "gimme-aws-creds"
      },
      "profile_map": {
        "default": {
          "dev":     "myco-dev",
          "staging": "myco-stg"
        }
      },
      "projects": [
        {
          "id": "api",
          "name": "API",
          "path": "~/projects/myco/api",
          "profile_group": "default",
          "aws_region": "eu-west-1",
          "envs": {
            "dev": {
              "sources": [
                { "type": "ecs", "cluster": "my-cluster", "service": "my-service" }
              ],
              "output": ".env"
            },
            "staging": {
              "sources": [
                { "type": "ecs", "cluster": "my-cluster-stg", "service": "my-service" }
              ],
              "output": ".env"
            }
          }
        }
      ]
    }
  ]
}
```

### The key fields

**`profile_map`** — maps environment names to the AWS profile names in your `~/.aws/credentials`. Check what you have with:
```bash
grep '^\[' ~/.aws/credentials
```
If you see `[myco-dev]` and `[myco-stg]`, those are your profile names.

**`profile_group`** — which group of profiles a project uses. Useful if you have multiple AWS accounts at the same company (e.g. one for backend, one for data). If everything shares the same profiles, use one group called `"default"`.

**`path`** — the local path to your project. When you run `gen-env` from inside this directory, it auto-detects the project so you don't have to pick it from a menu.

**`sources`** — where to pull env vars from. Each source type:
- `ecs` — reads the environment variables from a running ECS service. Needs `cluster` and `service` names.
- `ssm` — reads from SSM Parameter Store. Needs `path` (e.g. `/myco/api/dev`).
- `secrets_manager` — reads a secret from Secrets Manager. Needs `secret_id`.

Multiple sources are merged in order — later ones override earlier ones if the same key appears.

**`template`** (optional) — path to a `.env.example` or `.env.dist` file relative to the project root. Any keys in the template that weren't fetched from AWS will be added to the output with their default values.

**`exclude`** (optional) — a list of env var keys to remove from the final output. Each entry is matched against the key name as a regex, so both exact names and patterns work:
- `"SECRET_KEY"` — removes only that key (exact match)
- `"^INTERNAL_.*"` — removes all keys starting with `INTERNAL_`
- `"_TOKEN$"` — removes all keys ending in `_TOKEN`

```json
"dev": {
  "sources": [...],
  "output": ".env",
  "exclude": ["SECRET_KEY", "^INTERNAL_.*", "_TOKEN$"]
}
```

**`overrides`** (optional) — a JSON object of key-value pairs to override or add to the final output. Useful for setting local-specific values (e.g., `localhost` instead of remote hosts):

```json
"dev": {
  "sources": [...],
  "output": ".env",
  "overrides": {
    "DATABASE_HOST": "localhost",
    "REDIS_HOST": "localhost"
  }
}
```

**Sorting** — the output `.env` is always sorted alphabetically by key name. This keeps generated files stable across runs and makes diffs readable.

### Auth types

| Your setup | Use this |
|---|---|
| Okta + `gimme-aws-creds` | `"type": "gimme-aws-creds"` |
| AWS SSO (`aws sso login`) | `"type": "aws-sso"` |
| Long-lived keys in `~/.aws/credentials` | `"type": "static-profile"` |

### Monorepos

If a project has multiple services (frontend, backend, worker), use `services` instead of `envs` at the project level. Each service then has its own `envs`. See `gen-env/config.example.json` for a full example.

---

## Use it

```bash
# From inside a project directory — auto-detects everything
cd ~/projects/myco/api
gen-env

# List all configured projects
gen-env --list

# Non-interactive (good for scripts)
gen-env --project api --env dev --dry-run

# Force credential refresh before fetching
gen-env --refresh-creds
```

The interactive flow:
1. Pick company (skipped if only one)
2. Pick project (skipped if auto-detected from current directory)
3. Pick service (monorepos only)
4. Pick environment
5. Credentials are checked — if expired, you're offered a refresh
6. Vars are fetched from AWS
7. Press `W` to write the `.env`, `P` to preview, `Q` to quit

---

## Uninstall

```bash
make uninstall
```

This removes the script from `~/.local/bin`. Your config at `~/.config/gen-env/config.json` is kept.
