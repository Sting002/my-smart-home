# Business Logic Additions — Details and Benefits

This document explains the implemented business-logic features, why they help, and where the code lives. Export to PDF if needed.

## Standby Kill (Idle Auto-off)
- What: Turns devices OFF automatically when their power draw stays below a per-device Threshold (W) for an Auto-off duration (minutes).
- Why it helps: Saves energy by eliminating vampire/standby loads (e.g., devices left ON but doing no useful work).
- How it works:
  - Set per-device `thresholdW` and `autoOffMins` (Device Detail → Settings or Edit form).
  - Background runner checks every few seconds; if `isOn && watts < thresholdW` for `autoOffMins`, publishes OFF via MQTT.
  - Optimistic UI immediately reflects OFF.
- Code: `src/contexts/EnergyContext.tsx` (background rule runner; `lowSinceRef`).

## Device Health Alerts (Offline Detection)
- What: Emits a warning alert when a device hasn’t sent a reading for > 5 minutes.
- Why it helps: Surfaces failing sensors, Wi‑Fi drops, or power issues early.
- How it works:
  - Track `lastSeen` per device from power messages (or from toggles optimistically).
  - If `Date.now() - lastSeen > 5min`, enqueue a warning alert (debounced per device to 15 minutes).
- Code: `src/contexts/EnergyContext.tsx` (background runner; `offlineNotifiedRef`).

## Budget Alerts (Daily Heuristic)
- What: Toasts when today’s cost reaches ~75%, 90%, and 100% of the daily budget.
- Why it helps: Nudges behavior before overspending.
- How it works:
  - Set `monthlyBudget` in Settings; daily budget is `monthly/30`.
  - Once per minute, multiply today’s kWh by current price (TOU-aware) and compare to daily budget.
- Code: `src/contexts/EnergyContext.tsx` (minute interval effect).

## Time-of-Use (TOU) Pricing
- What: Optional dynamic pricing using peak/off-peak prices with a configurable time window.
- Why it helps: Encourages shifting usage to cheaper off-peak hours.
- How it works:
  - Enable in Settings, set prices and window (`off-peak start/end`).
  - Dashboard “Est. Cost” and budget checks use the active period price.
- Code: `src/pages/Settings.tsx` (fields), `src/pages/Dashboard.tsx` (calc), `src/contexts/EnergyContext.tsx` (budget effect).

## Essential Devices (Scene Safety)
- What: Mark devices as Essential so Away/Sleep/Workday scenes keep them ON by default (e.g., refrigerators).
- Why it helps: Prevents accidental cutoffs for critical appliances.
- How it works:
  - Edit device → check “Essential device”.
  - Built-in scenes compute targets and keep essentials ON.
- Code: `src/pages/DeviceDetail.tsx` (edit form), `src/contexts/EnergyContext.tsx` (scene target computation).

## Immediate Status Responsiveness on Toggle
- What: UI reflects ON/OFF state and online status instantly after user toggles.
- Why it helps: Eliminates the need to refresh; better feedback.
- How it works: Optimistic update sets `isOn`, reduces `watts` on OFF, and bumps `lastSeen`.
- Code: `src/contexts/EnergyContext.tsx` (`toggleDevice`).

## Configuration Keys (localStorage)
- `monthlyBudget`, `touEnabled`, `touPeakPrice`, `touOffpeakPrice`, `touOffpeakStart`, `touOffpeakEnd`
- Adjust via Settings; changes apply immediately and persist across sessions.

