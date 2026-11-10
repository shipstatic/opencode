# CLAUDE.md

Instructions for working on `opencode-shipstatic`, ShipStatic's plugin for
OpenCode 2.

## What it is

An OpenCode server plugin that adds two things when OpenCode loads it:

- the hosted ShipStatic MCP server, `https://mcp.shipstatic.com`, under the
  key `ship` (so its tools are `ship_<tool>`);
- the `publish-online` skill, from `skills/publish-online/SKILL.md`.

It is configuration in code form: no tools of its own, no runtime
dependency, no build.

```
src/facts.ts     the facts it restates: SERVER, MCP_URL, SKILL_ID
src/skill.ts     read(): a SKILL.md as OpenCode reads one from a skills folder
src/server.ts    the plugin: Plugin.define({ id: 'ship', setup }), its only export
skills/publish-online/SKILL.md   a copy, never edited here (below)
tests/contract.test.ts           every fact held to a literal, setup() against stand-in editors
```

## Rules

- **The source is what ships.** `exports` points at `src/server.ts` and
  OpenCode runs the TypeScript directly, as its own plugin docs show. There
  is no `dist`, no `build` and no `prepack`; adding one is a decision, not
  a convenience.
- **`@opencode/plugin` is an optional peer.** OpenCode loads its own copy of
  the SDK (and `effect`) for every plugin, so the package installs nothing.
  It is a dev dependency here, exact-pinned, for the types and the suite.
  `dependencies` stays empty, and a test holds it.
- **`server.ts` exports its default and nothing else.** The loader reads the
  default export; facts and helpers live in their own modules.
- **The user's setup wins.** If any configured remote server already points
  at our URL, under any name and with or without a trailing slash, the
  plugin adds none. A `publish-online` skill the user has in a skills folder
  replaces the plugin's: OpenCode keeps one skill per id, and the folder's.
- **`oauth` stays unset.** OpenCode connects to the server with no sign-in,
  so publishing needs no account, and `opencode mcp auth ship` signs in on
  demand. `oauth: false` would turn sign-in off.
- **The skill file is read in `setup`, not at import**, and before the two
  transforms, which are synchronous.
- **The skill is a copy.** Its owner is the ShipStatic plugin repository's
  `skills/publish-online/SKILL.md`; this copy is written from it, byte for
  byte, and a change is made there.
- **Refused:** tools in the plugin (the server serves them; a second copy
  of the tool list would drift), commands, agents, hooks, a TUI or GUI part,
  an `options` object for a key or token, and a V1 implementation (OpenCode 1
  plugins do not run in OpenCode 2, and this package targets 2).

## Commands

```bash
pnpm install
pnpm exec biome ci .   # lint and format
pnpm typecheck         # tsc --noEmit over src and tests
pnpm test --run        # the suite, once
```

The pre-commit hook runs the credential scan, Biome and the typecheck;
`pnpm install` switches it on (`prepare`).

## Releasing

Bump `version` in `package.json` and push. A prerelease version
(`0.1.0-beta.2`) publishes to the `beta` dist-tag from `development`; a
stable version publishes to `latest` from `main` only. CI publishes through
npm trusted publishing and creates the GitHub Release; nothing is published
by hand. Work happens on `development`, and the merge to `main` is the
release.

## Writing

Plain, friendly words in everything a person reads (the README, error
messages). No em dashes. Comments say what is and why.
