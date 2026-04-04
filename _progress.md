# tab-sync — Build Chain

## Status

phase: build

## Goal

Build @lorb/tab-sync: cross-tab state sync via BroadcastChannel. Ship-ready v0.1.

## Constraints

- Output: products/tab-sync/
- Spec: knowledge/products/tab-sync/spec.md
- Build must pass: `npm run build -w products/tab-sync`
- Tests must pass: `npm test -w products/tab-sync`
- Zero dependencies. ESM only. TypeScript
- Bundle < 1.5KB gzip
- Follow monorepo patterns from products/otd/ or products/cloak/ for package.json and tsconfig

## Task List

### v0.1 Build

- [x] Scaffold: package.json, tsconfig.json, vitest.config.ts, src/index.ts
- [x] Core: BroadcastChannel wrapper with typed message protocol
- [x] sync(key, value) and on(key, callback) — basic pub/sub
- [x] get(key) — last value getter (leader holds state)
- [x] Leader election: heartbeat-based, oldest tab is leader, auto-takeover on close
- [x] syncAuth / onAuthChange helper
- [x] syncTheme / onThemeChange helper
- [x] tabCount() — active tab counting via heartbeat
- [x] Cleanup function (close channel, stop heartbeat)
- [x] SSR guard
- [x] Unit tests: sync/on, leader election, auth/theme helpers, tabCount, cleanup
- [x] Build verification: tsc --noEmit + bundle size check
