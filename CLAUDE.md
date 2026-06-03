# agent-harness-sdk — repo notes

Project-local rules for working **in this repo** (developing the SDK itself).

## Running the harness CLI in this repo

Invoke the CLI via the source or built entry — **not** the `harness` bin:

- `npx tsx src/cli/index.ts <args>` — runs the latest source, no build needed (preferred while iterating).
- `node dist/cli/index.js <args>` — runs the built output (after `npm run build`).

Avoid `npx harness <args>` and `node_modules/.bin/harness` here: a rebuild leaves
`dist/cli/index.js` without the executable bit, so the bin symlink fails with
**exit 126**. `node`/`tsx` read the file directly and don't need the bit. (This
is a local-dev-only quirk — published installs get the bit set by npm, so
consumers are unaffected and it isn't worth a build step.)
