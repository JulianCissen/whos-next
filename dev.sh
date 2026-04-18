#!/usr/bin/env bash
# dev.sh — Who's Next development environment manager
#
# First-time setup:
#   chmod +x dev.sh
#   ./dev.sh fresh          # builds images, starts stack
#
# Run `./dev.sh help` for all commands.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─────────────────────────────────────────────────────────────────────────────
# Colour helpers
# ─────────────────────────────────────────────────────────────────────────────
# Disable colours when not writing to a terminal
if [[ -t 1 ]]; then
  _BLUE='\033[0;34m' _GREEN='\033[0;32m' _YELLOW='\033[0;33m' _RED='\033[0;31m' _RESET='\033[0m'
else
  _BLUE='' _GREEN='' _YELLOW='' _RED='' _RESET=''
fi

info()    { printf "${_BLUE}[info]${_RESET}  %s\n" "$*"; }
success() { printf "${_GREEN}[ok]${_RESET}    %s\n" "$*"; }
warn()    { printf "${_YELLOW}[warn]${_RESET}  %s\n" "$*"; }
error()   { printf "${_RED}[error]${_RESET} %s\n" "$*" >&2; }
die()     { error "$*"; exit 1; }

require() { command -v "$1" &>/dev/null || die "Required tool not found: '$1'. Is it installed and on PATH?"; }

# ─────────────────────────────────────────────────────────────────────────────
# Pre-flight: verify Docker is available and running
# ─────────────────────────────────────────────────────────────────────────────
require docker
docker info &>/dev/null || die "Docker daemon is not running. Start Docker Desktop and try again."

# ─────────────────────────────────────────────────────────────────────────────
# Load .env (creates it from .env.example on first run)
# ─────────────────────────────────────────────────────────────────────────────
cd "$SCRIPT_DIR"

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    info "Created .env from .env.example — review it before customising."
  fi
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source "./.env"
  set +a
fi

# ─────────────────────────────────────────────────────────────────────────────
# build — rebuild all images in parallel via docker buildx bake
# ─────────────────────────────────────────────────────────────────────────────
cmd_build() {
  info "Building images with docker buildx bake (parallel)..."
  # --load makes images available in the local Docker daemon after build.
  # Pass extra args through (e.g. --no-cache, --progress=plain, or a single target).
  docker buildx bake --load "$@"
  success "Images built: whos-next-backend:dev, whos-next-frontend:dev, whos-next-e2e:dev"
}

# ─────────────────────────────────────────────────────────────────────────────
# up — start the full development stack
# ─────────────────────────────────────────────────────────────────────────────
cmd_up() {
  # If the main images don't exist yet, build them first so the user gets a
  # helpful error (bake output) rather than a compose "image not found" failure.
  if ! docker image inspect whos-next-backend:dev &>/dev/null; then
    warn "Images not found — running initial build first."
    cmd_build
  fi

  info "Starting the development stack..."
  # --no-build: always use the bake-built images; never let compose build.
  docker compose up --no-build "$@"
}

# ─────────────────────────────────────────────────────────────────────────────
# down — stop and remove containers (volumes preserved by default)
# ─────────────────────────────────────────────────────────────────────────────
cmd_down() {
  info "Stopping the development stack..."
  docker compose down "$@"
  success "Stack stopped."
}

# ─────────────────────────────────────────────────────────────────────────────
# fresh — full reset: remove containers + ALL volumes, rebuild, restart
#
# Use this whenever you add or remove packages from any package.json.
# The named volumes that protect node_modules are removed, so the next
# docker compose up re-initialises them from the freshly-built image.
# ─────────────────────────────────────────────────────────────────────────────
cmd_fresh() {
  warn "Fresh rebuild: ALL Docker volumes will be removed (node_modules + database)."
  warn "This is the correct workflow after adding or removing packages."
  echo

  # --- 1. Tear everything down, remove named volumes and orphans ---
  info "Taking down containers and removing volumes..."
  docker compose down --volumes --remove-orphans

  # --- 2. Rebuild all images in parallel via bake ---
  info "Rebuilding images with docker buildx bake..."
  docker buildx bake --load

  # --- 3. Bring the stack back up using the freshly-built images ---
  info "Starting the stack..."
  docker compose up --no-build "$@"
}

# ─────────────────────────────────────────────────────────────────────────────
# restart — restart one service or all services without rebuilding
# ─────────────────────────────────────────────────────────────────────────────
cmd_restart() {
  local service="${1:-}"
  if [[ -z "$service" ]]; then
    info "Restarting all services..."
    docker compose restart
  else
    info "Restarting service: $service"
    docker compose restart "$service"
  fi
  success "Restart complete."
}

# ─────────────────────────────────────────────────────────────────────────────
# logs — follow logs for all services or a single service
# ─────────────────────────────────────────────────────────────────────────────
cmd_logs() {
  docker compose logs --follow "$@"
}

# ─────────────────────────────────────────────────────────────────────────────
# status — show container status
# ─────────────────────────────────────────────────────────────────────────────
cmd_status() {
  docker compose ps
}

# ─────────────────────────────────────────────────────────────────────────────
# test — run the test suite(s)
# ─────────────────────────────────────────────────────────────────────────────
cmd_test() {
  local target="${1:-all}"
  case "$target" in
    frontend)
      info "Running frontend unit tests (Vitest)..."
      docker compose run --rm frontend pnpm test
      ;;
    backend)
      info "Running backend unit tests (Vitest)..."
      docker compose run --rm backend pnpm test
      ;;
    e2e)
      info "Running e2e + accessibility tests (Playwright + axe-core)..."
      docker compose run --rm e2e pnpm test
      ;;
    all)
      info "Running all test suites..."
      cmd_test frontend
      cmd_test backend
      cmd_test e2e
      success "All test suites passed."
      ;;
    *)
      die "Unknown test target: '$target'. Use: frontend | backend | e2e | all"
      ;;
  esac
}

# ─────────────────────────────────────────────────────────────────────────────
# migrate — run pending MikroORM migrations against the running database
# ─────────────────────────────────────────────────────────────────────────────
cmd_migrate() {
  info "Running database migrations..."
  docker compose exec backend sh -c "pnpm run migrate"
  success "Migrations complete."
}

# ─────────────────────────────────────────────────────────────────────────────
# shell — open an interactive shell inside a running container
# ─────────────────────────────────────────────────────────────────────────────
cmd_shell() {
  local service="${1:-backend}"
  info "Opening shell in '$service' container..."
  docker compose exec "$service" sh
}

# ─────────────────────────────────────────────────────────────────────────────
# psql — open a psql session against the running PostgreSQL instance
# ─────────────────────────────────────────────────────────────────────────────
cmd_psql() {
  local db_user="${DB_USER:-postgres}"
  local db_name="${DB_NAME:-whosnext}"
  info "Connecting to PostgreSQL (user=$db_user db=$db_name)..."
  docker compose exec postgres psql -U "$db_user" -d "$db_name"
}

# ─────────────────────────────────────────────────────────────────────────────
# prune — clean up stopped containers, unused images, and dangling volumes
#         (does NOT remove named project volumes — use `fresh` for that)
# ─────────────────────────────────────────────────────────────────────────────
cmd_prune() {
  warn "This will remove stopped containers, unused images, and dangling volumes."
  warn "Named project volumes (node_modules, postgres data) are NOT affected."
  warn "Use './dev.sh fresh' to also reset those."
  echo
  read -rp "Continue? [y/N] " _confirm
  [[ "$_confirm" =~ ^[Yy]$ ]] || { info "Aborted."; return 0; }
  docker system prune
  success "Pruned."
}

# ─────────────────────────────────────────────────────────────────────────────
# help
# ─────────────────────────────────────────────────────────────────────────────
cmd_help() {
  cat <<'EOF'
Who's Next — development environment manager

USAGE
  ./dev.sh <command> [options]

BUILD & STACK
  build [opts]          Rebuild all Docker images in parallel via buildx bake.
                        Accepts bake flags, e.g. --no-cache or a single target:
                          ./dev.sh build --no-cache
                          ./dev.sh build frontend
  up [opts]             Start the full stack (foreground by default).
                          ./dev.sh up -d       # detached
  down [opts]           Stop containers. Volumes are preserved.
                          ./dev.sh down -v     # also remove volumes
  fresh [opts]          Full reset: removes ALL volumes (node_modules + DB),
                        rebuilds images, and starts the stack. Required after
                        adding or removing packages from any package.json.
                          ./dev.sh fresh       # foreground
                          ./dev.sh fresh -d    # detached
  restart [service]     Restart one service or all services without rebuilding.
  status                Show container status.

TESTING
  test [target]         Run test suite(s). Targets: frontend | backend | e2e | all
                          ./dev.sh test            # all suites
                          ./dev.sh test frontend   # Vitest (frontend)
                          ./dev.sh test backend    # Vitest (backend)
                          ./dev.sh test e2e        # Playwright + axe-core

DATABASE
  migrate               Run pending MikroORM migrations.
  psql                  Open a psql session against the running database.

UTILITIES
  logs [service]        Follow logs. Omit service to tail all.
  shell [service]       Open a shell in a container (default: backend).
  prune                 Remove stopped containers, unused images, dangling volumes.
                        Does NOT remove named project volumes (use fresh for that).
  help                  Show this message.

FIRST-TIME SETUP
  chmod +x dev.sh
  cp .env.example .env  # (done automatically on first run)
  ./dev.sh fresh        # build images and start the stack

PACKAGE MANAGEMENT
  To add or remove a package, edit the relevant package.json, then run:
    ./dev.sh fresh      # this is the only step needed
EOF
}

# ─────────────────────────────────────────────────────────────────────────────
# Dispatch
# ─────────────────────────────────────────────────────────────────────────────
command="${1:-help}"
shift 2>/dev/null || true

case "$command" in
  build)          cmd_build "$@" ;;
  up)             cmd_up "$@" ;;
  down)           cmd_down "$@" ;;
  fresh)          cmd_fresh "$@" ;;
  restart)        cmd_restart "$@" ;;
  logs)           cmd_logs "$@" ;;
  status)         cmd_status ;;
  test)           cmd_test "$@" ;;
  migrate)        cmd_migrate ;;
  shell)          cmd_shell "$@" ;;
  psql)           cmd_psql ;;
  prune)          cmd_prune ;;
  help|--help|-h) cmd_help ;;
  *)              error "Unknown command: '$command'"; echo; cmd_help; exit 1 ;;
esac
