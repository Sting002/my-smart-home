# Smart Home Codebase File Catalog

_All paths are absolute from `C:\Users\hasti\Desktop\my smart home` to satisfy the "full path" requirement._

## Root & Project Docs
- `C:\Users\hasti\Desktop\my smart home\.env.local` - Local-only Vite environment overrides (API base, MQTT defaults, feature toggles) that the SPA reads at build time. Importance: keeps developer secrets/configs outside git while letting each person point the UI at the correct services.
- `C:\Users\hasti\Desktop\my smart home\.gitignore` - Ignore rules for logs, build artifacts, IDE folders, and local env files. Importance: prevents accidental commits of noise or secrets.
- `C:\Users\hasti\Desktop\my smart home\README.md` - High-level feature overview, prerequisites, and MQTT topic conventions. Importance: first-stop documentation for anyone onboarding to the project.
- `C:\Users\hasti\Desktop\my smart home\SETUP_GUIDE.md` - Hardware/firmware walkthrough for bringing ESP32 sensors online with the app. Importance: bridges firmware and frontend expectations so telemetry matches what the UI consumes.
- `C:\Users\hasti\Desktop\my smart home\DEPLOYMENT.md` - Deployment playbook covering static hosting, Nginx, Docker, and broker setup. Importance: ensures production rollouts follow a secure, repeatable process.
- `C:\Users\hasti\Desktop\my smart home\TESTING.md` - Manual and automated testing guidance plus MQTT CLI recipes. Importance: standardizes how features are validated before shipping.
- `C:\Users\hasti\Desktop\my smart home\index.html` - Vite's HTML entry that defines meta tags, favicon, and bootstraps `src/main.tsx`. Importance: controls SEO metadata and root mount target for the SPA.
- `C:\Users\hasti\Desktop\my smart home\postcss.config.js` - PostCSS configuration enabling Tailwind and autoprefixer. Importance: keeps the CSS toolchain wired together when building.
- `C:\Users\hasti\Desktop\my smart home\tailwind.config.ts` - Tailwind theme tokens, dark-mode settings, and animation definitions shared across the UI kit. Importance: enforces design consistency for every component.
- `C:\Users\hasti\Desktop\my smart home\vite.config.ts` - Vite bundler config (React plugin, aliases, dev server, `/api` proxy, HMR tuning). Importance: the glue that makes local development and optimized builds possible.
- `C:\Users\hasti\Desktop\my smart home\eslint.config.js` - ESLint + TypeScript rule set (hooks plugin, refresh guard). Importance: guards code quality and catches errors before runtime.

## Backend (Express + SQLite)
- `C:\Users\hasti\Desktop\my smart home\Backend\.env` - Runtime secrets and overrides for the Node backend (JWT secret, cookie name, CSRF toggle, rate limits, etc.). Importance: isolates sensitive configuration from the code so deployments remain secure.
- `C:\Users\hasti\Desktop\my smart home\Backend\.env.example` - Safe template listing the environment variables the backend expects. Importance: documents required settings for new environments without exposing secrets.
- `C:\Users\hasti\Desktop\my smart home\Backend\smarthome.db` - SQLite data store holding users, devices, and settings in development/demo environments. Importance: persists backend state so the UI can sync across sessions.
- `C:\Users\hasti\Desktop\my smart home\Backend\db.cjs` - Database bootstrapper that opens `smarthome.db` and ensures the `users`, `devices`, and `settings` tables exist. Importance: guarantees schema availability before any route handles requests.
- `C:\Users\hasti\Desktop\my smart home\Backend\server.cjs` - Express 5 server wiring security middleware, CORS, CSRF, routers, and static hosting. Importance: primary entry point for the backend API consumed by the SPA.
- `C:\Users\hasti\Desktop\my smart home\Backend\middleware\auth.cjs` - Custom cookie parser, PBKDF2 password hashing, JWT helpers, and auth guards. Importance: centralizes authentication so every route can trust `req.user`.
- `C:\Users\hasti\Desktop\my smart home\Backend\middleware\csrf.cjs` - Optional CSRF token issuer/validator and status flag. Importance: protects mutating endpoints from cross-site request forgery when enabled.
- `C:\Users\hasti\Desktop\my smart home\Backend\middleware\security.cjs` - Helmet config plus rate limiter shared across the API. Importance: baseline hardening against common web threats.
- `C:\Users\hasti\Desktop\my smart home\Backend\routes\auth.cjs` - `/api/auth/*` router providing register, login, logout, and `me` endpoints backed by SQLite users. Importance: lets the front end gate routes behind authenticated sessions.
- `C:\Users\hasti\Desktop\my smart home\Backend\routes\devices.cjs` - Device CRUD endpoints (list, upsert via POST, delete) with auth enforcement. Importance: keeps the canonical device list in sync between MQTT updates and persisted state.
- `C:\Users\hasti\Desktop\my smart home\Backend\routes\settings.cjs` - Simple key/value settings API used to persist tariffs or other knobs. Importance: provides a server-backed alternative to purely local storage for critical preferences.
- `C:\Users\hasti\Desktop\my smart home\Backend\scripts\inspect-db.cjs` - Utility script to print user rows from SQLite for debugging. Importance: quick smoke-test/inspection tool when diagnosing auth issues.

## Node Automation Scripts
- `C:\Users\hasti\Desktop\my smart home\scripts\clear-retained.cjs` - CLI helper that fetches device IDs (locally or via backend) and clears retained MQTT power/energy topics. Importance: prevents stale telemetry from reappearing after resets.
- `C:\Users\hasti\Desktop\my smart home\scripts\export-pdf.cjs` - Puppeteer-based exporter that prints any HTML page to PDF, e.g., for docs or reports. Importance: gives the team a reproducible way to capture UI reviews without manual printing.

## Public Assets
- `C:\Users\hasti\Desktop\my smart home\public\robots.txt` - Friendly crawler policy that whitelists major bots and default agents. Importance: prevents accidental blocking of previews or link unfurls for the marketing site.
- `C:\Users\hasti\Desktop\my smart home\public\placeholder.svg` - Default high-resolution SVG used for favicons/illustrations when no brand asset is available. Importance: ensures the app always has a fallback graphic referenced in `index.html`.

## Frontend Entry & Global Styles
- `C:\Users\hasti\Desktop\my smart home\src\main.tsx` - Vite bootstrap that mounts `<App />` into `#root` and pulls in global styles. Importance: ties the React tree to the DOM and kicks off rendering.
- `C:\Users\hasti\Desktop\my smart home\src\App.tsx` - Top-level router/provider composition (BrowserRouter, AuthProvider, EnergyProvider, nested routes). Importance: orchestrates which providers wrap which segments and enforces protected/public flows.
- `C:\Users\hasti\Desktop\my smart home\src\App.css` - Legacy Vite starter styles kept for reference/demo surfaces. Importance: still referenced by some demo components; removing or editing requires awareness.
- `C:\Users\hasti\Desktop\my smart home\src\index.css` - Tailwind base layer plus CSS custom properties for light/dark themes and markdown styling. Importance: global design foundation for every page and component.
- `C:\Users\hasti\Desktop\my smart home\src\vite-env.d.ts` - Type declarations for `import.meta.env` keys used throughout the app. Importance: gives TypeScript awareness of environment variables to prevent typo bugs.

## API & Service Layer
- `C:\Users\hasti\Desktop\my smart home\src\api\client.ts` - Typed fetch wrapper that handles base URL resolution, CSRF headers, JSON parsing, and error shaping. Importance: consolidates HTTP behavior so every API call is consistent and secure.
- `C:\Users\hasti\Desktop\my smart home\src\api\csrf.ts` - CSRF token caching/fetching utilities. Importance: allows state-changing requests to satisfy backend CSRF protections without duplicating logic.
- `C:\Users\hasti\Desktop\my smart home\src\api\devices.ts` - High-level device API helpers (list, upsert, delete). Importance: keeps UI code small and readable when talking to the backend.
- `C:\Users\hasti\Desktop\my smart home\src\services\mqttService.ts` - Singleton MQTT client abstraction (connect lifecycle, subscription registry, publish helpers, status listeners). Importance: the nerve center for all real-time energy data and command traffic.

## Contexts & Shared Types
- `C:\Users\hasti\Desktop\my smart home\src\contexts\AuthContext.ts` - Barrel that re-exports the auth provider/hook/context. Importance: simplifies imports for auth consumers.
- `C:\Users\hasti\Desktop\my smart home\src\contexts\AuthProvider.tsx` - React provider that hydrates the logged-in user, exposes `login/logout`, and gates children until the session is ready. Importance: ensures auth state is consistent everywhere.
- `C:\Users\hasti\Desktop\my smart home\src\contexts\auth-context.ts` - Pure context plus type definitions for the auth subsystem. Importance: source of truth for auth typing to avoid drift.
- `C:\Users\hasti\Desktop\my smart home\src\contexts\useAuth.ts` - Convenience hook that enforces usage inside `<AuthProvider>`. Importance: gives components access to auth state with runtime safety.
- `C:\Users\hasti\Desktop\my smart home\src\contexts\EnergyContext.tsx` - Provider orchestrating MQTT, devices, alerts, history, automation hooks, and toast notifications. Importance: central hub for live energy data and actions; most pages depend on it.
- `C:\Users\hasti\Desktop\my smart home\src\contexts\ThemeContext.ts` - Minimal context describing the theme API (light/dark/system). Importance: typed contract for theme toggling logic.
- `C:\Users\hasti\Desktop\my smart home\src\contexts\AppContext.tsx` - Simple provider managing layout concerns like sidebar open state. Importance: keeps UI chrome state out of individual pages.
- `C:\Users\hasti\Desktop\my smart home\src\lib\utils.ts` - `cn` helper (clsx + tailwind-merge). Importance: prevents conflicting class names across the component library.
- `C:\Users\hasti\Desktop\my smart home\src\utils\appContextTypes.ts` - Type definitions for `AppContext`. Importance: keeps context shape explicit and reusable.
- `C:\Users\hasti\Desktop\my smart home\src\utils\appContextUtils.ts` - Placeholder utilities/constants for future app-context additions. Importance: single spot to expand shared app-level helpers.
- `C:\Users\hasti\Desktop\my smart home\src\utils\energyContextTypes.ts` - Types for `Device`, `Alert`, history maps, and the energy context contract. Importance: underpins nearly every energy-related hook and component.
- `C:\Users\hasti\Desktop\my smart home\src\utils\energyContextUtils.ts` - Factory for creating normalized `Device` records. Importance: avoids inconsistent defaults when seeding devices from MQTT or forms.
- `C:\Users\hasti\Desktop\my smart home\src\utils\energyCalculations.ts` - Formatting and math helpers (watts to kW, cost projections, efficiency). Importance: keeps numerical logic consistent across charts, cards, and alerts.

## Custom Hooks
- `C:\Users\hasti\Desktop\my smart home\src\hooks\useEnergyState.ts` - Manages persistent energy state slices (devices, alerts, history, preferences) with localStorage hydration. Importance: underlies `EnergyContext` and keeps data across reloads.
- `C:\Users\hasti\Desktop\my smart home\src\hooks\useAutomationRunner.ts` - Interval-driven automation engine evaluating rules, firing MQTT commands, and raising toasts. Importance: enforces automation/budget behaviors even when no backend workflow exists.
- `C:\Users\hasti\Desktop\my smart home\src\hooks\useBudgetAlerts.ts` - Polls usage vs monthly budget and emits toast notifications at 75/90/100 percent. Importance: keeps users aware of cost overruns without any backend processing.
- `C:\Users\hasti\Desktop\my smart home\src\hooks\useMQTTDevice.ts` - Subscribes to per-device MQTT topics and updates local state accordingly. Importance: attaches detail pages to live telemetry streams.
- `C:\Users\hasti\Desktop\my smart home\src\hooks\useMqttLifecycle.ts` - Connect/disconnect lifecycle hook that keeps `mqttService` in sync with onboarding settings and exposes connection status. Importance: guarantees one central place controls the MQTT connection.
- `C:\Users\hasti\Desktop\my smart home\src\hooks\useMqttSubscriptions.ts` - Handles wildcard MQTT subscriptions for power, energy, and alert topics, piping them into React state. Importance: transforms raw telemetry into UI-ready state while enforcing history limits.
- `C:\Users\hasti\Desktop\my smart home\src\hooks\useOnboardingConfig.ts` - Reads/watches onboarding flags (`brokerUrl`, `onboarded`) from localStorage. Importance: lets guards and settings know when MQTT is configured.
- `C:\Users\hasti\Desktop\my smart home\src\hooks\useTheme.ts` - Hook wrapper around `ThemeContext`. Importance: gives components typed access to theme state.
- `C:\Users\hasti\Desktop\my smart home\src\hooks\use-toast.ts` - Headless toast state machine powering the notification system. Importance: decouples toast management from UI components.
- `C:\Users\hasti\Desktop\my smart home\src\hooks\use-mobile.tsx` - Media-query hook that flags when the viewport is below the mobile breakpoint. Importance: many layout primitives (for example, the sidebar) adapt based on this hook.

## Routing Guards
- `C:\Users\hasti\Desktop\my smart home\src\routes\ProtectedRoute.tsx` - Ensures auth readiness, enforces onboarding completion, and redirects unauthorized users to `/login` or `/onboarding`. Importance: protects every authenticated route behind consistent logic.
- `C:\Users\hasti\Desktop\my smart home\src\routes\PublicRoute.tsx` - Inverse guard that kicks already-authenticated users away from `/login`. Importance: prevents flashing the login screen once a session exists.

## Page Components
- `C:\Users\hasti\Desktop\my smart home\src\pages\Index.tsx` - Legacy entry that wraps `AppLayout` in `AppProvider`; kept for compatibility. Importance: useful when embedding the layout elsewhere or when SSR needs a simple entry.
- `C:\Users\hasti\Desktop\my smart home\src\pages\Login.tsx` - Credential form that calls `useAuth().login` and handles redirects/errors. Importance: only way to establish a backend session before using protected features.
- `C:\Users\hasti\Desktop\my smart home\src\pages\NotFound.tsx` - 404 screen logging unknown routes and offering a link home. Importance: user-friendly fallback plus diagnostic logging.
- `C:\Users\hasti\Desktop\my smart home\src\pages\Dashboard.tsx` - Main overview showing gauges, top consumers, alerts, and bulk controls (All Off). Importance: primary value prop for end-users monitoring their home.
- `C:\Users\hasti\Desktop\my smart home\src\pages\Devices.tsx` - Device list with filtering, sorting, toggles, and navigation to detail/add forms. Importance: control center for managing every device at a glance.
- `C:\Users\hasti\Desktop\my smart home\src\pages\DeviceDetail.tsx` - Deep dive page with live charts, threshold editing, retention clearing, and delete flows per device. Importance: where technicians tune and troubleshoot individual loads.
- `C:\Users\hasti\Desktop\my smart home\src\pages\AddDevice.tsx` - Zod-backed form that creates new device records and seeds defaults. Importance: smooth onboarding for new sensors without touching MQTT topics manually.
- `C:\Users\hasti\Desktop\my smart home\src\pages\Automations.tsx` - Scenes plus rule builder UI that persists automations to localStorage and coordinates with MQTT. Importance: empowers users to create custom automations without coding.
- `C:\Users\hasti\Desktop\my smart home\src\pages\Insights.tsx` - Recharts-driven analytics (trend lines, breakdown pie, KPIs, recommendations). Importance: translates collected telemetry into actionable insights and cost projections.
- `C:\Users\hasti\Desktop\my smart home\src\pages\Settings.tsx` - Consolidated settings hub (home ID, currency, tariffs, TOU, broker URL, export/import, logout). Importance: only UI for configuring pricing, MQTT connectivity, and data hygiene.
- `C:\Users\hasti\Desktop\my smart home\src\pages\Onboarding.tsx` - First-run wizard prompting for MQTT WebSocket URL and validating connectivity before unlocking the app. Importance: enforces that telemetry plumbing exists before entering protected routes.

## Layout & Reusable Components
- `C:\Users\hasti\Desktop\my smart home\src\components\AppLayout.tsx` - Global shell with connection banner, toaster, outlet container, and bottom navigation. Importance: keeps consistent chrome around every authenticated route.
- `C:\Users\hasti\Desktop\my smart home\src\components\BottomNav.tsx` - Mobile-friendly navigation bar with icons for each primary route. Importance: ensures quick navigation on touch devices where sidebars do not fit.
- `C:\Users\hasti\Desktop\my smart home\src\components\ConnectionStatus.tsx` - Toast-like banner showing MQTT connection state in real time. Importance: surfaces connectivity issues immediately so users know why data might be stale.
- `C:\Users\hasti\Desktop\my smart home\src\components\MqttStatus.tsx` - Simple component that renders text-based MQTT status (used in dev tooling). Importance: handy diagnostic readout inside pages or panels.
- `C:\Users\hasti\Desktop\my smart home\src\components\PowerGauge.tsx` - Circular gauge visualizing current aggregate watts vs a max. Importance: the hero visualization on the dashboard.
- `C:\Users\hasti\Desktop\my smart home\src\components\DeviceCard.tsx` - Card showing per-device icon, room, watts, and on/off toggle. Importance: building block for device listings everywhere.
- `C:\Users\hasti\Desktop\my smart home\src\components\AlertBadge.tsx` - Color-coded alert pill summarizing alert severity, message, and timestamp. Importance: reused on the dashboard and detail pages to keep alert UX consistent.
- `C:\Users\hasti\Desktop\my smart home\src\components\theme-provider.tsx` - Client-only provider storing theme preference, syncing with localStorage, and reacting to OS changes. Importance: central to light/dark mode support across the SPA.

## UI Toolkit (part 1)
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\accordion.tsx` - Radix accordion wrapper with styled triggers/content for collapsible sections. Importance: used wherever settings or onboarding content needs show/hide behavior with full accessibility.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\alert-dialog.tsx` - Radix alert dialog implementation with themed buttons for irreversible confirmations. Importance: keeps destructive flows consistent and accessible.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\alert.tsx` - Inline alert component for warning/success/info banners. Importance: gives every page the same status language.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\aspect-ratio.tsx` - Utility to lock child content to a fixed aspect ratio. Importance: prevents layout shift when embedding images or charts.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\avatar.tsx` - Avatar primitives with fallbacks for initials. Importance: reused when showing user or device identity.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\badge.tsx` - Badge component with variants for labeling statuses or device types. Importance: quick visual tagging in tables and cards.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\breadcrumb.tsx` - Accessible breadcrumb trail components. Importance: helpful in multi-step flows such as onboarding.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\button.tsx` - Button primitive plus `buttonVariants` for primary/ghost/etc styles. Importance: foundational action control used everywhere.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\calendar.tsx` - Themed wrapper around `react-day-picker`. Importance: ready-made date picker for scheduling automations.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\card.tsx` - Card container/header/content/footer primitives. Importance: base layout for dashboards and forms.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\carousel.tsx` - Keen-slider integration for swipeable carousels. Importance: supports onboarding or insights sliders when needed.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\chart.tsx` - Context and helpers for Recharts (ChartContainer, tooltip/legend components). Importance: gives charts theme-aware colors and consistent tooltips.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\checkbox.tsx` - Styled Radix checkbox. Importance: ensures toggles meet accessibility and design requirements.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\collapsible.tsx` - Collapsible root/trigger/content primitives. Importance: lightweight alternative to accordion for single sections.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\command.tsx` - Command palette components (a la k-bar). Importance: enables quick-search modals or filter pickers.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\context-menu.tsx` - Right-click/long-press menu primitives. Importance: adds power-user controls to tables or lists without clutter.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\dialog.tsx` - Generic modal dialog wrapper. Importance: base for non-destructive modals such as edit forms.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\drawer.tsx` - Slide-over drawer component tuned for mobile. Importance: reflows complex forms on small screens.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\dropdown-menu.tsx` - Menu primitives for button-triggered menus. Importance: used for overflow actions on device cards and tables.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\form.tsx` - React Hook Form field wrappers with validation messaging. Importance: keeps complex forms (Add Device, Settings) consistent and accessible.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\hover-card.tsx` - Hover-triggered preview card. Importance: shows quick metrics without navigation.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\input-otp.tsx` - Multi-slot input for OTP/pin codes. Importance: ready for MFA or device pairing flows.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\input.tsx` - Styled text input component. Importance: standardizes padding, focus rings, and disabled states.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\label.tsx` - Accessible `<label>` wrapper that coordinates with inputs. Importance: required for screen-reader friendly forms.

## UI Toolkit (part 2)
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\menubar.tsx` - Horizontal menu primitives. Importance: supports future desktop layouts where a menubar is needed.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\navigation-menu.tsx` - Complex navigation component with submenus and indicators. Importance: building block for mega menus if the UI grows.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\pagination.tsx` - Pagination controls with icon buttons. Importance: future-proofs data-heavy tables (devices, logs).
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\popover.tsx` - Anchored popover with arrow support. Importance: used for contextual settings editors.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\progress.tsx` - Radix progress bar styling. Importance: visualizes task completion (exports, onboarding) without custom CSS.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\radio-group.tsx` - Styled radio buttons. Importance: used for mutually exclusive settings such as pricing mode.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\resizable.tsx` - Resizable panel primitives (via `@radix-ui/react-resizable`). Importance: allows multi-pane experiences like split charts.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\scroll-area.tsx` - Custom scrollbar and scrollable container. Importance: keeps scrollbars consistent inside cards and sidebars.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\select.tsx` - Custom select/dropdown component. Importance: used for room/type pickers with keyboard support.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\separator.tsx` - Horizontal/vertical divider. Importance: simple layout utility reused across modals and panels.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\sheet.tsx` - Generic overlay sheet (subset of drawer) for mobile dialogs. Importance: reuses the same transition language as drawers.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\sidebar.tsx` - Comprehensive sidebar system (provider, trigger, menus, skeletons). Importance: powers responsive navigation drawers with persistence and keyboard shortcuts.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\skeleton.tsx` - Animated skeleton loader components. Importance: communicates loading states in dashboards and lists.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\slider.tsx` - Accessible slider input. Importance: used for thresholds and duration inputs in automation rules.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\switch.tsx` - Toggle switch component. Importance: matches native switches for binary settings.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\table.tsx` - Styled table primitives (header, row, cell). Importance: baseline for tabular data such as rule lists.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\tabs.tsx` - Tabs implementation for switching between view modes. Importance: helps condense dense content like insights/breakdowns.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\textarea.tsx` - Styled multi-line text area. Importance: used for notes or JSON import previews.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\toast.tsx` - Radix toast primitives with styling plus close/action buttons. Importance: UI representation of notifications emitted by `use-toast`.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\toaster.tsx` - Host component that renders toasts from the global toast store. Importance: needs to stay mounted near the app root.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\toggle-group.tsx` - Segmented toggle buttons built on Radix toggle-group. Importance: helpful for mode pickers (kW vs cost, day/week/month).
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\toggle.tsx` - Standalone toggle button. Importance: used for icon-only toggles such as view switches.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\tooltip.tsx` - Tooltip primitives with provider/trigger/content. Importance: surfaces explanatory text without taking layout space.
- `C:\Users\hasti\Desktop\my smart home\src\components\ui\use-toast.ts` - Convenience re-export that binds the UI components to the headless `use-toast` hook. Importance: lets consumers import from the UI namespace without knowing about hook internals.
