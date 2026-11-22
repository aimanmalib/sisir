# 0008. The README is the judges' entry point: real images, recorded by scripts, and one short Malay section

- Status: accepted
- Date: 2026-11-22

## Context

Judges read the README first. The fest asks for a README, a licence, credits for kits and libraries, and an
`AI_USAGE.md` for the AI-native prize. The README has to show the product working, not describe it. The playground
is in English and Bahasa Melayu; the rest of the repository is in English.

## Decision

- The README opens with the logo, the one-sentence tagline, links, and a terminal GIF of the real CLI on the
  workshop 2 vault: two errors on the draft, none on the fix.
- The GIF is recorded by `scripts/terminal-gif.sh` from the output of `node dist/cli.js`, through an asciicast and
  `agg`. The command shown is `npx github:aimanmalib/sisir <file>`, which gives the same output. When the rule text
  changes, run the script again.
- The playground screenshots in `docs/images/` are captured by `scripts/readme-screenshots.mjs` from the live site:
  Chromium at 1440 x 1240 and WebKit with the iPhone 13 profile.
- The logo in `brand/` is the comb mark from the playground favicon, at 512 px.
- Every number in the README and `AI_USAGE.md` comes from a test run, `docs/rules.md` or the project's build record.
  The SisirLedger section says it is not on the testnet yet, and that line changes when it is deployed.
- The README ends with a short `Bahasa Melayu` section: what Sisir is, and a link to the playground in Malay
  (`?lang=ms`). The full documentation stays in English, so there is one source of truth and no second README to keep
  in step.
- Community files: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.0), `CHANGELOG.md`,
  and issue and pull request templates, including a form for a wrong or missed finding.

## How to undo

Delete `brand/`, `docs/images/`, the two scripts and the community files, and put back the one-line README from
before this record. Nothing in the CLI, the playground or the contract depends on them.
