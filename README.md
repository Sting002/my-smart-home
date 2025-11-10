# Smart Home Energy Monitor

A real-time energy dashboard for ESP32-based devices using MQTT over WebSockets. Includes onboarding, device management, scenes/automations, insights, and a settings area with data import/export.

This README reflects the current system behavior and features.

## Features

- Real-time power monitoring with gauges and charts (Recharts)
- Devices list and detail views with on/off control and live status (instant UI response on toggles)
- Scenes and Automations: built-in quick scenes (Away, Sleep, Workday, Weekend), custom scenes, and rule builder
- Standby Kill (idle auto-off): turn devices off after below-threshold usage for N minutes
- Device Health Alerts: detect devices “offline” if no readings for 5+ minutes
- Budget Alerts: toast at 75/90/100% of daily budget (derived from monthly budget)
- Time-of-Use Pricing (optional): peak/off-peak prices with configurable off-peak window
- Essential Devices: mark devices that should remain on during Away/Sleep/Workday scenes
- Insights: today power/energy trend (smoothed), device breakdown, projected cost
- Alerts: listens for `event/alert` messages and shows recent alerts on the dashboard
- Settings: MQTT broker URL, currency/tariff, TOU + budget, export/import JSON, clear local data
- Authentication (optional): login/logout backed by `/api` endpoints when available

## Prerequisites

- Node.js 18+ and npm
- MQTT Broker with WebSocket listener (Mosquitto recommended)
- ESP32 devices with current/voltage sensing (e.g., INA219, HLW8012)
- Optional backend API at `http://localhost:4000` implementing `/api/*` routes

## Quickstart

1) Install dependencies

```bash
npm install
```

2) Start an MQTT broker with WebSockets

Mosquitto example (`/etc/mosquitto/mosquitto.conf`):

```
listener 1883
protocol mqtt

listener 9001
protocol websockets
```

Start:

```bash
mosquitto -c /etc/mosquitto/mosquitto.conf
```

Default client URL used by the app is `ws://localhost:9001/mqtt` (configurable in Settings and `.env`).

3) Run the app

```bash
npm run dev
```

Open http://localhost:8080 (Vite dev server is configured to port 8080).

4) First-run flow

- Sign in at `/login` if backend auth is enabled; otherwise proceed.
- Complete onboarding at `/onboarding`: enter your broker WebSocket URL and connect.
- Go to Dashboard. Devices will appear automatically as they publish MQTT, or add one manually via Devices -> Add Device.

5) Publish test data (simulator)

- Install dependency (once): `npm i mqtt`
- Run the simulator (Node):

```
node ./test-simulator.cjs --broker mqtt://localhost:1883 --home home1
```

- PowerShell (Windows) using env vars:

```
$env:BROKER_URL='mqtt://localhost:1883'; $env:HOME_ID='home1'; node .\test-simulator.cjs
```

## MQTT Topics

- Sensor power -> app: `home/{homeId}/sensor/{deviceId}/power`
  - JSON: `{ ts: number, watts: number, voltage?: number, current?: number }`
  - `ts` is in milliseconds. Device is considered ON if watts > 5.
- Sensor energy -> app: `home/{homeId}/sensor/{deviceId}/energy`
  - JSON: `{ ts?: number, wh_total: number }`
  - UI computes kWh today as `wh_total / 1000`.
- App -> device command: `home/{homeId}/cmd/{deviceId}/set`
  - JSON: `{ on: boolean }`
- Alerts -> app: `home/{homeId}/event/alert`
  - JSON: `{ ts: number, deviceId?: string, severity: "info"|"warning"|"danger", message: string, type?: string }`

Tip: deleting a device or using Settings -> Clear All Data attempts to clear retained power/energy topics by publishing zero-length retained payloads.

Home/Settings inputs used by business logic are persisted in localStorage: `monthlyBudget`, `touEnabled`, `touPeakPrice`, `touOffpeakPrice`, `touOffpeakStart`, `touOffpeakEnd`.

## Routes

- `/dashboard` — overview, All Off, top consumers, recent alerts
- `/devices` — list, filter/sort, Add Device, navigate to details
- `/device/:deviceId` - live chart, thresholds, delete
  - Device detail includes an Edit button to change name/room/type, thresholds, and to mark as Essential.
- `/automations` — quick scenes + custom scenes + rule builder
- `/insights` — trends, breakdown, KPIs
- `/settings` — profile, tariff/currency, MQTT broker URL, import/export, clear data, logout
- `/onboarding` — first-run broker connection
- `/login` — optional auth

## Configuration

Environment variables (Vite):

- `VITE_API_BASE` — base URL for API requests (default `/api`, dev proxy points to `http://localhost:4000`)
- `VITE_MQTT_BROKER_URL` - default broker WS URL if none saved (defaults to `ws://localhost:9001/mqtt`)
- `VITE_MAX_CHART_POINTS` - power history points kept in memory (default 120)
- `VITE_DEBUG_MQTT` - set to `true` to log MQTT debug messages

Local storage keys:

- `brokerUrl`, `onboarded`, `homeId`, `currency`, `tariff`
- `devices`, `alerts`, `blockedDevices`, `rules`, `scenes`
- `monthlyBudget`, `touEnabled`, `touPeakPrice`, `touOffpeakPrice`, `touOffpeakStart`, `touOffpeakEnd`

## Backend API (optional)

If a backend is available (dev proxy: see `vite.config.ts`), the app uses cookies + CSRF and expects:

- `GET /api/auth/me` -> `{ user: { id, username } | null }`
- `POST /api/auth/login` with `{ username, password }` -> `{ id, username }`
- `POST /api/auth/logout` -> `{ ok: true }`
- `GET /api/devices` -> `Device[]`
- `POST /api/devices` with `Device` -> `{ ok: boolean }`
- `DELETE /api/devices/:id` -> `{ ok: boolean, deleted?: number }`

The app still works without the backend using localStorage only.

## Scripts

- Clear retained MQTT topics for power/energy:

```bash
npm run mqtt:clear
# or
node scripts/clear-retained.cjs --broker mqtt://localhost:1883 --home home1 --devices device_001,device_002
node scripts/clear-retained.cjs --broker mqtt://localhost:1883 --home home1 --from-backend http://localhost:4000
```

- Start the test simulator (copy/paste):

```bash
npm run sim
```

## Troubleshooting

- MQTT connection: use the top banner and Settings -> Broker URL to reconnect. Ensure port 9001 WebSocket listener is enabled.
- No devices: verify device topics and `homeId`. Use `mosquitto_sub -h localhost -t "home/#" -v`.
- Charts not updating: confirm payloads match schemas and `ts` uses milliseconds.
- Retained data repopulates: use Settings -> Clear All Data or the `mqtt:clear` script.
- App is connected but no simulator data: check that the app’s `homeId` matches the simulator’s `--home` (default `home1`) and that your app WS URL is `ws://localhost:9001/mqtt`.

## License

MIT License
