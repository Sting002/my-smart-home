# Scalability Features - Integration Example

This document demonstrates how to integrate the new server-side scalability features into your React components.

## Example 1: Device Detail Page with Server History

Replace localStorage-based history with server-side persistent history:

```tsx
// src/pages/DeviceDetail.tsx
import { useServerHistory } from '@/hooks/useServerHistory';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

function DeviceDetailPage({ deviceId }: { deviceId: string }) {
  // New: Fetch unlimited history from server
  const { history, loading, error } = useServerHistory({
    deviceId,
    timeRange: 86400000, // Last 24 hours (no more 120 point limit!)
    refreshInterval: 30000, // Refresh every 30 seconds
    enabled: true
  });

  if (loading) return <div>Loading history...</div>;
  if (error) return <div>Error: {error}</div>;

  // Format data for chart
  const chartData = history.map(reading => ({
    time: new Date(reading.timestamp).toLocaleTimeString(),
    watts: reading.watts,
    voltage: reading.voltage
  }));

  return (
    <div className="p-4">
      <h2>Device Power History (24 Hours)</h2>
      <p className="text-sm text-muted-foreground">
        {history.length} readings stored
      </p>
      
      <LineChart width={800} height={400} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="watts" stroke="#8884d8" />
      </LineChart>
    </div>
  );
}
```

## Example 2: Alerts Dashboard with Acknowledgment

Show persistent alerts with acknowledgment tracking:

```tsx
// src/components/AlertsDashboard.tsx
import { useServerAlerts } from '@/hooks/useServerAlerts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function AlertsDashboard() {
  const { alerts, loading, acknowledge } = useServerAlerts({
    limit: 100,
    refreshInterval: 30000
  });

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledge(alertId);
      console.log('Alert acknowledged');
    } catch (err) {
      console.error('Failed to acknowledge:', err);
    }
  };

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Alerts</h2>
        <Badge variant="secondary">
          {unacknowledgedAlerts.length} unacknowledged
        </Badge>
      </div>

      {loading && <div>Loading alerts...</div>}

      <div className="space-y-2">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`p-4 rounded border ${
              alert.acknowledged ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <Badge
                  variant={
                    alert.severity === 'danger' ? 'destructive' :
                    alert.severity === 'warning' ? 'warning' : 'default'
                  }
                >
                  {alert.severity}
                </Badge>
                <p className="mt-2">{alert.message}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(alert.timestamp).toLocaleString()}
                  {alert.device_id && ` · ${alert.device_id}`}
                </p>
              </div>

              {!alert.acknowledged && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAcknowledge(alert.id)}
                >
                  Acknowledge
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Example 3: Automation Rules Manager

Manage server-side rules with full CRUD operations:

```tsx
// src/pages/AutomationRules.tsx
import { useServerRules } from '@/hooks/useServerRules';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { type CreateRuleRequest } from '@/api/rules';

function AutomationRulesPage() {
  const { rules, loading, addRule, toggleRule, removeRule } = useServerRules();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateRule = async (ruleData: CreateRuleRequest) => {
    try {
      await addRule(ruleData);
      setShowCreateForm(false);
    } catch (err) {
      console.error('Failed to create rule:', err);
    }
  };

  const handleToggle = async (ruleId: string) => {
    try {
      await toggleRule(ruleId);
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this rule?')) return;
    
    try {
      await removeRule(ruleId);
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automation Rules</h1>
          <p className="text-muted-foreground">
            Server-side rules run 24/7, even when browser is closed
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          Create Rule
        </Button>
      </div>

      {loading && <div>Loading rules...</div>}

      <div className="space-y-4">
        {rules.map(rule => (
          <div key={rule.id} className="p-4 border rounded space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{rule.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {rule.conditions.length} condition(s), {rule.actions.length} action(s)
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Enabled</span>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => handleToggle(rule.id)}
                  />
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(rule.id)}
                >
                  Delete
                </Button>
              </div>
            </div>

            {/* Display conditions */}
            <div className="text-sm">
              <strong>Conditions:</strong>
              <ul className="list-disc ml-6 mt-1">
                {rule.conditions.map((cond, i) => (
                  <li key={i}>
                    {cond.type === 'power_threshold' && 
                      `${cond.deviceId}: Power ${cond.operator} ${cond.threshold}W`}
                    {cond.type === 'time_of_day' && 
                      `Time between ${cond.start} and ${cond.end}`}
                    {cond.type === 'device_state' && 
                      `${cond.deviceId} is ${cond.state}`}
                  </li>
                ))}
              </ul>
            </div>

            {/* Display actions */}
            <div className="text-sm">
              <strong>Actions:</strong>
              <ul className="list-disc ml-6 mt-1">
                {rule.actions.map((action, i) => (
                  <li key={i}>
                    {action.type === 'set_device' && 
                      `Turn ${action.deviceId} ${action.on ? 'ON' : 'OFF'}`}
                    {action.type === 'alert' && 
                      `Create ${action.severity} alert: ${action.message}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Create rule form would go here */}
      {showCreateForm && (
        <RuleCreateForm
          onSubmit={handleCreateRule}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}
```

## Example 4: Quick Rule Creation Helper

Simplified API for common automation patterns:

```tsx
// src/utils/ruleHelpers.ts
import { createRule, type CreateRuleRequest } from '@/api/rules';

export async function createAutoOffRule(
  deviceId: string,
  powerThreshold: number,
  durationMinutes: number
) {
  const rule: CreateRuleRequest = {
    name: `Auto-off ${deviceId} below ${powerThreshold}W`,
    enabled: true,
    conditions: [
      {
        type: 'power_threshold',
        deviceId,
        operator: '<',
        threshold: powerThreshold
      }
    ],
    actions: [
      {
        type: 'set_device',
        deviceId,
        on: false
      }
    ]
  };

  return await createRule(rule);
}

export async function createNightModeRule(deviceIds: string[]) {
  const rule: CreateRuleRequest = {
    name: 'Night Mode - Turn off all lights',
    enabled: true,
    conditions: [
      {
        type: 'time_of_day',
        start: '23:00',
        end: '23:01'
      }
    ],
    actions: deviceIds.map(id => ({
      type: 'set_device',
      deviceId: id,
      on: false
    }))
  };

  return await createRule(rule);
}

export async function createHighUsageAlert(
  deviceId: string,
  thresholdWatts: number
) {
  const rule: CreateRuleRequest = {
    name: `High usage alert - ${deviceId}`,
    enabled: true,
    conditions: [
      {
        type: 'power_threshold',
        deviceId,
        operator: '>',
        threshold: thresholdWatts
      }
    ],
    actions: [
      {
        type: 'alert',
        severity: 'warning',
        message: `${deviceId} exceeding ${thresholdWatts}W`
      }
    ]
  };

  return await createRule(rule);
}

// Usage in component:
// await createAutoOffRule('device_001', 5, 10);
// await createNightModeRule(['light_1', 'light_2', 'light_3']);
// await createHighUsageAlert('heater', 2000);
```

## Example 5: Power Statistics Widget

Display aggregated statistics from server:

```tsx
// src/components/PowerStatsWidget.tsx
import { useEffect, useState } from 'react';
import { getPowerStats, type PowerStats } from '@/api/history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function PowerStatsWidget({ deviceId }: { deviceId: string }) {
  const [stats, setStats] = useState<PowerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const last24h = Date.now() - 86400000;
        const data = await getPowerStats(deviceId, { start: last24h });
        setStats(data);
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [deviceId]);

  if (loading) return <div>Loading stats...</div>;
  if (!stats) return null;

  const uptime = stats.on_readings > 0 
    ? ((stats.on_readings / stats.count) * 100).toFixed(1) 
    : '0';

  return (
    <Card>
      <CardHeader>
        <CardTitle>24-Hour Statistics</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Average Power</p>
          <p className="text-2xl font-bold">{stats.avg_watts.toFixed(1)}W</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Peak Power</p>
          <p className="text-2xl font-bold">{stats.max_watts.toFixed(1)}W</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Min Power</p>
          <p className="text-2xl font-bold">{stats.min_watts.toFixed(1)}W</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Uptime</p>
          <p className="text-2xl font-bold">{uptime}%</p>
        </div>
        <div className="col-span-2">
          <p className="text-sm text-muted-foreground">Total Readings</p>
          <p className="text-xl font-semibold">{stats.count.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Migration Path

### Step 1: Add Feature Flag

```tsx
// src/config/features.ts
export const FEATURES = {
  USE_SERVER_HISTORY: import.meta.env.VITE_USE_SERVER_HISTORY === 'true',
  USE_SERVER_RULES: import.meta.env.VITE_USE_SERVER_RULES === 'true',
  USE_SERVER_ALERTS: import.meta.env.VITE_USE_SERVER_ALERTS === 'true',
};
```

### Step 2: Hybrid Approach

```tsx
// Use server if available, fall back to localStorage
function DeviceHistory({ deviceId }: { deviceId: string }) {
  const serverHistory = useServerHistory({
    deviceId,
    enabled: FEATURES.USE_SERVER_HISTORY
  });
  
  const localHistory = useLocalHistory(deviceId); // Your existing hook
  
  const { history, loading } = FEATURES.USE_SERVER_HISTORY 
    ? serverHistory 
    : { history: localHistory, loading: false };
  
  // Rest of component...
}
```

### Step 3: Environment Configuration

```bash
# .env.local
VITE_USE_SERVER_HISTORY=true
VITE_USE_SERVER_RULES=true
VITE_USE_SERVER_ALERTS=true
```

## Testing the Integration

### 1. Start Backend with Services

```bash
cd Backend
npm start
```

Verify you see:
```
✅ Backend MQTT subscriber connected
✅ Rule engine connected to MQTT broker
✅ Rule engine running (eval every 30s)
```

### 2. Create a Test Rule

```bash
curl -X POST http://localhost:4000/api/rules \
  -H "Content-Type: application/json" \
  -H "Cookie: your_session_cookie" \
  -d '{
    "name": "Test Rule",
    "enabled": true,
    "conditions": [
      { "type": "power_threshold", "deviceId": "device_001", "operator": ">", "threshold": 100 }
    ],
    "actions": [
      { "type": "alert", "severity": "info", "message": "Power threshold exceeded" }
    ]
  }'
```

### 3. Verify Data Storage

```bash
# Check power readings
curl http://localhost:4000/api/history/power/device_001?limit=10 \
  -H "Cookie: your_session_cookie"

# Check alerts
curl http://localhost:4000/api/history/alerts?limit=10 \
  -H "Cookie: your_session_cookie"

# Check rules
curl http://localhost:4000/api/rules \
  -H "Cookie: your_session_cookie"
```

### 4. Monitor Backend Logs

Watch for:
- `📊 Power: device_001 = 100W` (MQTT subscriber storing data)
- `✅ Rule triggered: Test Rule` (Rule engine evaluating conditions)
- `🚨 Alert created: [info] Power threshold exceeded` (Actions executing)

## Performance Tips

1. **Use appropriate refresh intervals** - Don't poll too frequently
2. **Implement pagination** for large datasets
3. **Cache responses** when data doesn't change often
4. **Use WebSocket** for real-time updates (future enhancement)
5. **Aggregate data** on server before sending to client

## Next Steps

1. Integrate these hooks into your existing components
2. Test with real MQTT data flow
3. Create custom rule templates for common scenarios
4. Build admin UI for viewing all stored data
5. Implement data retention policies
6. Add export functionality for historical reports
