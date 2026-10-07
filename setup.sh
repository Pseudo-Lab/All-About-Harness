#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$SCRIPT_DIR"

DEEPSEEK_HARNESS_REPO="${DEEPSEEK_HARNESS_REPO:-https://github.com/poqopo/deepseek-harness.git}"
DEEPSEEK_HARNESS_UPSTREAM="${DEEPSEEK_HARNESS_UPSTREAM:-https://github.com/deepseek-ai/deepseek-harness.git}"
DEEPSEEK_HARNESS_DIR="${DEEPSEEK_HARNESS_DIR:-$REPOSITORY_ROOT/deepseek-harness}"
DEEPSEEK_HARNESS_VERSION="${DEEPSEEK_HARNESS_VERSION:-0.1.5-rc.3}"
DEEPSEEK_HARNESS_REF="${DEEPSEEK_HARNESS_REF:-dsh-v$DEEPSEEK_HARNESS_VERSION}"
DEEPSEEK_HARNESS_BRANCH="${DEEPSEEK_HARNESS_BRANCH:-study/npx-$DEEPSEEK_HARNESS_VERSION}"
SKIP_INSTALL=false
SKIP_BUILD=false

usage() {
  cat <<'EOF'
Usage: ./setup.sh [--skip-install] [--skip-build]

Clone the DeepSeek Harness source matching the pinned npx version and install it.

Options:
  --skip-install  Check out the repository without installing or building it.
  --skip-build    Install dependencies without cleaning and building artifacts.
  -h, --help      Show this help message.

Environment variables:
  DEEPSEEK_HARNESS_REPO  Git repository URL to clone.
  DEEPSEEK_HARNESS_UPSTREAM  Official upstream repository URL.
  DEEPSEEK_HARNESS_DIR   Local checkout path.
  DEEPSEEK_HARNESS_VERSION  DSH package version (default: 0.1.5-rc.3).
  DEEPSEEK_HARNESS_REF      Git tag or commit (default: dsh-v<VERSION>).
  DEEPSEEK_HARNESS_BRANCH   Local work branch (default: study/npx-<VERSION>).
EOF
}

while (($# > 0)); do
  case "$1" in
    --skip-install)
      SKIP_INSTALL=true
      ;;
    --skip-build)
      SKIP_BUILD=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is required." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required (DeepSeek Harness requires ^22.19.0 or >=24.0.0)." >&2
  exit 1
fi

if [[ -e "$DEEPSEEK_HARNESS_DIR" && ! -d "$DEEPSEEK_HARNESS_DIR/.git" ]]; then
  echo "Error: $DEEPSEEK_HARNESS_DIR exists but is not a Git repository." >&2
  exit 1
fi

if [[ ! -d "$DEEPSEEK_HARNESS_DIR/.git" ]]; then
  echo "Cloning DeepSeek Harness $DEEPSEEK_HARNESS_REF into $DEEPSEEK_HARNESS_DIR"
  git clone --branch "$DEEPSEEK_HARNESS_REF" "$DEEPSEEK_HARNESS_REPO" "$DEEPSEEK_HARNESS_DIR"
  if git -C "$DEEPSEEK_HARNESS_DIR" show-ref --verify --quiet "refs/remotes/origin/$DEEPSEEK_HARNESS_BRANCH"; then
    git -C "$DEEPSEEK_HARNESS_DIR" switch -c "$DEEPSEEK_HARNESS_BRANCH" --track "origin/$DEEPSEEK_HARNESS_BRANCH"
  else
    git -C "$DEEPSEEK_HARNESS_DIR" switch -c "$DEEPSEEK_HARNESS_BRANCH"
  fi
else
  CURRENT_ORIGIN="$(git -C "$DEEPSEEK_HARNESS_DIR" remote get-url origin 2>/dev/null || true)"
  echo "Using existing DeepSeek Harness checkout: $DEEPSEEK_HARNESS_DIR"

  if [[ -n "$CURRENT_ORIGIN" && "$CURRENT_ORIGIN" != "$DEEPSEEK_HARNESS_REPO" ]]; then
    echo "Note: existing origin is $CURRENT_ORIGIN"
    echo "      configured clone URL is $DEEPSEEK_HARNESS_REPO"
    echo "      setup will not change an existing remote."
  fi

  if ! git -C "$DEEPSEEK_HARNESS_DIR" rev-parse --verify --quiet "$DEEPSEEK_HARNESS_REF^{commit}" >/dev/null; then
    echo "Fetching pinned ref $DEEPSEEK_HARNESS_REF"
    git -C "$DEEPSEEK_HARNESS_DIR" fetch origin tag "$DEEPSEEK_HARNESS_REF"
  fi

  CURRENT_BRANCH="$(git -C "$DEEPSEEK_HARNESS_DIR" branch --show-current)"
  if [[ "$CURRENT_BRANCH" != "$DEEPSEEK_HARNESS_BRANCH" ]]; then
    if [[ -n "$(git -C "$DEEPSEEK_HARNESS_DIR" status --porcelain)" ]]; then
      echo "Error: DeepSeek Harness has uncommitted changes." >&2
      echo "Commit or stash them before switching to $DEEPSEEK_HARNESS_BRANCH." >&2
      exit 1
    fi

    if git -C "$DEEPSEEK_HARNESS_DIR" show-ref --verify --quiet "refs/heads/$DEEPSEEK_HARNESS_BRANCH"; then
      git -C "$DEEPSEEK_HARNESS_DIR" switch "$DEEPSEEK_HARNESS_BRANCH"
    else
      git -C "$DEEPSEEK_HARNESS_DIR" switch -c "$DEEPSEEK_HARNESS_BRANCH" "$DEEPSEEK_HARNESS_REF"
    fi
  fi

  if ! git -C "$DEEPSEEK_HARNESS_DIR" merge-base --is-ancestor "$DEEPSEEK_HARNESS_REF" HEAD; then
    echo "Error: $DEEPSEEK_HARNESS_BRANCH is not based on $DEEPSEEK_HARNESS_REF." >&2
    exit 1
  fi
fi

if ! git -C "$DEEPSEEK_HARNESS_DIR" remote get-url upstream >/dev/null 2>&1; then
  git -C "$DEEPSEEK_HARNESS_DIR" remote add upstream "$DEEPSEEK_HARNESS_UPSTREAM"
fi

CHECKED_OUT_VERSION="$(git -C "$DEEPSEEK_HARNESS_DIR" show "$DEEPSEEK_HARNESS_REF:apps/cli/package.json" | node -e "let input=''; process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => process.stdout.write(JSON.parse(input).version));")"
if [[ "$CHECKED_OUT_VERSION" != "$DEEPSEEK_HARNESS_VERSION" ]]; then
  echo "Error: $DEEPSEEK_HARNESS_REF contains dsh version $CHECKED_OUT_VERSION, expected $DEEPSEEK_HARNESS_VERSION." >&2
  exit 1
fi

echo "Pinned DSH version:  @deepseek-ai/dsh@$DEEPSEEK_HARNESS_VERSION"
echo "Pinned Git ref:     $DEEPSEEK_HARNESS_REF"
echo "Work branch:        $(git -C "$DEEPSEEK_HARNESS_DIR" branch --show-current)"

if [[ "$SKIP_INSTALL" == true ]]; then
  echo "Skipping dependency installation and build."
  exit 0
fi

if [[ ! -f "$DEEPSEEK_HARNESS_DIR/pnpm-lock.yaml" ]]; then
  echo "Error: pnpm-lock.yaml was not found in $DEEPSEEK_HARNESS_DIR." >&2
  exit 1
fi

PACKAGE_MANAGER="$(node -e '
const { readFileSync } = require("node:fs")
const manifest = JSON.parse(readFileSync(process.argv[1], "utf8"))
if (typeof manifest.packageManager !== "string") process.exit(1)
process.stdout.write(manifest.packageManager)
' "$DEEPSEEK_HARNESS_DIR/package.json")"

if [[ "$PACKAGE_MANAGER" != pnpm@* ]]; then
  echo "Error: $DEEPSEEK_HARNESS_DIR/package.json declares unsupported package manager $PACKAGE_MANAGER." >&2
  exit 1
fi

PNPM_VERSION_PIN="${PACKAGE_MANAGER#pnpm@}"
PNPM_COMMAND=()
PNPM_FROM_PARENT=false
if command -v pnpm >/dev/null 2>&1; then
  PNPM_COMMAND=("$(command -v pnpm)")
elif command -v corepack >/dev/null 2>&1; then
  echo "pnpm is not installed; using Corepack with $PACKAGE_MANAGER"
  PNPM_COMMAND=("$(command -v corepack)" pnpm)
elif command -v npx >/dev/null 2>&1; then
  echo "pnpm and Corepack are not installed; using npx with $PACKAGE_MANAGER"
  PNPM_COMMAND=("$(command -v npx)" --yes "--package=pnpm@$PNPM_VERSION_PIN" -- pnpm)
  PNPM_FROM_PARENT=true
else
  echo "Error: setup needs pnpm, Corepack, or npx to install dependencies." >&2
  exit 1
fi

run_pnpm() {
  if [[ "$PNPM_FROM_PARENT" == true ]]; then
    "${PNPM_COMMAND[@]}" --dir "$DEEPSEEK_HARNESS_DIR" "$@"
  else
    (cd "$DEEPSEEK_HARNESS_DIR" && "${PNPM_COMMAND[@]}" "$@")
  fi
}

PNPM_VERSION="$(run_pnpm --version)"
echo "Using pnpm $PNPM_VERSION"
echo "Installing DeepSeek Harness dependencies"
run_pnpm install --frozen-lockfile

if [[ "$SKIP_BUILD" == true ]]; then
  echo "Skipping clean build."
  exit 0
fi

echo "Removing stale build artifacts"
run_pnpm run clean

echo "Building DeepSeek Harness"
run_pnpm run build

echo
echo "Setup complete."
echo "All-About-Harness: $REPOSITORY_ROOT"
echo "DeepSeek Harness:  $DEEPSEEK_HARNESS_DIR"
echo "Run Web UI:        cd \"$DEEPSEEK_HARNESS_DIR\" && npm run dsh -- web"
