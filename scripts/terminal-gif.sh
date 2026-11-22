#!/usr/bin/env bash
# Records the README terminal GIF from real CLI output.
# Usage: npm run build && bash scripts/terminal-gif.sh [out.gif]
# Needs `agg` (https://github.com/asciinema/agg) on PATH. The cast is written with the output of
# `node dist/cli.js` on the two workshop vault files, so the GIF always shows what the CLI prints today.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$root/docs/images/terminal.gif}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cols=104
rows=20

run() {
  (cd "$root/fixtures/workshop" && FORCE_COLOR=1 node "$root/dist/cli.js" "$@" || true)
}

# Writes one asciicast v2 event per line of input, starting at time $1, with $2 seconds between lines.
# Long lines wrap at word boundaries to $3 visible columns (colour codes do not count), with the same indent.
events() {
  node -e '
    const [start, step, cols] = process.argv.slice(1).map(Number);
    const visible = (s) => s.replace(/\u001b\[[0-9;]*m/g, "").length;
    const wrap = (line) => {
      const lead = line.match(/^ */)[0];
      const indent = " ".repeat(lead.length + 6);
      const out = [];
      let cur = lead;
      for (const word of line.slice(lead.length).split(" ")) {
        const next = cur.trim() === "" ? cur + word : cur + " " + word;
        if (visible(next) > cols && cur.trim() !== "") {
          out.push(cur);
          cur = indent + word;
        } else cur = next;
      }
      return [...out, cur];
    };
    const lines = require("fs").readFileSync(0, "utf8").split("\n");
    if (lines.at(-1) === "") lines.pop();
    lines.flatMap(wrap).forEach((l, i) =>
      console.log(JSON.stringify([+(start + i * step).toFixed(2), "o", l + "\r\n"])));
  ' "$1" "$2" "$cols"
}

# Types a command one character at a time from time $1.
typed() {
  node -e '
    const start = Number(process.argv[1]);
    const text = process.argv[2];
    console.log(JSON.stringify([start, "o", "\u001b[32m$\u001b[0m "]));
    [...text].forEach((c, i) => console.log(JSON.stringify([+(start + 0.3 + i * 0.035).toFixed(2), "o", c])));
    console.log(JSON.stringify([+(start + 0.6 + text.length * 0.035).toFixed(2), "o", "\r\n"]));
  ' "$1" "$2"
}

cmd1="npx github:aimanmalib/sisir QDayVault_v0_buggy.sol"
cmd2="npx github:aimanmalib/sisir QDayVault_v1_fixed.sol"
t2=$(node -e "console.log((0.6 + ${#cmd1} * 0.035 + 0.8).toFixed(2))")
t3=$(node -e "console.log(($t2 + 4.5).toFixed(2))")
t4=$(node -e "console.log(($t3 + 0.6 + ${#cmd2} * 0.035 + 0.8).toFixed(2))")

{
  printf '{"version": 2, "width": %d, "height": %d}\n' "$cols" "$rows"
  typed 0 "$cmd1"
  run QDayVault_v0_buggy.sol | events "$t2" 0.05
  typed "$t3" "$cmd2"
  run QDayVault_v1_fixed.sol | events "$t4" 0.05
  node -e "console.log(JSON.stringify([$t4 + 0.6, 'o', '\\u001b[32m\$\\u001b[0m ']))"
  node -e "console.log(JSON.stringify([$t4 + 4, 'o', '']))"
} > "$tmp/sisir.cast"

agg --cols "$cols" --rows "$rows" --font-size 15 --theme monokai --idle-time-limit 5 "$tmp/sisir.cast" "$out" 2>/dev/null
echo "wrote $out"
