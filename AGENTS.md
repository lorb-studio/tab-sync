# tab-sync

Login in one tab, every tab knows. Cross-tab state sync with auth, theme, and leader election.

## Commands

npm run build    # compile TypeScript
npm test         # run all tests (Vitest)
npm run typecheck # type-check without emit (tsc --noEmit)

## Stack

- TypeScript (ESM only)
- Vitest for testing
- Zero runtime dependencies

## Code Style

- ESM imports/exports only. No CommonJS
- Strict TypeScript (`strict: true`)
- No default exports — use named exports

## Boundaries

- Do not modify `.env` or credentials
- Do not run `npm publish` without maintainer approval
- Do not add runtime dependencies without discussion
