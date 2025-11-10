# UI Components Review (src/components/ui)

This document summarizes a per-file review of the UI library (Radix + shadcn patterns) and concrete suggestions. Overall, components are solid, well-structured, and accessible by default thanks to Radix. Notes below focus on polish, consistency, and maintainability.

## Key Cross-Cutting Suggestions

- Prefer a single toast system across the app. Standardize on shadcn toasts; remove the Sonner variant (done).
- Ensure icon-only triggers in consuming code include `aria-label`.
- Add brief TSDoc headers to complex components (e.g., `chart.tsx`, `sidebar.tsx`) to document patterns and advanced props.
- For charts and panels, consider honoring `prefers-reduced-motion` in animated transitions (app-level)

## File-by-File Findings

- accordion.tsx
  - Status: Good. Chevron rotation uses data-state.
  - Suggestions: None.

- alert-dialog.tsx
  - Status: Good. Animations and focus handling are correct.
  - Suggestions: In consumers, set clear button labels for confirm/cancel.

- alert.tsx
  - Status: Good.
  - Suggestions: Choose role="status" vs role="alert" in consumers based on urgency.

- aspect-ratio.tsx
  - Status: Good.
  - Suggestions: None.

- avatar.tsx
  - Status: Good.
  - Suggestions: Provide meaningful fallback text in consumers.

- badge.tsx
  - Status: Good.
  - Suggestions: None.

- breadcrumb.tsx
  - Status: Good.
  - Suggestions: Mark current page crumb with `aria-current="page"` (consumer responsibility).

- button.tsx
  - Status: Good; variants and Slot usage are solid.
  - Suggestions: Add `aria-label` on icon-only button uses.

- calendar.tsx
  - Status: Good; DayPicker mapping is comprehensive.
  - Suggestions: Pass locale if needed via props from consumers.

- card.tsx
  - Status: Good.
  - Suggestions: None.

- carousel.tsx
  - Status: Good.
  - Suggestions: If used widely on mobile, verify swipe thresholds and SSR behavior.

- chart.tsx
  - Status: Good; theme-aware CSS vars for Recharts, custom tooltip/legend.
  - Change: displayName set to `ChartContainer` for better debugging (done).
  - Suggestions: Memoize heavy tooltip content if rendering many series.

- checkbox.tsx
  - Status: Good.
  - Suggestions: None.

- collapsible.tsx
  - Status: Good.
  - Suggestions: None.

- command.tsx
  - Status: Good; cmdk dialog integration and consistent styling.
  - Suggestions: For very large lists, consider virtualization.

- context-menu.tsx
  - Status: Good.
  - Suggestions: Ensure labels in consumers.

- dialog.tsx
  - Status: Good.
  - Suggestions: None.

- drawer.tsx
  - Status: Good; Vaul-based.
  - Suggestions: Confirm scroll lock behavior on mobile.

- dropdown-menu.tsx
  - Status: Good.
  - Suggestions: Use descriptive labels in consumers.

- form.tsx
  - Status: Good (RHF helpers).
  - Suggestions: None.

- hover-card.tsx
  - Status: Good.
  - Suggestions: None.

- input-otp.tsx
  - Status: Good; caret and groups are styled.
  - Suggestions: Provide clear instructions and labeling in consumers.

- input.tsx
  - Status: Good.
  - Suggestions: None.

- label.tsx
  - Status: Good.
  - Suggestions: None.

- menubar.tsx
  - Status: Good.
  - Suggestions: None.

- navigation-menu.tsx
  - Status: Good.
  - Suggestions: Confirm touch target spacing in usage.

- pagination.tsx
  - Status: Good.
  - Suggestions: Add aria-labels for Prev/Next in consumers.

- popover.tsx
  - Status: Good.
  - Suggestions: None.

- progress.tsx
  - Status: Good.
  - Suggestions: Provide `aria-valuetext` where helpful in consumers.

- radio-group.tsx
  - Status: Good.
  - Suggestions: Ensure group labels via fieldset/legend or aria-labelledby in consumers.

- resizable.tsx
  - Status: Good; handle component is neat.
  - Suggestions: Consider adding SR instructions (aria-describedby) on handles in consumers.

- scroll-area.tsx
  - Status: Good.
  - Suggestions: None.

- select.tsx
  - Status: Good.
  - Suggestions: Ensure label association in consumers.

- separator.tsx
  - Status: Good.
  - Suggestions: Use `aria-hidden="true"` in decorative contexts.

- sheet.tsx
  - Status: Good.
  - Suggestions: None.

- sidebar.tsx
  - Status: Full-featured provider; mobile-aware; cookie persistence.
  - Change: Restores open/collapsed state from cookie on mount (done).
  - Suggestions: Add prefers-reduced-motion variant for transitions (optional).

- skeleton.tsx
  - Status: Good.
  - Suggestions: None.

- slider.tsx
  - Status: Good.
  - Suggestions: Provide helpful `aria-valuetext` in consumers.

- switch.tsx
  - Status: Good.
  - Suggestions: Ensure label association in consumers.

- table.tsx
  - Status: Good.
  - Suggestions: Use `scope="col"` on th elements in consumer markup.

- tabs.tsx
  - Status: Good.
  - Suggestions: None.

- textarea.tsx
  - Status: Good.
  - Suggestions: None.

- toast.tsx
  - Status: Good; Radix-based toast variants.
  - Suggestions: None.

- toaster.tsx
  - Status: Good; integrates with useToast hook state.
  - Suggestions: None.

- toggle-group.tsx
  - Status: Good; context-driven styling.
  - Suggestions: None.

- toggle.tsx
  - Status: Good.
  - Suggestions: None.

- tooltip.tsx
  - Status: Good; provider exported.
  - Suggestions: None.

- use-toast.ts
  - Status: Good re-export convenience.
  - Suggestions: Use a single import pattern app-wide for consistency.

## Implemented Changes

- Removed unused `src/components/ui/sonner.tsx` to standardize on shadcn toasts.
- Chart: set `ChartContainer.displayName = "ChartContainer"` for clearer stack traces.
- Sidebar: restore open/collapsed state from cookie on mount in uncontrolled mode.

## Suggested Next Steps

- Add short TSDoc headers to `chart.tsx` and `sidebar.tsx` explaining config/theme mapping and provider usage.
- Consider `prefers-reduced-motion` CSS to reduce animation in Accordions/Sidebar if needed.
- Audit consuming code for icon-only buttons and add `aria-label` where missing.

