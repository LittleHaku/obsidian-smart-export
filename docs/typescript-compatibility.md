# TypeScript and JavaScript compatibility

Updated: August 2, 2026

## Compiler guarantees

Smart Export enables TypeScript's complete `strict` family. It also rejects switch fallthrough and
inconsistently cased file references. UI fields that Obsidian initializes when a modal opens use
definite-assignment annotations; values received from the SDK's string-based dropdown callback are
normalized back to the plugin's closed unions instead of asserted.

Both TypeScript and esbuild target ES2018, and TypeScript exposes only the DOM and ES2018 standard
libraries. Keeping the type-checking target and emitted bundle target aligned prevents source code
from accidentally depending on a newer JavaScript built-in than the production bundle contract.
TypeScript 7 resolves modules in `bundler` mode to match esbuild, and path aliases use explicit
project-relative targets because TypeScript 7 no longer supports `baseUrl`.

TypeScript 7.0 does not expose a programmatic API. The repository therefore follows Microsoft's
side-by-side migration pattern: `@typescript/native` aliases the TypeScript 7 package and provides
the `tsc` executable used by `pnpm typecheck`, while `typescript` aliases the official
`@typescript/typescript6` compatibility package for `typescript-eslint` and the mobile compatibility
script. This keeps project type checking on the native compiler without unsupported peer overrides.

## Compatibility rationale

ES2018 is a deliberately conservative baseline for the plugin's minimum Obsidian 1.13.0 release:

- the plugin remains browser-compatible and does not import Node.js or Electron APIs at runtime;
- ES2018 predates the browser engines used by the supported Obsidian 1.13 desktop, Android, and iOS
  clients, while still allowing the build to emit substantially more modern JavaScript than ES6;
- esbuild lowers newer TypeScript/JavaScript syntax to ES2018 in `main.js`, so source-level syntax
  does not raise the runtime requirement;
- no ES2019-or-newer standard library is declared, preventing TypeScript from accepting newer
  built-ins without an explicit compatibility review or polyfill.

Production validation combines `pnpm mobile:check` and `pnpm build`: the first rejects known
desktop-only runtime constructs and the second runs strict type checking before creating the
minified CommonJS bundle with esbuild's ES2018 target. GitHub Actions runs both across the desktop
platform matrix; physical-device testing is optional exploratory testing rather than a release
gate.

## Changing the baseline

Any future target or library change must update `tsconfig.json` and `esbuild.config.mjs` together,
document the minimum desktop and mobile engine support, pass `pnpm mobile:check`, and build and test
the production bundle across the GitHub Actions platform matrix.
