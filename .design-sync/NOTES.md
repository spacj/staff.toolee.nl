# Staff2 — design-sync notes

## What this repo is (read first)

This is a **Next.js application**, not a packaged component library — there is no
Storybook, no `*.stories.*`, and no component `dist/`. The design-sync converter's
package shape is used in **synth-entry mode** against a hand-written entry barrel.

- **Shape:** `package`. Global: `window.Staff2`.
- **Scope:** only 4 genuinely standalone components are synced (the "brand kit"):
  `Logo`, `Modal`, `HelpTip`, `MonthCarousel`. Everything else in `src/components`
  is coupled to auth/Firestore/PayPal/`next/navigation` and can't render standalone.
  `PageIntro` was considered but **excluded** — it imports `useAuth` (→ Firebase).
- **Entry:** `.design-sync/entry.jsx` re-exports the 4 components (relative paths).
  Bundle with `--entry ./.design-sync/entry.jsx`. If you add/remove a component,
  update BOTH `entry.jsx` and `componentSrcMap` in `config.json`.
- **Styles:** the DS is Tailwind (`@apply`-based component classes in
  `src/styles/globals.css`). `cssEntry` must be a **compiled** stylesheet, so
  `buildCmd` compiles it to `.design-sync/compiled.css` before the converter runs.
  That file is generated (gitignored) — always regenerate before building.
- **Fonts:** DM Sans / Inter / JetBrains Mono are loaded via a **remote Google
  Fonts `@import`** at the top of `globals.css` → expect `[FONT_REMOTE]`
  (informational). `runtimeFontPrefixes` is set as a backstop for `[FONT_MISSING]`.
  Nothing to ship in `fonts/`.

## Build + verify (from repo root)

```sh
# 0. deps (already installed): npm ci
# 1. compile the DS stylesheet (this is cfg.buildCmd — the driver runs it for you)
npx tailwindcss -i ./src/styles/globals.css -o ./.design-sync/compiled.css

# 2. stage converter scripts + deps (once)
mkdir -p .ds-sync && cp -r "<skill-base-dir>"/package-build.mjs "<skill-base-dir>"/package-validate.mjs "<skill-base-dir>"/package-capture.mjs "<skill-base-dir>"/resync.mjs "<skill-base-dir>"/lib "<skill-base-dir>"/storybook .ds-sync/
echo '{"name":"ds-sync-deps","private":true}' > .ds-sync/package.json
(cd .ds-sync && npm i esbuild ts-morph @types/react)

# 3. build the bundle from the synthetic entry
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --entry ./.design-sync/entry.jsx --out ./ds-bundle

# 4. validate (needs playwright+chromium for the render check; else --no-render-check)
node .ds-sync/package-validate.mjs ./ds-bundle
```

## Upload (needs an authorized session)

The VS Code extension can't do `/design-login`. Run `/design-sync` from the
**Claude Code CLI** (or use Claude Design's "Send to Claude Code Web"). Project is
pinned in `config.json` (`projectId`) — re-syncs go through the atomic upload path.

## KNOWN BUG — `.ds-single` renders fixed/inset-0 overlays at zero height

**Applies to any component whose open state uses `position: fixed` + `inset-0`
relative to the viewport (dialogs, drawers, full-screen overlays) — `Modal` here.**
Symptom: the card/preview renders only a sliver (e.g. just the footer buttons),
no matter how tall `cfg.overrides.<Name>.viewport` is set.

Root cause (staged `.ds-sync/lib/emit.mjs`, `previewHtmlModule`): the single-story
wrapper is `.ds-single{transform:translateZ(0)}` — the `transform` makes it the
containing block for `position:fixed` descendants (intentional, per the code's own
comment — "so fixed bars/overlays render inside the card instead of escaping to
the page viewport"), but the rule never actually sets a **height** on `.ds-single`.
An auto-height containing block whose only children are `fixed`+`inset-0` (which
need the containing block's height to size *themselves*) collapses to ~0. The
nearby comment literally says "a full-viewport story root (**100vh** / Grommet
full)" — the `height:100vh` was clearly intended but is missing from the actual
CSS rule.

**Fix applied this session** (not persisted — `.ds-sync/` is gitignored and
re-staged with a fresh `cp -r` from the skill's bundled `lib/` on every sync, and
the base SKILL.md explicitly says not to fork `lib/emit.mjs`/`lib/bundle.mjs` since
they define the app's self-check contract, so this isn't checked in as a repo
override either): changed line 141 of the staged `.ds-sync/lib/emit.mjs` from
`.ds-single{transform:translateZ(0)}` to
`.ds-single{transform:translateZ(0);height:100vh}`. This only adds a CSS rule —
it doesn't touch the `@dsCard` marker, script load order, or bundle format, so it
shouldn't affect the self-check contract.

**On every future sync, until the skill package itself ships this fix**: re-apply
that one-line change to `.ds-sync/lib/emit.mjs` after step 2's `cp -r` and before
building, whenever the DS has (or gains) a fixed/inset-0 overlay component. Verify
by checking the component's card in `_screenshots/review/<group>__<Name>.png` —
if `Modal` (or any future overlay component) shows only a partial/cropped render,
this is why.

Also needed alongside the fix: `cfg.overrides.Modal.viewport` must be **wide
enough to cross Tailwind's `sm:` breakpoint (≥640px)** — `Modal.jsx` uses
`items-end sm:items-center` (mobile bottom-sheet below `sm:`, centered dialog at
`sm:`+), so a narrower preview viewport renders the *mobile* bottom-sheet variant
instead of the intended desktop-centered dialog. Current value: `"680x520"`.

## Known render warns / interaction-only

- `HelpTip` popover only opens on click — the cards show the trigger button; the
  open popover is interaction-only (not statically rendered).
- `MonthCarousel` swipe/keyboard navigation is interactive; the static render shows
  the current month, arrows, and dot indicator (this is the real resting state).

## Re-sync risks (watch-list)

- **`cssEntry` is generated.** `.design-sync/compiled.css` is produced by `buildCmd`
  from `globals.css` + `tailwind.config.js`. It only contains classes **used in
  `src/**`** (Tailwind's content scan). If the design agent needs a utility that the
  app never uses, it won't be in the sheet — widen with a Tailwind `safelist` or a
  broader content glob if that becomes a problem.
- **Preview import specifier.** `previews/*.tsx` import from `'staff-manager'`
  (`cfg.pkg`). If the converter's synth-entry preview resolver expects a different
  specifier, previews may fail to compile and drop to floor cards — adjust the
  import then rebuild. (Floor cards are not fatal.)
- **Synth-entry `.d.ts`.** These are `.jsx` files with no types, so prop contracts
  come entirely from `cfg.dtsPropsFor` (hand-written). Keep those in sync with the
  component signatures if props change.
- **App coupling.** Do not add auth/Firestore/PayPal/`next/*`-importing components
  to the entry — they break the esbuild bundle. Keep the scope to pure presentational
  components.
- **Chromium.** The render check needs playwright+chromium (~200 MB). If it isn't
  installed, `package-validate.mjs` reports `[RENDER_SKIPPED]`; only pass
  `--no-render-check` with explicit sign-off (the bundle is then unverified).
