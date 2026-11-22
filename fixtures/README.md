# Fixtures

- `rules/<id>/positive-*.sol`: code each rule must flag.
- `rules/<id>/negative-*.sol`: close variants each rule must leave alone.
- `workshop/`: the workshop 2 audit vault, first draft and fixed version (credited in `NOTICE`).

Run Sisir over this folder with `node dist/cli.js fixtures/`.
