# 0009. Sisir ships as a composite GitHub Action that builds from source

- Status: accepted
- Date: 2026-11-22

## Context

The CLI already exits 1 on an error-level finding and writes `SARIF` 2.1.0, so any workflow can run it with `npx`.
A repository that wants findings on the right line of a pull request also needs the `SARIF` upload step, the
`security-events: write` permission, and a guard for pull requests from forks, where that permission is missing.
Writing those steps by hand in every repository is where mistakes happen. Sisir is not published to npm, and
`dist/` is not committed.

## Decision

- `action.yml` at the repository root is a composite Action. It runs `npm ci` inside the Action's own checkout
  (the `prepare` script builds `dist/`), then `scripts/action/run.sh`, then the official
  `github/codeql-action/upload-sarif`, pinned to a full commit SHA, then a final step that fails on exit code 1.
- Inputs reach the shell only through environment variables. A path such as `$(...)` is read as a path. A test
  fails if an `inputs.` expression appears inside a `run` block.
- Uploading and failing are separate steps, so the report reaches code scanning even when the job then fails.
  `fail-on-error: false` lets a caller decide from the `exit-code` output instead.
- A parse or usage error (exit 2) fails the run step at once and uploads nothing, so a broken file never looks
  like a clean result.
- Sisir's own CI has an `action` job: it lints `contracts/src` through `uses: ./` with upload, and runs the
  workshop draft with `fail-on-error: false` and checks that `exit-code` is 1.
- Building from source costs about one `npm ci` per run. A committed `dist/` or an npm package would be faster,
  but the first makes every change two changes and the second is a release step this project does not take.

## How to undo

Delete `action.yml`, `scripts/action/`, `test/action.test.ts` and the `action` job in `.github/workflows/ci.yml`.
The CLI does not depend on any of them. Workflows that used the Action can call
`npx github:aimanmalib/sisir --format sarif <paths> > sisir.sarif` and upload that file themselves.
