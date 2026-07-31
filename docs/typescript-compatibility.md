# TypeScript and JavaScript compatibility

Updated: July 31, 2026

## Compiler guarantees

Smart Export enables TypeScript's complete `strict` family. It also rejects switch fallthrough and
inconsistently cased file references. UI fields that Obsidian initializes when a modal opens use
definite-assignment annotations; values received from the SDK's string-based dropdown callback are
normalized back to the plugin's closed unions instead of asserted.

Both TypeScript and esbuild target ES2018, and TypeScript exposes only the DOM and ES2018 standard
libraries. Keeping the type-checking target and emitted bundle target aligned prevents source code
from accidentally depending on a newer JavaScript built-in than the production bundle contract.

## Compatibility rationale

ES2018 is a deliberately conservative baseline for the plugin's minimum Obsidian 1.13.0 release:

- the plugin remains browser-compatible and does not import Node.js or Electron APIs at runtime;
- ES2018 predates the browser engines used by the supported Obsidian 1.13 desktop, Android, and iOS
  clients, while still allowing the build to emit substantially more modern JavaScript than ES6;
- esbuild lowers newer TypeScript/JavaScript syntax to ES2018 in `main.js`, so source-level syntax
  does not raise the runtime requirement;
- no ES2019-or-newer standard library is declared, preventing TypeScript from accepting newer
  built-ins without an explicit compatibility review or polyfill.

The production validation is `pnpm build`: it runs strict type checking first and then creates the
minified CommonJS bundle with esbuild's ES2018 target. Physical desktop and mobile smoke testing is
still required before publishing a stable tag; issue #102 tracks that runtime verification matrix.

## Changing the baseline

Any future target or library change must update `tsconfig.json` and `esbuild.config.mjs` together,
document the minimum desktop and mobile engine support, build the production bundle, and smoke-test
that bundle on the oldest supported Obsidian desktop, Android, and iOS clients.
