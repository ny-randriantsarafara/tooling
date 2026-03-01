#!/usr/bin/env bash
# ── detect.sh ────────────────────────────────────────────────────────────────
# Codebase type detection. Scans the target directory for marker files and
# patterns to classify the codebase into a review profile.
# Depends on: helpers.sh

# detect_profile <directory>
# Prints one of: infra, backend, frontend, fullstack, unknown
detect_profile() {
  local dir="${1:-.}"
  local has_infra=false
  local has_backend=false
  local has_frontend=false

  has_infra=$(_detect_infra "$dir")
  has_backend=$(_detect_backend "$dir")
  has_frontend=$(_detect_frontend "$dir")

  if [[ "$has_backend" == "true" && "$has_frontend" == "true" ]]; then
    echo "fullstack"
  elif [[ "$has_infra" == "true" ]]; then
    echo "infra"
  elif [[ "$has_backend" == "true" ]]; then
    echo "backend"
  elif [[ "$has_frontend" == "true" ]]; then
    echo "frontend"
  else
    echo "unknown"
  fi
}

_detect_infra() {
  local dir="$1"

  # Terraform
  if compgen -G "${dir}"/*.tf >/dev/null 2>&1; then echo "true"; return; fi
  if compgen -G "${dir}"/*.tfvars >/dev/null 2>&1; then echo "true"; return; fi

  # Pulumi
  if [[ -f "${dir}/Pulumi.yaml" ]]; then echo "true"; return; fi

  # Kubernetes / Helm
  if [[ -d "${dir}/helm" || -d "${dir}/k8s" || -d "${dir}/kubernetes" ]]; then echo "true"; return; fi
  if [[ -f "${dir}/kustomization.yaml" || -f "${dir}/kustomization.yml" ]]; then echo "true"; return; fi

  # Docker Compose (standalone infra, not just a dev tool)
  if compgen -G "${dir}"/docker-compose*.yml >/dev/null 2>&1 || \
     compgen -G "${dir}"/docker-compose*.yaml >/dev/null 2>&1; then
    # Only count as infra if there are no app source files alongside it
    if ! _has_app_sources "$dir"; then
      echo "true"; return
    fi
  fi

  echo "false"
}

_detect_backend() {
  local dir="$1"

  # Node.js backend frameworks
  if [[ -f "${dir}/package.json" ]]; then
    if grep -qE '"(express|fastify|nestjs|@nestjs/core|hapi|koa)"' "${dir}/package.json" 2>/dev/null; then
      echo "true"; return
    fi
  fi

  # Go
  if [[ -f "${dir}/go.mod" ]]; then echo "true"; return; fi

  # Rust
  if [[ -f "${dir}/Cargo.toml" ]]; then echo "true"; return; fi

  # Python backend frameworks
  if [[ -f "${dir}/requirements.txt" ]]; then
    if grep -qiE '(flask|django|fastapi|starlette|sanic)' "${dir}/requirements.txt" 2>/dev/null; then
      echo "true"; return
    fi
  fi
  if [[ -f "${dir}/pyproject.toml" ]]; then
    if grep -qiE '(flask|django|fastapi|starlette|sanic)' "${dir}/pyproject.toml" 2>/dev/null; then
      echo "true"; return
    fi
  fi

  # Java / Kotlin
  if [[ -f "${dir}/pom.xml" || -f "${dir}/build.gradle" || -f "${dir}/build.gradle.kts" ]]; then
    echo "true"; return
  fi

  # Generic server indicators (src/ with no frontend markers)
  if [[ -d "${dir}/src" && -f "${dir}/package.json" ]]; then
    if ! grep -qE '"(react|vue|angular|svelte|@angular/core)"' "${dir}/package.json" 2>/dev/null; then
      if grep -qE '"(typescript|tsx|ts-node)"' "${dir}/package.json" 2>/dev/null; then
        echo "true"; return
      fi
    fi
  fi

  echo "false"
}

_detect_frontend() {
  local dir="$1"

  if [[ -f "${dir}/package.json" ]]; then
    if grep -qE '"(react|react-dom|vue|@angular/core|svelte|@sveltejs/kit)"' "${dir}/package.json" 2>/dev/null; then
      echo "true"; return
    fi
  fi

  # Next.js / Nuxt.js config files
  if compgen -G "${dir}"/next.config.* >/dev/null 2>&1; then echo "true"; return; fi
  if compgen -G "${dir}"/nuxt.config.* >/dev/null 2>&1; then echo "true"; return; fi

  echo "false"
}

_has_app_sources() {
  local dir="$1"
  [[ -f "${dir}/package.json" || -f "${dir}/go.mod" || -f "${dir}/Cargo.toml" || \
     -f "${dir}/requirements.txt" || -f "${dir}/pom.xml" || -f "${dir}/build.gradle" ]]
}
