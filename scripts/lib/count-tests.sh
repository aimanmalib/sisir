# Sourced by scripts/gerbang-ujian.sh. Each function reads test runner output on stdin and prints "<passed> <skipped>".

# vitest prints "Tests  N passed (N)" or "Tests  N passed | M skipped (T)".
count_vitest() {
  grep -oE '(^|[^[:alnum:]])Tests +[0-9]+ passed[^(]*' |
    awk '{for (i = 1; i <= NF; i++) {if ($i == "Tests") p += $(i + 1); if ($i == "skipped") s += $(i - 1)}}
      END {print p + 0, s + 0}'
}

# forge prints "N tests passed, F failed, S skipped" per suite and once more as the total; the last line wins.
count_forge() {
  grep -oE '[0-9]+ tests passed, [0-9]+ failed, [0-9]+ skipped' | tail -1 | awk '{print $1, $6}'
}
