# Mado Smoking — Redesign Handoff (for Claude Code)

Task: redesign the UI of the existing Next.js + Firebase app "Mado Smoking - مادو للتدخين" using this design system. DO NOT change business logic, Firebase data, routes, or user roles. UI layer only.

## Read first
1. `README.md` — brand book and usage rules (colors, type, spacing, RTL, roles).
2. `tokens.json` (source of truth) and `tokens.css` (compiled CSS variables; dark is default, `[data-theme="light"]` overrides).
3. `components/bundle.css` — all component classes (`m-btn`, `m-stat`, `m-table`, `m-modal`, ...). Layout adapts via container queries on `.m-root` at 768px: put `m-root` on the app wrapper, or convert those queries to media queries.
4. `components/<Name>/preview.html` + `README.md` — HTML reference for each component.
5. `components/Screen*/preview.html` — the 16 screens (mobile 390 / desktop 1440, each has its own states). Open them in a browser (they need tokens.css + bundle.css; wrap with `<html data-theme="dark">`). The `/_blob/...` logo URL should be replaced with `assets/Logo/mado-logo.png`.

## Rules
- RTL everywhere, font Tajawal (weights 300–800), Latin digits (1,250), Arabic dates.
- Money in = green with "+", money out = red with "−" (never color alone).
- Owner-only data (profit, suppliers, reports, stock value) must NOT be rendered for employees (no CSS hiding).
- Mobile first: tap targets >= 48px, modals become bottom sheets, tables become cards, bottom nav (3 sections + "+" sheet).
- Both themes (dark default + light), switch with `data-theme`.
- Gold only as an accent.

## Suggested plan
1. Add tokens.css + bundle.css + font, create theme provider and layout shell (Sidebar / Bottom Nav).
2. Build shared React components mirroring the preview HTML (Button, Field, StatCard, Table, Badge, Modal, Toast, Empty, Skeleton, Timeline).
3. Re-skin screens one by one, in this order: Login, Dashboard, Customers, Customer page, Sale invoice, Payment, Statement, then the rest.
4. After each screen, compare with its preview at 390 and 1440, dark and light.
