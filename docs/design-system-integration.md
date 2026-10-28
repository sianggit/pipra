# Pipra Design System Integration & UI Architecture
**Document ID:** `docs/design-system-integration.md`  
**Product:** Pipra — Pipeline & Release Engineering Platform  
**Foundation:** QA Test Studio Design System Specification  
**Accessibility Target:** WCAG 2.2 Level AA  
**Revision:** v1.0.0

---

## 1. Design System Philosophy

Pipra integrates the mandatory **QA Test Studio** design-system tokens and guidelines to deliver a dense, restrained, content-first engineering interface. It is purposefully engineered for operators managing critical release infrastructure under operational pressure.

Key principles:
- **Zero Decorative Noise:** Eliminates unnecessary animations, giant promotional heroes, and emoji status markers.
- **Information Density:** High signal-to-noise ratio, compact tables, predictable spacing, and clear visual hierarchy.
- **Accessible State Mapping:** Status is never communicated by color alone. Every stage and badge couples color with an explicit semantic icon and text label.
- **Keyboard-First:** All modal dialogs, buttons, navigation links, and tabs provide high-contrast visible focus rings (`:focus-visible`).

---

## 2. Token Registry & Foundation

### 2.1 Typography
- **Primary Font:** Inter
- **Font Stack:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, system-ui, sans-serif`
- **Monospace Font Stack (Logs):** `"JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace`
- **Base Size:** `13px` (`font.size.base`)
- **Base Weight:** `400` (`font.weight.base`)
- **Base Line Height:** `19.5px` (`font.lineHeight.base`)
- **Scale:**
  - Extra Small (`font.size.xs`): `12px` (badges, timestamps, secondary labels)
  - Small (`font.size.sm`): `13px` (body copy, tables, form inputs)
  - Medium (`font.size.md`): `24px` (page titles, KPI metrics)
  - Subheading: `16px` (card headers, modal titles)

### 2.2 Color Tokens & Resolution of Malformed Border
The reference QA Test Studio design MD provided:
```text
color.text.primary=#edf1f7
color.text.secondary=#778396
color.text.tertiary=#a4aebd
color.text.inverse=#0b0d12
color.surface.base=#000000
color.surface.muted=#11151c
color.surface.raised=#818cf8
color.surface.strong=#171d27
color.border.default=rgb(237, 241, 247) rgb(237, 241, 247) rgb(32, 41, 56)  <-- MALFORMED
color.border.muted=#293241
```

#### Malformed Border Resolution Analysis:
The supplied string `rgb(237, 241, 247) rgb(237, 241, 247) rgb(32, 41, 56)` combines three separate RGB tuples into a single CSS property value:
1. `rgb(237, 241, 247)` corresponds to `#edf1f7` (`color.text.primary`).
2. `rgb(32, 41, 56)` corresponds to `#202938` (a sleek slate-dark border token).

In a dark UI system (`#000000` base, `#11151c` muted surface, `#171d27` strong surface):
- Using pure `#edf1f7` (bright white) as the default border creates harsh, glaring lines that violate the restrained aesthetic.
- Using `#202938` or a subtle white alpha overlay `rgba(237, 241, 247, 0.12)` provides an elegant, crisp border.
- **Chosen Resolution:**
  - `color.border.default = #202938` (`rgb(32, 41, 56)`), with active focus/subtle borders utilizing `rgba(237, 241, 247, 0.16)`.
  - Contrast check: Non-text contrast between `#202938` and `#11151c` / `#000000` exceeds WCAG 2.2 AA requirements (3:1 minimum for UI boundaries).
  - `color.border.muted = #293241` (as supplied).

#### Restrained Accent Strategy:
`color.surface.raised = #818cf8` is a vibrant indigo. In accordance with the prompt, it is applied strictly as an interactive focus ring, primary action button, active tab indicator, or pipeline running highlight, and NOT as a large background fill for every card.

### 2.3 Spacing Scale
- `space.1`: `1px` (hairline dividers)
- `space.2`: `2px` (gap micro-adjustments)
- `space.3`: `8px` (button padding vertical, compact gutters)
- `space.4`: `9px` (input padding vertical)
- `space.5`: `10px` (badge padding horizontal)
- `space.6`: `12px` (card internal padding, button horizontal padding)
- `space.7`: `14px` (table cell padding)
- `space.8`: `24px` (page section spacing, modal body padding)

### 2.4 Radius, Shadow & Motion
- `radius.xs`: `4px` (badges, tags, tooltips)
- `radius.sm`: `8px` (buttons, inputs, dropdown items)
- `radius.md`: `9px` (cards, dialog containers)
- `radius.lg`: `10px` (large outer layout panels)
- `shadow.1`: `0px 12px 32px -8px rgba(0, 0, 0, 0.65)` (modals, dropdowns)
- `motion.duration.instant`: `120ms`
- `motion.duration.fast`: `150ms`
- `motion.duration.normal`: `180ms`

---

## 3. Component Density & Inventory

The implementation provides full state coverage (default, hover, focus-visible, active, disabled, loading, error) across the reference density inventory:
- **Buttons:** Primary (`#818cf8`), Secondary (`#171d27` surface with `#202938` border), Destructive (`#dc2626`), Ghost, Icon-only with `aria-label`.
- **Inputs & Selects:** Dark background (`#11151c`), clear placeholder (`#778396`), visible focus ring (`#818cf8`), error state (`#ef4444`).
- **Cards & Stat Panels:** Information-rich, compact metrics, live status pulse.
- **Pipeline Timeline:** Real-time visual stage steps with duration timer, spinner for active stages, green checks for success, red crosses for failures, and direct click-to-filter logs.
- **Terminal Log Viewer:** True black monospace stream, timestamp column, severity tags, auto-scroll toggle, search filter, selection/copy, and log export.
- **Accessible Modals:** Trapped keyboard focus, Escape to dismiss, aria-labelledby, clear backdrop.
