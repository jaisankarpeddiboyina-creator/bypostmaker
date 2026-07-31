#!/usr/bin/env bash
# Usage: bash scripts/ship.sh
# This is the ONLY sanctioned way to push code in this repo. Run it from the repo root.
# Never run `git push` manually outside this script on staging or main.
set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
die() { echo -e "${RED}✘ SHIP ABORTED: $1${NC}" >&2; exit 1; }
step() { echo -e "\n${BOLD}▶ $1${NC}"; }
ok() { echo -e "${GREEN}✔ $1${NC}"; }

echo -e "${BOLD}PostMaker ship script — $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
echo "──────────────────────────────────────────────────────────────────────"

# ── Guard: run from repo root ───────────────────────────────────────────────
[[ -f "wrangler.toml" && -f "package.json" ]] \
  || die "Run this script from the repository root (where wrangler.toml lives)."

# ── Step 1: Clean working tree ──────────────────────────────────────────────
step "1/8  Checking for uncommitted changes"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo ""
  git status --short
  die "Uncommitted changes detected (see above). Commit or stash them first."
fi
ok "Working tree is clean."

# ── Step 2: Allowed branch guard ───────────────────────────────────────────
step "2/8  Confirming branch"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "staging" && "$BRANCH" != "main" ]]; then
  die "You are on branch '${BRANCH}'. ship.sh only runs on 'staging' or 'main'."
fi
ok "On branch: ${BRANCH}"

# ── Step 3: Fast-forward pull only ─────────────────────────────────────────
step "3/8  Pulling latest ${BRANCH} (fast-forward only)"
git fetch origin "${BRANCH}" 2>&1

# Check if remote is ahead
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/${BRANCH}")
BASE=$(git merge-base HEAD "origin/${BRANCH}")

if [[ "$LOCAL" == "$REMOTE" ]]; then
  ok "Already up to date."
elif [[ "$LOCAL" == "$BASE" ]]; then
  # True fast-forward pull
  git merge --ff-only "origin/${BRANCH}" \
    || die "git pull fast-forward failed. Investigate manually."
  ok "Fast-forwarded to $(git rev-parse --short HEAD)."
elif [[ "$REMOTE" == "$BASE" ]]; then
  # Local is ahead of remote — ready to push
  ok "Local branch is ahead of origin/${BRANCH} by $(git rev-list --count origin/${BRANCH}..HEAD) commit(s)."
else
  die "Branch '${BRANCH}' has diverged from origin/${BRANCH}. This is not a fast-forward — do NOT auto-merge here. Resolve manually."
fi

# ── Step 4: npm ci (root + worker + frontend) ──────────────────────────────
step "4/8  npm ci (root, worker/, frontend/)"
echo "  → root..."
npm ci --silent 2>&1 || die "npm ci failed in root. Fix package-lock.json and retry."
echo "  → worker/..."
npm ci --silent --prefix worker 2>&1 || die "npm ci failed in worker/. Fix worker/package-lock.json and retry."
echo "  → frontend/..."
npm ci --silent --prefix frontend 2>&1 || die "npm ci failed in frontend/. Fix frontend/package-lock.json and retry."
ok "All npm ci installs succeeded."

# ── Step 5: Type check ─────────────────────────────────────────────────────
step "5/8  Type check (worker + frontend)"
TYPE_CHECK_OUTPUT=$(npm run type-check 2>&1) || {
  echo ""
  echo "$TYPE_CHECK_OUTPUT"
  die "Type check failed (see above). Fix all TypeScript errors before shipping."
}
ok "Type check passed."

# ── Step 6: Build & Prerender ──────────────────────────────────────────────
step "6/8  Building frontend"
BUILD_OUTPUT=$(npm run build 2>&1) || {
  echo ""
  echo "$BUILD_OUTPUT"
  die "Build failed (see above). Fix build errors before shipping."
}
ok "Build succeeded."

step "7/8  Prerendering public routes"
PRERENDER_OUTPUT=$(npm run prerender 2>&1) || {
  echo ""
  echo "$PRERENDER_OUTPUT"
  die "Prerender failed (see above). Fix prerender errors before shipping."
}
ok "Prerender succeeded."

# ── Step 8: Push ───────────────────────────────────────────────────────────
step "8/8  Pushing ${BRANCH} to origin"
COMMIT=$(git rev-parse --short HEAD)
git push origin "${BRANCH}" 2>&1 || die "git push failed. Check your network and remote access."

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo -e "${GREEN}${BOLD}✔ PUSHED: ${BRANCH} @ ${COMMIT}${NC}"
echo ""
echo -e "${YELLOW}⚠  This script succeeding means your code reached GitHub.${NC}"
echo -e "${YELLOW}   It does NOT mean the deploy finished or passed.${NC}"
echo -e "${YELLOW}   Check the Actions tab now:${NC}"
echo -e "${YELLOW}   https://github.com/jaisankarpeddiboyina-creator/bypostmaker/actions${NC}"
echo "──────────────────────────────────────────────────────────────────────"
