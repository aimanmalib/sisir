#!/usr/bin/env bash
# Test gate: typecheck, build, unit tests, contracts (once contracts/ exists), secret scan.
# Runs the same on a developer machine and in CI. Missing tools are installed at pinned versions,
# and each download is checked against its published sha256.
set -euo pipefail

# Git hooks export GIT_DIR and friends; tests that run git in temp folders must not inherit them.
while IFS= read -r v; do unset "$v"; done < <(env | grep -o '^GIT_[A-Z_]*' || true)

cd "$(dirname "$0")/.."
root=$PWD

FOUNDRY_VERSION=v1.8.7
FOUNDRY_SHA256=ba470eb718e779e4b0e3f1520b5284231b1bf98e9a39de07fb8f77ed70525bcf
GITLEAKS_VERSION=8.30.1
GITLEAKS_SHA256=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
tools="$root/.tools"
step() { printf '\n== %s\n' "$1"; }
fail() { echo "gate: $*" >&2; exit 1; }
started=$(date +%s)

# fetch <url> <sha256> <dest>: download and verify, or stop.
fetch() {
  curl -fsSL --retry 3 -o "$3" "$1"
  echo "$2  $3" | sha256sum -c --quiet - || fail "checksum mismatch for $1"
}

# Prefer the Node major in .nvmrc from nvm when the default node is a different major.
need=$(tr -dc '0-9' < .nvmrc)
major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if [ "$(major)" != "$need" ] && [ -d "${NVM_DIR:-$HOME/.nvm}/versions/node" ]; then
  candidate=$(ls -d "${NVM_DIR:-$HOME/.nvm}/versions/node/v${need}."* 2>/dev/null | sort -V | tail -1 || true)
  [ -n "$candidate" ] && export PATH="$candidate/bin:$PATH"
fi
[ "$(major)" = "$need" ] || fail "Node $need required, found $(node -v 2>/dev/null || echo none)"

export PATH="$tools/bin:$HOME/.foundry/bin:$PATH"
if ! command -v gitleaks >/dev/null; then
  step "install gitleaks $GITLEAKS_VERSION"
  mkdir -p "$tools/bin"
  fetch "https://github.com/gitleaks/gitleaks/releases/download/v$GITLEAKS_VERSION/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
    "$GITLEAKS_SHA256" "$tmp/gitleaks.tar.gz"
  tar -xzf "$tmp/gitleaks.tar.gz" -C "$tools/bin" gitleaks
fi

# shellcheck source=scripts/lib/count-tests.sh
source "$root/scripts/lib/count-tests.sh"

# strict <runner> <label> <command…>: run a test command and fail unless tests really ran and none was skipped.
strict() {
  local runner=$1 label=$2 out rc=0 counts
  shift 2
  out=$("$@" 2>&1) || rc=$?
  printf '%s\n' "$out" | tail -n 12
  [ "$rc" -eq 0 ] || fail "$label failed (exit $rc)"
  case $runner in
    forge) counts=$(count_forge <<<"$out" || true) ;;
    vitest) counts=$(count_vitest <<<"$out" || true) ;;
    playwright) counts=$(count_playwright <<<"$out" || true) ;;
  esac
  read -r passed skipped <<<"${counts:-0 0}"
  [ "${passed:-0}" -ge 1 ] || fail "$label: no tests ran"
  [ "${skipped:-0}" -eq 0 ] || fail "$label: $skipped tests skipped"
  echo "gate: $label ran $passed tests"
}

[ -d node_modules ] || { step "npm ci"; npm ci --no-audit --no-fund >"$tmp/npm.log" 2>&1 || { tail -n 30 "$tmp/npm.log"; fail "npm ci failed"; }; }
step "typecheck"; npx --no-install tsc -p tsconfig.json || fail "typecheck failed"
step "build";     npm run --silent build || fail "build failed"
step "unit tests"; strict vitest "vitest" npx --no-install vitest run
step "cli smoke"
node dist/cli.js --version >/dev/null || fail "dist/cli.js does not run"

# The playground in web/ bundles the same rule engine (src/rules) and has its own lockfile.
if [ -f web/package.json ]; then
  [ -d web/node_modules ] || { step "web npm ci"; (cd web && npm ci --no-audit --no-fund) >"$tmp/web-npm.log" 2>&1 || { tail -n 30 "$tmp/web-npm.log"; fail "web npm ci failed"; }; }
  step "web typecheck"; (cd web && npx --no-install tsc --noEmit) || fail "web typecheck failed"
  step "web tests";     strict vitest "web vitest" env -C web npx --no-install vitest run
  step "web build";     (cd web && npx --no-install vite build --logLevel warn) || fail "web build failed"
  # The anchor flow against the QoreX test double and a fake chain (web/e2e). CI installs the browser and its
  # system libraries; a developer machine reuses the browser Playwright already downloaded.
  if [ -d web/e2e ]; then
    if [ -n "${CI:-}" ]; then
      step "install chromium for playwright"
      (cd web && npx --no-install playwright install --with-deps chromium) >"$tmp/pw.log" 2>&1 || { tail -n 30 "$tmp/pw.log"; fail "playwright install failed"; }
    fi
    step "web e2e"; strict playwright "web e2e" env -C web npx --no-install playwright test --reporter=line
  fi
fi

if [ -f contracts/foundry.toml ]; then
  if ! forge --version 2>/dev/null | grep -q "Version: ${FOUNDRY_VERSION#v}"; then
    step "install foundry $FOUNDRY_VERSION"
    mkdir -p "$tools/bin"
    fetch "https://github.com/foundry-rs/foundry/releases/download/$FOUNDRY_VERSION/foundry_${FOUNDRY_VERSION}_linux_amd64.tar.gz" \
      "$FOUNDRY_SHA256" "$tmp/foundry.tar.gz"
    tar -xzf "$tmp/foundry.tar.gz" -C "$tools/bin" forge cast anvil
  fi
  if [ -f .gitmodules ] && [ ! -f contracts/lib/forge-std/src/Test.sol ]; then
    step "fetch submodules"; git submodule update --init --depth 1
  fi
  cd contracts
  step "forge build"; forge build --deny-warnings >"$tmp/build.log" 2>&1 || { tail -n 30 "$tmp/build.log"; fail "forge build failed"; }
  step "forge fmt";   forge fmt --check || fail "run 'forge fmt' in contracts/"
  step "forge test";  strict forge "forge test" forge test
  cd "$root"
fi

step "secret scan"
if git rev-parse --git-dir >/dev/null 2>&1; then
  gitleaks git --redact --no-banner --log-level warn . || fail "gitleaks found a secret in the history"
fi
# Working tree: only files git would publish (tracked or untracked but not ignored). Copying them out keeps
# node_modules, build output and git-ignored notes out of the scan without an allowlist in the repo.
mkdir -p "$tmp/scan"
if git rev-parse --git-dir >/dev/null 2>&1; then
  git ls-files -z --cached --others --exclude-standard \
    | while IFS= read -r -d '' f; do [ -f "$f" ] && [ ! -L "$f" ] && printf '%s\0' "$f"; done \
    | xargs -0 -r cp --parents -t "$tmp/scan"
  gitleaks dir --redact --no-banner --log-level warn "$tmp/scan" || fail "gitleaks found a secret in the working tree"
fi

echo
echo "gate: OK in $(( $(date +%s) - started ))s"
