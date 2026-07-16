# Dashboard Page Overrides

> **PROJECT:** MedData
> **Generated:** 2026-07-16 09:39:55
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1200px (standard)
- **Layout:** Full-width sections, centered content
- **Sections:** 1. Hero headline, 2. Short description, 3. Benefit bullets (3 max), 4. CTA, 5. Footer

### Spacing Overrides

- No overrides — use Master spacing

### Typography Overrides

- DM Sans for headings, controls and descriptive content; Geist Mono for AIC and technical identifiers.
- Long source values and package attributes must wrap; never truncate factual values.

### Color Overrides

- **Strategy:** Use the Minimal Neutral monochrome surfaces and flat shadows; reserve supplied blue chart tokens for restrained status accents.

### Component Overrides

- Use shadcn components and semantic theme variables.
- Keep provenance human-readable by default; hide source IDs and hashes in a collapsed technical disclosure.
- Data metric cards grow with their content and never use `truncate` or `line-clamp` for factual values.

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: clear focus indicators, reduced motion, semantic markup and accessible disclosure controls.
- Touch: 44px targets for primary actions on mobile.
- CTA Placement: Center, large CTA button
