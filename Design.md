# Design System and UX Specification

**Status:** Draft v1
**Date:** 2026-11-02
**See also:** [PRD.md](PRD.md) · [Architectural.md](Architectural.md) · [STRUCTURE.md](STRUCTURE.md)

---

## 1. Design principles

The people using this spend hours in it, doing repetitive and consequential work. The interface should feel calm and dependable.

| Principle | In practice |
|---|---|
| **Data first** | Content is the focus. Chrome stays quiet, and color is reserved for meaning |
| **Always clear what's happening** | Every wait shows a skeleton, every save confirms, every failure says what to do next |
| **Respect expertise and beginners** | Plain labels and guided empty states, with keyboard shortcuts and a command palette for fast users |
| **Safe by default** | Destructive actions are reversible or confirmed, and show who and what they affect |
| **Show only what's allowed** | People see only what they can use, with a clear explanation at any direct-link dead end |
| **Consistent** | One table, one form pattern, one page header, used everywhere |

---

## 2. Foundations

### Typography

People choose **Geist** (default), **Inter** or **Lato** for interface text in Settings or the appearance menu. **Geist Mono** is used for codes, SKUs and IDs. All load through `next/font`, so there's no layout shift, and only Geist is preloaded.

All sizes are in `rem`, so they follow the UI scale.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `text-2xl` | 1.5 / 2rem | 600 | Page title |
| `text-lg` | 1.125 / 1.75rem | 600 | Section title |
| `text-base` | 1 / 1.5rem | 500 | Card title, dialog title |
| `text-sm` | 0.875 / 1.25rem | 400 | **Default** body, table cell, input |
| `text-xs` | 0.75 / 1rem | 500 | Label, caption, badge |
| KPI | 1.875 / 2.25rem | 600 | Dashboard numbers |

Numbers in tables and KPIs use `tabular-nums` and align right, so columns are easy to compare.

### Spacing, shape and depth

- **Grid:** 4px base (Tailwind's default scale), so everything scales with `rem`.
- **Radius:** `--radius: 0.5rem`: controls 0.375rem, cards 0.625rem.
- **Small shadows:** three levels: `shadow-card` for cards, inputs and buttons, `shadow-raised` for hover and the login card, and `shadow-overlay` for dialogs. Dark mode uses stronger values so they still show.
- **Faint gradients:** at most 5% of the theme color on the page background, sidebar, stat cards and empty states, and 12% behind the login card. Never behind body text at a level that changes its contrast.
- **Control height:** 2.25rem default; 2rem in table toolbars. At Compact, this comes to about 32px, which meets the WCAG 2.2 minimum target size. Touch screens use a minimum of 2.75rem.

### Icons

`lucide-react`, 1rem by default and 1.25rem in navigation, stroke 1.75. Sized in `rem` to follow the scale. Icon-only buttons always have a tooltip and accessible label.

---

## 3. Color and themes

### Token structure

All color comes from semantic CSS variables, using shadcn's naming. Components never use raw colors such as `bg-blue-500`.

```css
/* styles/tokens.css: shape only; values live in each theme file */
--background, --foreground, --card, --card-foreground, --popover, --popover-foreground,
--primary, --primary-foreground, --secondary, --secondary-foreground, --muted, --muted-foreground,
--accent, --accent-foreground, --destructive, --border, --input, --ring,
--sidebar, --sidebar-foreground, --sidebar-primary, --sidebar-accent, --sidebar-border,
--chart-1 ... --chart-5,
/* Added by this project */
--success, --warning, --info, and each -foreground / -subtle variant
```

### Themes

Two independent settings, which give 36 combinations with Light, Dark and System:

**Mode:** Light · Dark · System

**Color theme**, covering the shadcn color palette:

| Neutral family | Accent family |
|---|---|
| Slate **(default)**, Zinc, Stone, Gray, Neutral | Blue, Violet, Green, Orange, Rose, Red, Yellow |

Newer shadcn theme presets can be added as more CSS files without changing components, and the final list is verified against the shadcn version installed in Phase 0.

**Default:** Slate neutrals with a restrained blue primary. It's the conventional enterprise look, and the eye rests on content rather than brand color.

```css
/* styles/themes/slate.css, simplified */
:root[data-theme="slate"]      { --primary: oklch(...); }
:root[data-theme="slate"].dark { --primary: oklch(...); }
```

Rules across themes:

- **Status colors don't change meaning:** success is green, warning is amber, destructive is red, whatever the theme. In Rose or Red themes, destructive actions also rely on an icon and label, so they're never confused with the primary color.
- **Never color alone:** status always has text or an icon too.
- **Contrast is tested:** CI checks every theme and mode pair: 4.5:1 for text, and 3:1 for UI elements. A theme failing this doesn't ship.
- **Charts** use `--chart-1..5`, tuned per theme for distinguishable series. Semantic charts (such as "at risk") use status colors.

### Theme picker

Located in Settings → Appearance, with a shortcut in the user menu. It shows swatches, a small live preview, and applies instantly. Choices are stored in `localStorage` for pre-paint and in `app_user.preferences`, so they follow the user across devices.

**No flash on load:** following the Next.js "preventing flash" guide, a small inline script in the root layout reads the stored values and sets `data-theme`, the `dark` class and `data-scale` on `<html>` before first paint.

---

## 4. UI scale

| Setting | Root font-size | At browser default | Best for |
|---|---|---|---|
| **Compact** | 90% | 14.4px | Large monitors, dense data work |
| **Normal** | 100% (default) | 16px | Most people |
| **Large** | 125% | 20px | Accessibility, distant or high-resolution screens |

```css
/* styles/scale.css */
html                       { font-size: 100%; }
html[data-scale="compact"] { font-size: 90%; }
html[data-scale="large"]   { font-size: 125%; }
```

**Why root font-size and not CSS `zoom` or `transform`:** Tailwind 4's type and spacing are `rem`-based, so everything follows automatically. Text stays sharp, layout reflows naturally, portaled menus and tooltips stay positioned correctly, and percentages also respect the browser's own font-size setting.

Rules that make it hold up:

- Use `rem` for all sizes. Exceptions in `px`: 1px borders and focus outlines.
- Media-query breakpoints don't change with the root font size, so components that depend on available space use **container queries**.
- At Large on smaller screens, the sidebar automatically collapses to its icon rail when the main area falls below 48rem of width.
- Chart and table measurements read CSS values, not hard-coded pixels.
- Visual regression tests cover all three scales.

Keyboard shortcut for scale: Ctrl/Cmd+Shift+`=` and `-`. Browser zoom keeps working independently.

---

## 5. Layout

### App shell

```text
┌────────────┬──────────────────────────────────────────────────────────┐
│ ▣ Inventory│ ☰  Inventory / Laptops   [ Search  Ctrl K ]  ● Live 🔔 ◐ 👤│  3.5rem navbar
│            ├──────────────────────────────────────────────────────────┤
│ MAIN       │                                                          │
│ ▪ Dashboard│       ┌──────────────────────────────────────────┐       │
│ ▪ Inventory│       │ Laptops                       [+ Add item]│       │
│ ▪ Categories       │ 1,204 items                               │       │
│ ▪ Transfers│       ├──────────────────────────────────────────┤       │
│            │       │                                          │       │
│ INSIGHTS   │       │      Centered content (not full width)   │       │
│ ▪ Predictions      │                                          │       │
│ ▪ Assistant│       │                                          │       │
│            │       └──────────────────────────────────────────┘       │
│ OFFICE     │                                                          │
│ ▪ Team     │                                                          │
│ ▪ Activity │                                                          │
│ ─────────  │                                                          │
│ Quezon City│                                                          │
└────────────┴──────────────────────────────────────────────────────────┘
    15rem                     Main area scrolls independently
```

### Sidebar

| State | Width | Behavior |
|---|---|---|
| Expanded | 15rem | Icons, labels, group titles |
| Rail | 3.5rem | Icons with tooltips, and hover flyouts for sub-items |
| Mobile (under 768px) | Sheet | Slides in over content |

- Toggle by the button or Ctrl/Cmd+B. The choice is remembered.
- The active page has a subtle background and a left accent bar.
- Badges show counts that need action, such as pending transfers.
- Groups can collapse. Bottom section shows the office name, or a platform label for Developers.
- Keyboard: arrow keys move within it, with a skip link to main content.

### Navigation by role

| Group | Developer | Admin | User |
|---|---|---|---|
| Main | Overview, Offices, Accounts | Dashboard, Inventory, Categories, Transfers, Assignments | Dashboard, Inventory, Categories, Transfers, Assignments |
| Insights | Predictions, Assistant, AI Usage | Predictions, Assistant | Predictions, Assistant |
| Oversight | Monitor, Logs, Permissions, Announcements | Team, Activity, Logs, Announcements | My Activity |
| System | Health, Jobs | | |

Items are shown or hidden by effective permission, not fixed role. A granted permission adds the relevant item automatically.

### Navbar

Left to right: sidebar toggle · breadcrumbs · global search · connection indicator · notifications · appearance menu · user menu.

### Page container

Content is centered and has a maximum width, for readability on wide monitors.

| Container | Max width | Used for |
|---|---|---|
| `narrow` | 42rem | Forms, settings |
| `default` | 80rem | Dashboards, details |
| `wide` | 96rem | Data tables, logs |

Gutters are 1rem on phones, 1.5rem on tablets, and 2rem on desktops. Widths are in `rem`, so they follow UI scale, and never exceed the available space. Tables with many columns scroll horizontally **inside** their card, with the first column and actions frozen.

Every page uses one `PageHeader`: title, short description, primary action on the right, and optional tabs or filters beneath.

---

## 6. Motion

Motion explains what changed. It never decorates or delays work.

| Token | Duration | Use |
|---|---|---|
| `--motion-fast` | 120ms | Hover, press, focus |
| `--motion-base` | 180ms | Menus, tooltips, tabs, small reveals |
| `--motion-slow` | 240ms | Dialogs, sheets, sidebar width |

Easing: `cubic-bezier(0.2, 0, 0, 1)` for entering, `cubic-bezier(0.4, 0, 1, 1)` for leaving (exits about 30% faster).

| Moment | Treatment |
|---|---|
| Page navigation | 180ms crossfade through React `<ViewTransition>`. Shell stays still |
| Skeleton to content | Crossfade, with no layout jump |
| Dialog | Fade plus 0.5rem rise |
| Sheet | Slide from edge |
| Sidebar | Width and label fade |
| New table row or live event | Brief highlight that fades over 1.5s |
| Save | Spinner in button, then toast |
| Number changes | Quick count on KPIs only |

Rules:

- Animate `transform` and `opacity`. Sidebar width is the one exception.
- `prefers-reduced-motion`: remove movement, and keep short fades.
- Avoid staggered lists, bounce, parallax, and anything over 300ms.
- Skeleton shimmer is subtle, and static for reduced motion.

---

## 7. shadcn customization

Base: shadcn/ui with Radix primitives. Components live in our repo and we own them.

| Component | Customization |
|---|---|
| **Button** | `loading` state with a stable width. Destructive variant is outlined until confirmed. Primary is limited to one per view area |
| **Input, Select** | Consistent height, inline error slot, optional prefix and suffix for units and currency |
| **Card** | Thin border and a small shadow, optional header actions |
| **Badge** | Status variants with `-subtle` backgrounds and a dot, tied to a status map |
| **Dialog** | Standard sizes, sticky header and footer, and focus returned to the opener |
| **Alert Dialog** | Shared `Confirm` component. Sign-out and every one-click change ask first, and say what will happen. Forms are confirmed by their own submit button |
| **Toast** (Sonner) | Bottom-right. Undo action for reversible operations. Errors persist until dismissed |
| **Sidebar** | shadcn sidebar with rail and our groups |
| **Command** | Global palette with permission-aware results |
| **Tooltip** | 300ms delay, one line |
| **Chart** | Recharts through shadcn charts, themed, with accessible data-table fallback |

**Added components:** DataTable, DynamicField, PageHeader, PageContainer, StatCard, EmptyState, ErrorState, AccessDenied, OfflineBanner, LiveIndicator, StaleBadge, AuditDiff, ConflictDialog, PermissionMatrix, ColumnBuilder, ForecastChart, CitationChip, ChatPanel.

---

## 8. Data tables

The most-used part of the product. One `DataTable` runs everywhere.

```text
┌──────────────────────────────────────────────────────────────┐
│ [Search…] [Status ▾] [Location ▾] [+ Filter]   [Columns] [⋯] │
│ Status: Active ✕   Clear all                                 │
├──┬─────────────────┬──────────┬───────┬─────────┬───────────┤
│☐ │ Name ↑          │ SKU      │   Qty │ Status  │        ⋯  │
├──┼─────────────────┼──────────┼───────┼─────────┼───────────┤
│☐ │ ThinkPad T14    │ IT-00412 │    12 │ ● Active│        ⋯  │
├──┴─────────────────┴──────────┴───────┴─────────┴───────────┤
│ 1–25 of 1,204     Rows [25 ▾]        ‹ 1 2 3 … 49 ›          │
└──────────────────────────────────────────────────────────────┘
```

- **Server-side everything:** sorting, filtering and pagination, with 25, 50 or 100 rows per page.
- **State in the URL:** filters, sort and page survive reload, the back button, and sharing a link.
- **Logs and ledgers:** Previous/Next pagination with no total, which stays fast at millions of rows.
- **Stable refreshing:** while new data loads, current rows dim slightly, instead of being replaced by a skeleton. The first load uses a skeleton.
- **Columns:** show/hide, reorder and resize, remembered per user and category. Custom columns appear automatically from their definitions.
- **Density:** comfortable or compact row height per table, independent of UI scale.
- **Selection and bulk actions:** a bar appears with count and available actions.
- **Row actions:** a `⋯` menu showing only permitted actions, and clicking a row opens details.
- **Phones:** rows become stacked cards showing key fields.
- **Keyboard:** arrow keys move between rows, Enter opens, Space selects.
- **Accessibility:** proper table markup, `aria-sort`, and page changes announced by screen readers.

---

## 9. Forms

- One column, in a `narrow` container, with labels above fields. Related fields can sit side by side at wider sizes.
- Validation on blur and on submit, with the same Zod schema as the server. Server errors appear on their field.
- Required fields are marked, or optional ones where most are required.
- On error, focus moves to the first problem, and a summary appears for long forms.
- Unsaved changes prompt before leaving, and long forms save a draft locally.
- The submit button shows progress and blocks double submission. Actions are labeled by what they do: "Add item", not "Submit".

### Custom column builder

Used to create rich, office-specific categories (PRD FR-CAT).

```text
┌ Laptops: Columns ─────────────────────────────┬ Preview ───────┐
│ ⠿ RAM          Integer   GB    Required  ✎ ✕ │ RAM (GB) *     │
│ ⠿ CPU          Short text      Required  ✎ ✕ │ [ 16        ]  │
│ ⠿ Warranty end Date                      ✎ ✕ │ CPU *          │
│ ⠿ OS           Select                    ✎ ✕ │ [ i7-1365U  ]  │
│ [+ Add column]                               │                │
└──────────────────────────────────────────────┴────────────────┘
```

Drag or keyboard to reorder, an editor per type, a live preview of the item form, and clear warnings if a change affects existing items. `DynamicField` renders each column type, so every form and filter comes from one source.

---

## 10. Essential states

Every data region defines all of these. A screen isn't done until it does.

| State | Treatment |
|---|---|
| **Loading (first)** | Skeleton matching the final shape. Show after 150ms and hold at least 300ms, so it doesn't flicker |
| **Refreshing** | Existing content stays, with a thin top progress bar |
| **Empty, nothing yet** | Icon, one sentence, and the next action ("Create your first category") |
| **Empty, no results** | "No items match" with a clear-filters button |
| **Error** | What failed, a Retry button, and a reference ID for support. Other widgets keep working |
| **No permission** | `AccessDenied`: what's needed, and who to ask |
| **Not found** | Plain page with a way back. Other offices' records look the same |
| **Offline** | See below |
| **Rate limited** | "Too many requests. Try again in 12s" with a live countdown; retry enabled when it ends |
| **Conflict** | Comparison of your changes and theirs, then pick which to keep |
| **Maintenance** | Friendly page with expected return time |

### No network

```text
┌──────────────────────────────────────────────────────────────┐
│ ⚠ You're offline. Showing data from 10:42. Changes are paused.│
└──────────────────────────────────────────────────────────────┘
```

| Stage | Behavior |
|---|---|
| **Detection** | Browser offline event plus a health check, because `navigator.onLine` alone can be wrong. A 2-second grace period ignores short blips |
| **While offline** | Amber banner slides down, the navbar indicator changes, data stays visible with its timestamp, and save buttons are disabled with an explanatory tooltip |
| **Typed work** | Stays in the form. Nothing is lost |
| **Navigation** | Waits, with a skeleton and "Waiting for connection" |
| **Server unreachable** | Same pattern, with different text: "Can't reach the server" |
| **Reconnect** | Banner turns green ("Back online") for 3 seconds, data refreshes, and the live feed catches up |
| **Full page load offline** | Static `/offline` page with a retry, and no private data |

The navbar **connection indicator** has three states: `● Live`, `◐ Reconnecting`, `○ Offline`, each with a label, not just color.

### Skeletons

The reusable set in `components/skeletons/`: KPI card, chart, table (matching rows and columns), detail page, and form. Each has the same dimensions as what it replaces, which avoids layout shift. Each section of a page loads independently, and the shell is never replaced by a skeleton.

---

## 11. Key screens

### Dashboards

```text
┌─ Good morning, Maria ──────────────────────────  Last 30 days ▾ ┐
│ ┌ Total items ┐ ┌ Stock value ┐ ┌ Low stock  ┐ ┌ Predicted out ┐│
│ │ 12,480 +2%  │ │ ₱4.2M       │ │ 18         │ │ 7 in 14 days  ││
│ └─────────────┘ └─────────────┘ └────────────┘ └───────────────┘│
│ ┌ Stock movement ─────────────────┐ ┌ Needs attention ─────────┐│
│ │             chart               │ │ ▲ Toner runs out in 12d  ││
│ │                                 │ │ ⇄ Transfer awaiting you  ││
│ └─────────────────────────────────┘ │ ⏰ 3 returns overdue      ││
│ ┌ Live activity ──────────────────┐ └──────────────────────────┘│
│ │ ● Juan updated ThinkPad T14 ·2m │                             │
│ └─────────────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

| Role | Emphasis | Lead widgets |
|---|---|---|
| Developer | System and cross-office | Health, online now, offices at risk, jobs, AI speed and queue, pending requests |
| Admin | Office oversight | KPIs, predictions, live staff activity, pending transfers |
| User | Personal work | My tasks, assigned to me, recent items, announcements, quick actions |

Layout order follows urgency: what needs action comes first, then summaries, then details. Each KPI and attention item links to the filtered list behind it.

### Item details

Header with name, status, and actions; tabs for **Overview** (standard and custom fields), **Stock history**, **Custody**, **Forecast**, and **Activity**.

### Live monitor (Developer, Admin)

A feed of events with filters, pause and resume, and "N new events" rather than shifting content while someone reads. Beside it: people online, grouped by office. Selecting an event opens its before/after details in a side sheet.

### Audit log

A table of time, person, action, record and office. A row opens `AuditDiff`, which shows changed fields only, with old and new values, in color with `+` and `−` markers.

### Permissions

A matrix with permissions by group as rows, and role default plus any override as columns. Choosing an office or person shows the effective result and which rule decided it. Granting opens a form: allow or deny, reason (required), expiry (optional). Pending requests appear at the top.

### Assistant

Available as a right-hand panel via the navbar or Ctrl/Cmd+J, and as a full page. Local AI can be slow, so it shows the queue position ("2 people ahead of you") and a Stop button. It streams its answer, shows steps such as "Looking at stock movements…", and has inline **citation chips** that open the source record. Tables use the standard styling. Starter prompts fit the user's role. A short note says that answers can be wrong and to check the sources. Thumbs up/down sits under each answer.

### Predictions

A table sorted by risk: item, days until stock-out, confidence, suggested reorder. Details show history and forecast, with a shaded range and a plain-language reason. Low confidence and "not enough history" are shown honestly, without implying certainty.

### Notifications

The bell opens a popover with Unread and All, and a link to the full page. Urgent announcements appear as a banner at the top until acknowledged.

### Login

Centered card with the organization logo, an email field that leads to a 6-digit code step, and a line saying access is invitation-only. Rejected sign-ins get a clear message and who to contact, with no technical detail.

---

## 12. Navigation aids

| Shortcut | Action |
|---|---|
| Ctrl/Cmd+K | Command palette: search records, jump to pages, run permitted actions |
| Ctrl/Cmd+B | Toggle sidebar |
| Ctrl/Cmd+J | Open assistant |
| `/` | Focus the table search |
| `g` then `d` / `i` | Go to Dashboard / Inventory |
| `n` | New item, where available |
| `?` | Shortcut list |

Breadcrumbs appear on nested pages. Links open in new tabs normally, because navigation is real links rather than buttons. Tables and tabs keep their state on Back.

---

## 13. Responsive behavior

| Width | Layout |
|---|---|
| Under 768px | Sidebar as sheet, tables as cards, a full-screen assistant and dialogs, and larger touch targets |
| 768–1279px | Sidebar as rail by default, tables scroll within their card |
| 1280px and up | Sidebar expanded, content centered in its container |
| Very wide | Content remains centered, and the margins grow |

---

## 14. Accessibility

Target WCAG 2.2 AA at every theme and scale.

- Everything is usable by keyboard, with a visible 2px focus ring and logical order.
- Semantic HTML first, with Radix handling dialog focus and menu behavior.
- A skip link and one `h1` per page, with an ordered heading structure.
- Live regions announce toasts, live-feed summaries, table updates and offline changes. The live feed doesn't announce every event.
- Charts come with text summaries and a data table alternative.
- Form errors are linked to their fields.
- Motion respects user preference, and nothing flashes.
- `axe` runs in CI, with manual screen-reader passes on key journeys before launch.

---

## 15. Content and formatting

- Plain, direct language: "Add item", "Couldn't save. Your changes are still here." Say what happened and what to do, with no error codes or blame.
- Sentence case for labels and buttons. Use the same word for the same thing: "item", never also "product" or "asset".
- Dates: `2 Nov 2026`, relative for recent ("2 min ago") with the full date on hover. Times are in the viewer's time zone, using the pre-paint method so server rendering doesn't flash. Audit logs always show the exact time.
- Numbers: locale-aware separators. Currency uses the organization's configured currency (the ₱ in mockups is only an example).
- Empty values show `—`.

---

## 16. Definition of done for any screen

- [ ] Uses tokens only, and looks right in light and dark for all themes
- [ ] Works at Compact, Normal and Large
- [ ] Works at phone, tablet and desktop widths
- [ ] Loading, empty, error, no-permission and offline states are present
- [ ] Skeleton matches layout, with no visible layout shift
- [ ] Full keyboard use, and no `axe` violations
- [ ] Only shows actions the user may perform, and the server also enforces them
- [ ] Motion follows tokens, and honors reduced motion
- [ ] URL reflects filter, tab and pagination state
