#!/usr/bin/env bash
# Runs Sisir for the composite GitHub Action in action.yml.
# Inputs arrive as environment variables, never as inline workflow expressions, so a path cannot inject shell.
#   SISIR_CLI    built CLI (dist/cli.js inside the action checkout)
#   SISIR_PATHS  files or folders, separated by spaces or new lines (default: .)
#   SISIR_SARIF  where to write the SARIF report
# Writes exit-code and sarif-file to $GITHUB_OUTPUT. Exits 0 when the lint ran (findings or not), 2 when it could not.
set -uo pipefail

cli="${SISIR_CLI:?SISIR_CLI is not set}"
sarif="${SISIR_SARIF:?SISIR_SARIF is not set}"
output="${GITHUB_OUTPUT:-/dev/null}"
read -r -d '' -a paths <<<"${SISIR_PATHS:-.}" || true
[ "${#paths[@]}" -gt 0 ] || paths=(.)

major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$major" -lt 20 ]; then
  echo "::error title=Sisir::Sisir needs Node 20.10 or newer on the runner (found ${major})."
  exit 2
fi

# Readable report in the job log first. Its exit code matches the SARIF run below.
FORCE_COLOR=1 node "$cli" -- "${paths[@]}"
node "$cli" --format sarif -- "${paths[@]}" >"$sarif"
code=$?

if [ "$code" -eq 2 ]; then
  rm -f -- "$sarif"
  echo "::error title=Sisir::Sisir could not read or parse the given paths. See the log above."
  echo "exit-code=2" >>"$output"
  exit 2
fi
{ echo "exit-code=$code"; echo "sarif-file=$sarif"; } >>"$output"
exit 0
