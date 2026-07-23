# Design system

## Direction

Invoice Forge uses a professional blue foundation, neutral slate surfaces, and a restrained teal accent. The document-and-check mark reinforces verified billing records. Full and compact SVG assets live in `apps/web/public`.

## Tokens

The source of truth is the `:root` block in `apps/web/src/styles.css`.

| Purpose         | Token         |
| --------------- | ------------- |
| Brand action    | `--blue-600`  |
| Brand hover     | `--blue-700`  |
| Brand surface   | `--blue-50`   |
| Accent          | `--teal-600`  |
| Primary text    | `--slate-950` |
| Muted text      | `--slate-500` |
| Border          | `--slate-200` |
| Page background | `--page`      |
| Surface         | `--surface`   |
| Success         | `--success`   |
| Warning         | `--warning`   |
| Danger          | `--danger`    |

Spacing follows a 4px-derived rhythm. Controls and cards use shared radius, border, shadow, and focus-ring tokens. Financial values use tabular numerals.

## Layout and components

- Persistent desktop navigation and an accessible mobile drawer
- Bounded content width with responsive page gutters
- Reusable buttons, fields, cards, badges, tables, dialogs, and state panels
- Responsive tables that become labeled record cards on narrow screens
- Two-column invoice editor with a sticky calculation summary on desktop
- Stacked invoice editing and full-width actions on mobile
- Consistent loading, empty, error, success, and validation feedback
- Server-generated PDF styling aligned with the application theme

## Accessibility

- Skip link and semantic landmarks
- Persistent form labels and descriptive control names
- Visible `:focus-visible` treatment
- Keyboard-operable native controls and Escape-close mobile navigation/dialog behavior
- Status icon and text, never color alone
- Minimum practical touch targets
- High-contrast text and restrained status surfaces
- Reduced-motion support

Run a formal WCAG 2.2 AA audit before a regulated or public-sector release.
