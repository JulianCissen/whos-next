# docker-bake.hcl
# Defines all image build targets for Who's Next.
#
# Usage (via dev.sh — preferred):
#   ./dev.sh build          # build all targets in parallel
#   ./dev.sh fresh          # nuke volumes + bake + up
#
# Direct usage:
#   docker buildx bake --load            # build default group (all targets)
#   docker buildx bake --load backend    # build one target
#   docker buildx bake --print           # preview the resolved build plan
#
# All three application targets are built in parallel by BuildKit.
# The shared pnpm store cache mount (in the Dockerfile) is reused across
# all targets, so the second build is significantly faster than the first.

variable "TAG" {
  default = "dev"
}

# ─────────────────────────────────────────────────────────────────────────────
# Default group — built when running `docker buildx bake` with no target
# ─────────────────────────────────────────────────────────────────────────────
group "default" {
  targets = ["backend", "frontend", "e2e"]
}

# ─────────────────────────────────────────────────────────────────────────────
# Private base target — not built directly, inherited by all others
# ─────────────────────────────────────────────────────────────────────────────
target "_common" {
  dockerfile = "Dockerfile"
  context    = "."
}

# ─────────────────────────────────────────────────────────────────────────────
# Application targets
# ─────────────────────────────────────────────────────────────────────────────
target "backend" {
  inherits = ["_common"]
  target   = "backend-dev"
  tags     = ["whos-next-backend:${TAG}"]
}

target "frontend" {
  inherits = ["_common"]
  target   = "frontend-dev"
  tags     = ["whos-next-frontend:${TAG}"]
}

target "e2e" {
  inherits = ["_common"]
  target   = "e2e"
  tags     = ["whos-next-e2e:${TAG}"]
}
