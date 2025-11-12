# Clearing Simulator Data Residue

Follow these steps to remove stale messages from the MQTT broker so the app stops showing data from `test-simulator.cjs`.

## Prerequisites
- Broker host/port (e.g., `mqtt://localhost:1883`).
- Home ID used by the app and devices (default `home1`).
- List of simulator device IDs (see `test-simulator.cjs`, e.g., `device_001`).
- Node.js installed (needed to run the helper script).

## Steps
1. **Stop the simulator**
   - Ensure `node test-simulator.cjs` is not running so it cannot republish retained data.

2. **Confirm the app is pointing at the same broker/home**
   - In the UI go to `Settings -> MQTT Connection` and verify the Broker URL matches your actual broker.
   - In the browser console you can inspect `localStorage.getItem("homeId")`; update the UI if it differs from your device firmware.

3. **Clear retained MQTT payloads**
   - From the project root run the helper script, replacing placeholders as needed:
     ```bash
     node scripts/clear-retained.cjs --broker mqtt://localhost:1883 --home home1 --devices device_001,device_002
     ```
   - The script publishes zero-length retained messages to `home/<homeId>/sensor/<deviceId>/(power|energy)` topics, wiping the simulator readings.

4. **(Optional) Fetch device IDs from the backend**
   - If you do not know the IDs but the backend has them, you can pass a base URL instead of `--devices`:
     ```bash
     node scripts/clear-retained.cjs --broker mqtt://localhost:1883 --home home1 --from-backend http://localhost:4000
     ```
   - Requires a valid session so the script can call `/api/devices`.

5. **Verify topics are empty**
   - Subscribe with `mosquitto_sub -h <host> -t "home/#" -v` and make sure no retained payloads are printed for the cleared devices.

6. **Reload the app and clear local cache**
   - In the UI click `Settings -> Clear All Data` (this only wipes localStorage but avoids mixing with stale client data).
   - Refresh the browser. You should now see only live readings from physical devices.

7. **Bring devices back online**
   - Power up real devices; confirm new MQTT messages appear and the dashboard updates without simulator values.

## Troubleshooting
- If the script exits with "No devices provided", double-check the `--devices` list or use `--from-backend`.
- If the app still shows simulator devices, ensure no other broker instance still has retained payloads and that the Broker URL in settings matches the instance you cleared.
