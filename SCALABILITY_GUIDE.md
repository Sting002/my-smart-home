# Scalability Implementation Guide

This guide explains the server-side scalability features that move critical functionality from client-side localStorage to a persistent backend.

## Overview

The scalability implementation includes:

1. **Persistent Timeseries Storage** - All MQTT sensor data stored in SQLite
2. **Server-Side Rule Engine** - Automations evaluated on backend, work 24/7
3. **Centralized Alert System** - Alerts stored and queryable from database
4. **Historical Analytics** - Unlimited history with aggregation support
5. **Multi-Device Sync** - All clients share the same backend state

## Architecture Changes

### Before (Client-Only)
- MQTT messages → Browser localStorage (120 point limit)
- Rules evaluated in browser every 30s (only when open)
- Alerts stored in localStorage (cleared on refresh)
- No multi-device sync

### After (Hybrid Client-Server)
- MQTT messages → Backend subscriber → SQLite database (unlimited)
- Rules stored in database, evaluated by backend worker (always running)
- Alerts persisted in database with acknowledgment tracking
- All clients fetch from same backend API

## Database Schema

### New Tables

**power_readings** - Timeseries power measurements
```sql
- device_id, home_id, timestamp, watts, voltage, current
- Indexed by (device_id, timestamp) and (home_id, timestamp)
```

**energy_readings** - Cumulative energy readings
```sql
- device_id, home_id, timestamp, wh_total
```

**rules** - Automation rules
```sql
- id, user_id, home_id, name, enabled, conditions (JSON), actions (JSON)
```

**alerts** - Alert history
```sql
- id, home_id, device_id, timestamp, severity, message, type, acknowledged
```

**daily_stats** - Pre-aggregated statistics
```sql
- device_id, home_id, date, total_kwh, avg_watts, max_watts, min_watts, cost
```

## Backend Services

### MQTT Subscriber (`services/mqttSubscriber.cjs`)

Connects to MQTT broker and persists all telemetry to database.

**What it does:**
- Subscribes to `home/{homeId}/sensor/+/power`
- Subscribes to `home/{homeId}/sensor/+/energy`
- Subscribes to `home/{homeId}/event/alert`
- Stores all messages in respective database tables
- Runs continuously alongside Express server

**Configuration:**
```env
MQTT_BROKER_URL=mqtt://localhost:1883
HOME_ID=home1
```

### Rule Engine (`services/ruleEngine.cjs`)

Evaluates automation rules and executes actions.

**What it does:**
- Fetches all enabled rules from database every 30 seconds (configurable)
- Evaluates conditions (power thresholds, time of day, device state, etc.)
- Executes actions (turn devices on/off, create alerts, run scenes)
- Publishes MQTT commands for device control
- Works even when no browsers are open

**Supported Conditions:**
- `power_threshold` - Device power above/below threshold
- `time_of_day` - Time range check (e.g., 9am-5pm)
- `device_state` - Device on or off
- `energy_threshold` - Total energy usage
- `day_of_week` - Days of week (e.g., weekdays only)

**Supported Actions:**
- `set_device` - Turn device on/off via MQTT
- `alert` - Create database alert with severity
- `scene` - Execute predefined scene (future)

**Configuration:**
```env
RULE_EVAL_INTERVAL_MS=30000
```

## API Endpoints

### History Routes (`/api/history/*`)

**GET /api/history/power/:deviceId**
- Query params: `start`, `end`, `limit`
- Returns: Array of power readings

**GET /api/history/energy/:deviceId**
- Query params: `start`, `end`, `limit`
- Returns: Array of energy readings

**GET /api/history/daily-stats**
- Query params: `deviceId`, `startDate`, `endDate`
- Returns: Array of daily aggregated stats

**GET /api/history/alerts**
- Query params: `limit`, `deviceId`, `severity`
- Returns: Array of alerts

**PATCH /api/history/alerts/:id/acknowledge**
- Marks alert as acknowledged

**GET /api/history/stats/power**
- Query params: `deviceId`, `start`, `end`
- Returns: Aggregated statistics (avg, max, min, count)

### Rules Routes (`/api/rules/*`)

**GET /api/rules**
- Returns: All rules for authenticated user

**GET /api/rules/:id**
- Returns: Single rule by ID

**POST /api/rules**
- Body: `{ name, enabled, conditions[], actions[], homeId? }`
- Creates or updates rule
- Returns: `{ ok, id }`

**PATCH /api/rules/:id/toggle**
- Toggles rule enabled/disabled
- Returns: `{ ok, enabled }`

**DELETE /api/rules/:id**
- Deletes rule
- Returns: `{ ok, deleted }`

**POST /api/rules/bulk-delete**
- Body: `{ ids[] }`
- Deletes multiple rules
- Returns: `{ ok, deleted }`

## Frontend Integration

### Custom Hooks

**useServerHistory**
```typescript
import { useServerHistory } from '@/hooks/useServerHistory';

const { history, loading, error } = useServerHistory({
  deviceId: 'device_001',
  timeRange: 3600000, // 1 hour
  refreshInterval: 30000, // 30 seconds
  enabled: true
});
```

**useServerAlerts**
```typescript
import { useServerAlerts } from '@/hooks/useServerAlerts';

const { alerts, loading, error, acknowledge } = useServerAlerts({
  limit: 50,
  severity: 'warning',
  refreshInterval: 60000
});

// Acknowledge an alert
await acknowledge('alert_123');
```

**useServerRules**
```typescript
import { useServerRules } from '@/hooks/useServerRules';

const { rules, loading, addRule, editRule, toggleRule, removeRule } = useServerRules();

// Create a new rule
await addRule({
  name: 'Turn off lights at night',
  enabled: true,
  conditions: [
    { type: 'time_of_day', start: '22:00', end: '06:00' }
  ],
  actions: [
    { type: 'set_device', deviceId: 'living_room_bulb', on: false }
  ]
});

// Toggle rule
await toggleRule('rule_123');

// Delete rule
await removeRule('rule_123');
```

### API Client Methods

```typescript
import { getPowerHistory, getAlerts, getPowerStats } from '@/api/history';
import { getRules, createRule, deleteRule } from '@/api/rules';

// Fetch power history
const readings = await getPowerHistory('device_001', {
  start: Date.now() - 3600000,
  end: Date.now(),
  limit: 1000
});

// Get alerts
const alerts = await getAlerts({ limit: 50, severity: 'danger' });

// Get power statistics
const stats = await getPowerStats('device_001', {
  start: Date.now() - 86400000 // Last 24 hours
});
// Returns: { count, avg_watts, max_watts, min_watts, on_readings }
```

## Migration Strategy

### Phase 1: Backend Setup (Done)
✅ Database schema extended with new tables
✅ MQTT subscriber service created
✅ Rule engine service created
✅ API routes for history and rules added
✅ Frontend hooks and API clients created

### Phase 2: Gradual Frontend Migration (Next)
1. Keep existing localStorage functionality as fallback
2. Add feature flag to enable/disable server-side features
3. Update components to use new hooks alongside existing ones
4. Test with both modes enabled

### Phase 3: Data Migration
1. Create migration script to export localStorage data
2. Import existing rules/alerts into database via API
3. Verify data consistency

### Phase 4: Full Cutover
1. Remove localStorage-only code paths
2. Make server-side the default and only mode
3. Clean up deprecated hooks and utilities

## Configuration

### Backend Environment Variables

```env
# Required
PORT=4000
NODE_ENV=development
MQTT_BROKER_URL=mqtt://localhost:1883
HOME_ID=home1
JWT_SECRET=your_secret_here

# Optional
RULE_EVAL_INTERVAL_MS=30000  # Rule evaluation frequency
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
```

### Starting Services

```bash
# Backend (with services)
cd Backend
npm start

# You should see:
# ✅ Backend MQTT subscriber connected
# ✅ Rule engine connected to MQTT broker
# ✅ Rule engine running (eval every 30s)
```

## Benefits

### Unlimited History
- No more 120-point limit
- Query any time range
- Historical analysis and trending

### 24/7 Automations
- Rules run even when browsers closed
- Server-side scheduling
- More reliable automation execution

### Multi-Device Sync
- All clients see same data
- Changes propagate instantly
- Consistent state across devices

### Advanced Analytics
- Pre-computed daily statistics
- Faster dashboard loading
- Complex queries on historical data

### Scalable Alert System
- Alert history never lost
- Acknowledgment tracking
- Filterable by device/severity

## Troubleshooting

### Services Not Starting

**Check MQTT broker URL:**
```bash
# Test connectivity
mosquitto_sub -h localhost -p 1883 -t "#" -v
```

**Check database:**
```bash
# Verify tables exist
cd Backend
npm run db:inspect
```

### No Data Being Stored

**Check backend logs:**
- Should see "📊 Power: device_id = XXW" messages
- Verify MQTT subscriber connected

**Check MQTT messages:**
```bash
# Subscribe to all topics
mosquitto_sub -h localhost -p 1883 -t "home/#" -v
```

### Rules Not Executing

**Check rule engine logs:**
- Should see "✅ Rule triggered: [name]" when conditions met
- Verify rules are enabled in database

**Test rule manually:**
```bash
# Create test rule via API
curl -X POST http://localhost:4000/api/rules \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","enabled":true,"conditions":[],"actions":[]}'
```

### Frontend Not Fetching Data

**Check authentication:**
- Ensure user is logged in
- Check browser console for 401 errors

**Check CORS:**
- Verify CORS_ORIGINS includes your frontend URL
- Check browser console for CORS errors

## Performance Considerations

### Database Indexes
All tables have appropriate indexes for common queries:
- `(device_id, timestamp)` for time-range queries
- `(home_id, timestamp)` for multi-device queries

### Query Limits
Default limits prevent overwhelming responses:
- Power/energy history: 1000 points default
- Alerts: 50 default
- All limits configurable via query params

### Data Retention
Consider implementing cleanup jobs for old data:

```javascript
// Example: Delete power readings older than 30 days
db.run(`DELETE FROM power_readings 
        WHERE timestamp < ?`, 
        [Date.now() - (30 * 24 * 60 * 60 * 1000)]);
```

### Aggregation Strategy
Daily stats table pre-computes common metrics:
- Reduces real-time computation load
- Faster dashboard loading
- Can be generated via scheduled job

## Next Steps

1. **Enable Backend Services**: Start backend with `npm start`
2. **Verify MQTT Connection**: Check logs for successful connection
3. **Test History API**: Use browser or curl to fetch power history
4. **Create Test Rules**: Use API or frontend to create automation rules
5. **Monitor Execution**: Watch backend logs for rule evaluations
6. **Migrate Existing Data**: Export from localStorage, import to backend

## Example Rule Configurations

### Auto Off at Night
```json
{
  "name": "Auto off lights at midnight",
  "enabled": true,
  "conditions": [
    { "type": "time_of_day", "start": "00:00", "end": "00:01" }
  ],
  "actions": [
    { "type": "set_device", "deviceId": "living_room_bulb", "on": false }
  ]
}
```

### High Power Alert
```json
{
  "name": "Alert on high power usage",
  "enabled": true,
  "conditions": [
    { "type": "power_threshold", "deviceId": "heater", "operator": ">", "threshold": 1500 }
  ],
  "actions": [
    { "type": "alert", "severity": "warning", "message": "Heater using over 1500W" }
  ]
}
```

### Weekday Morning Scene
```json
{
  "name": "Weekday morning lights",
  "enabled": true,
  "conditions": [
    { "type": "day_of_week", "days": [1, 2, 3, 4, 5] },
    { "type": "time_of_day", "start": "07:00", "end": "07:01" }
  ],
  "actions": [
    { "type": "set_device", "deviceId": "bedroom_light", "on": true },
    { "type": "set_device", "deviceId": "kitchen_light", "on": true }
  ]
}
```
