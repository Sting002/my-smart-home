# Clearing Retained Data Without Backend Fetch

When `node scripts/clear-retained.cjs --from-backend ...` fails with `Failed to fetch devices from backend: fetch failed` it means the helper could not reach `/api/devices` with a valid session cookie.

## Why it happens
- You ran the script outside the browser session, so no auth cookie accompanies the request.
- `/api/devices` is protected by `requireAuth`, so the backend returns 401/403.

## Workarounds
1. **Pass device IDs explicitly (recommended)**
   ```bash
   node scripts/clear-retained.cjs --broker mqtt://localhost:1883 --home home1 --devices device_001,device_002
   ```
   - Use the IDs from `test-simulator.cjs` or your device list.
   - The script wipes `home/<homeId>/sensor/<deviceId>/(power|energy)` topics even without backend access.

2. **Temporarily expose `/api/devices`**
   - Remove `requireAuth` from `Backend/routes/devices.cjs` or add a short-lived public endpoint, then rerun `--from-backend`.
   - Restore auth immediately afterward.

3. **Manually fetch IDs**
   - Open the web app in a logged-in browser.
   - In dev tools run `fetch('/api/devices').then(r => r.json())` to copy the IDs.
   - Rerun the script with `--devices id1,id2`.

## Verification
- After the script finishes, run `mosquitto_sub -h localhost -t "home/#" -v` to confirm the cleared topics have no retained payload.
- Reload the app and, if needed, use `Settings -> Clear All Data` to remove cached entries.
