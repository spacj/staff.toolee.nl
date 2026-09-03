# Staff2 design system

Staff2 is the UI kit behind the Staff2 team-operations app (staff2.app). It is a
**Tailwind CSS** design system: components are plain React and carry no styling of
their own — every visual comes from utility classes plus a set of named component
classes defined in the stylesheet. Build on-brand UI by using those classes, not
by inventing new ones.

## Setup — no provider needed

The library components (`Logo`, `Modal`, `HelpTip`, `MonthCarousel`) are
self-contained: they need **no context provider, theme wrapper, or store**. Just
make sure `styles.css` is loaded — it defines the tokens, the component classes,
and imports the three brand fonts. Without it, everything renders as unstyled
browser defaults.

- Icons come from **lucide-react**.
- Light UI is the default. A `dark` class on an ancestor enables dark mode
  (`darkMode: 'class'`), but most screens are built light.

## Styling idiom — Tailwind utilities + named component classes

Style with Tailwind utilities built on the Staff2 token scales, and reach for the
**named component classes** for the recurring patterns instead of re-deriving them:

| Class | Use for |
|---|---|
| `btn-primary` / `btn-secondary` / `btn-danger` / `btn-ghost` | buttons (gradient brand / outline / red / text) |
| `btn-icon` | 40×40 square icon button |
| `card` / `card-hover` / `stat-card` | white rounded panels (the base surface for everything) |
| `input-field` / `select-field` / `label` | form controls and their labels |
| `badge` + `badge-admin` / `badge-manager` / `badge-worker` / `badge-morning` / `badge-afternoon` / `badge-night` / `badge-rest` | pills / status chips |
| `page-header` / `page-title` / `section-title` | page and section headings (use `font-display`) |
| `table-container` | bordered, rounded data table wrapper |
| `dropdown-menu` / `dropdown-item` / `dropdown-item-danger` | menus |
| `overlay` / `modal` / `drawer` | dialog surfaces |
| `text-gradient` | brand blue→light gradient text |

**Token scales** (Tailwind color families — use as `bg-`, `text-`, `border-`, `ring-`):

- `brand-50 … brand-950` — primary blue→indigo (`brand-600` = #4c6ef5 is the core).
- `surface-0 … surface-950` — neutrals: `surface-0/50/100` backgrounds, `surface-200`
  borders, `surface-500/600` secondary text, `surface-800/900` primary text.
- `success-{400,500,600}`, `warning-{400,500,600}`, `danger-{400,500,600}` — semantic.
- `shift-{morning,afternoon,night,rest}` — schedule accents.
- Radii lean large: `rounded-xl` (controls), `rounded-2xl` (cards). Shadows:
  `shadow-card`, `shadow-card-hover`, `shadow-elevated`, `shadow-glow`.

**Fonts** (loaded by `styles.css` from Google Fonts):

- `font-display` → **DM Sans** — headings, titles, the logo wordmark.
- `font-body` → **Inter** — default body text.
- `font-mono` → **JetBrains Mono** — code / figures.

## Where the truth lives

- **`styles.css`** — the compiled Tailwind stylesheet: all tokens, every component
  class above, and the font `@import`. Read it before styling.
- **`components/<group>/<Name>/<Name>.d.ts`** — each component's exact props.
- **`components/<group>/<Name>/<Name>.prompt.md`** — usage notes and examples.

## One idiomatic example

```jsx
import { Modal, Logo } from 'staff2';

function InvitePanel() {
  return (
    <div className="card p-5 max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Invite a teammate</h3>
        <span className="badge badge-manager">Manager</span>
      </div>
      <label className="label" htmlFor="email">Work email</label>
      <input id="email" className="input-field" placeholder="alex@company.com" />
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary">Cancel</button>
        <button className="btn-primary">Send invite</button>
      </div>
    </div>
  );
}
```

Compose layout with Tailwind utilities + the classes above; use the library
components for the branded parts (the `Logo` mark/wordmark, `Modal` dialogs,
`HelpTip` inline help, `MonthCarousel` month navigation).
