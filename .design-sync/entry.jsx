// Synthetic bundle entry for design-sync (this repo is a Next.js app, not a
// packaged component library, so there is no dist entry). Re-exports only the
// pure, standalone components in scope for the Claude Design brand kit.
// Build with:  --entry ./.design-sync/entry.jsx
export { default as Logo } from '../src/components/Logo';
export { default as Modal } from '../src/components/Modal';
export { default as HelpTip } from '../src/components/help/HelpTip';
export { default as MonthCarousel } from '../src/components/MonthCarousel';
