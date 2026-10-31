# AGENTS.md

This file is the single source of guidance for coding agents working in this repository. `CLAUDE.md` imports it, so put repository facts here and do not maintain a second copy.

## Working agreement

Behavioural rules, not code conventions. They come from recurring corrections in this repository's sessions — treat them as project rules.

- **Change only what was named.** If a fix needs an adjacent file, helper, dependency or piece of copy, say so and stop. Removing the last usage of a dependency is not permission to uninstall it. Never delete or rewrite authored content — landing page prose, comments — as a side effect of another task.
- **A passing check is not a working feature.** `pnpm lint` proves the code compiles; it says nothing about whether editing on a real page works. For any visual or runtime change, state what was verified and what was never seen running as two separate things. If it wasn't looked at, the word is "unverified" — a green check does not stand in for it, and never run a check just so there is something green to report.
- **Don't run builds or checks on routine changes.** A styling tweak, an MDX copy edit does not need `pnpm build` or `pnpm lint` afterwards. They cost more time than they save, and the dev server and editor surface the same errors sooner. Make the change and say what you changed. `pnpm build` is the worst offender — it builds every workspace package. Run a check only when the change is broad, touches config, types, the serializer or the package exports, or when asked — and say in one line what it is for before starting it. Never narrate a step you are about to take instead of taking it.
- **End on the result.** No "want me to…", "say the word", "happy to…". If a decision is genuinely needed, ask it in the first line, not the last. A caveat earns its place only when it changes what to do next.
- **Edit prose, don't hedge it.** In `apps/web/src/app/content.mdx` and `README` copy, preserve the author's voice and level of certainty. No added qualifiers, no both-sides caveats, no new "never" absolutes.
- **Answer at the altitude of the question.** Reach for the platform primitive — a Tailwind media query over a custom hook, CSS over JS. The general solution is for after the specific one has been shown to fail.
- **Write commit and PR titles like a person.** `type(scope): short summary`, under ~60 characters — this repo scopes by area (`web`, `editor`, `sidecar`), as in `fix(editor): keep curly quotes while editing` and `feat(web): add the install section`. No trailing "for improved / for better / for consistency" clause. One change per title; if it needs an "and", it is two commits. Name the outcome, don't restate the diff, and avoid the filler verbs `enhance`, `streamline`, `standardize`, `optimize`.
- **PR descriptions are plain prose or nothing.** A few sentences on what changed and why; a `## heading` only when there is a real bug or decision to explain. Never a bulleted dump of the commit subjects. Most changes here need no body at all — leave it empty rather than padding it.

## Commands

All commands run from the repo root (pnpm workspace):

- `pnpm dev` — runs `tsdown --watch` for the library and `next dev` for the site in parallel (`dev:lib` and `dev:web` run each alone)
- `pnpm build` — builds the library with tsdown; `pnpm build:web` builds the site, which builds `esqe` first
- `pnpm lint` — Oxlint for JavaScript and TypeScript; `pnpm check` also enforces Biome formatting, assists and CSS/JSON rules
- `pnpm fix` — Oxlint safe fixes followed by Biome formatting and assists; `pnpm format` formats only
- `pnpm typecheck` — checks library and test types, builds the library, then generates and checks site route types
- `pnpm test` — the Vitest suite in `tests/`. `roundtrip.test.ts` also runs over every `content.mdx` in `../jakub.kr` and `../interfaces` when those checkouts exist, and skips that part when they don't, as in CI.

Biome is pinned to the version `ultracite` targets; a newer Biome rejects its preset. Lint warnings and unused Oxlint suppressions fail checks. Type-aware Oxlint is disabled; `pnpm typecheck` checks types separately.

Releases publish to npm from `.github/workflows/release.yml` when a GitHub release is published. Bump `version` in `package.json` first.

## Architecture

pnpm workspace with the library at the root and the landing page beside it:

- `src/remark.ts` — `esqe/remark`. Wraps every top-level MDX block in a `display: contents` div carrying its file, source offsets, block type and a hash of the file. Dev only; the sites add it conditionally.
- `src/next.ts` — `esqe/next`. `withEsqe` starts the sidecar during `next dev` and passes its URL and token to the client through `env`. Outside development it returns the config untouched.
- `src/server/` — the sidecar: a localhost HTTP server on a port derived from the project path. Reads files, applies ops that must still match the text they replace, uploads media, keeps undo history. Only touches `.md`/`.mdx` inside the project, only accepts localhost origins and the token.
- `src/client/` — `<Esqe />`. The UI lives in a shadow root (`chrome.tsx`). Clicking a block hides the rendered run of text blocks around it and mounts a Tiptap editor in its place (`run.ts`), rendered with elements cloned from the page (`editor.ts`). `convert.ts` turns mdast into ProseMirror and back; blocks whose content didn't change are written back byte for byte.
- `src/shared/` — markdown parsing, block classification, serialization and ops, used by both sides and the tests.
- `apps/web` — the landing page at esqe.jakub.kr. Next 16 with the CSS setup from jakub.kr. Its copy is `src/app/content.mdx`, and the page runs esqe on itself in development.

The rendered blocks are hidden, never edited: React owns that DOM, and typing into it breaks the next Fast Refresh. Keep that invariant.
