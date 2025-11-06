# Testing Guide

## Quick Start Testing (Without Hardware)

### 1. Install and Start MQTT Broker

```bash
# Ubuntu/Debian
sudo apt-get install mosquitto mosquitto-clients

# macOS
brew install mosquitto

# Start broker
mosquitto -v
```

### 2. Configure WebSocket Support

Edit `/etc/mosquitto/mosquitto.conf` (or `/usr/local/etc/mosquitto/mosquitto.conf` on macOS):

```
listener 1883
protocol mqtt

listener 9001
protocol websockets
```

Restart:
```bash
# Linux
sudo systemctl restart mosquitto

# macOS
brew services restart mosquitto
```

### 3. Run Test Data Simulator

```bash
# Install mqtt library
npm install mqtt

# Run simulator
node test-simulator.js
```

You should see:
```
✅ Connected to MQTT broker
📡 Publishing test data for 4 devices...
⚡ Refrigerator: 165W
⚡ Air Conditioner: 1234W
⚡ Water Heater: 2050W
⚡ Washing Machine: 623W
```

### 4. Start Web Application

```bash
npm run dev
```

Open http://localhost:5173

### 5. Complete Onboarding nod
1. Click "Get Started"
2. Enter broker URL: `ws://localhost:9001`
3. Click "Connect"

Devices should appear automatically in the Devices tab!

## Manual Testing with MQTT CLI

### Publish Test Power Reading

```bash
mosquitto_pub -h localhost -t 'home/home1/sensor/device_001/power' \
  -m '{"ts":1234567890,"watts":150.5,"voltage":220,"current":0.68}'
```

### Publish Test Energy Reading

```bash
mosquitto_pub -h localhost -t 'home/home1/sensor/device_001/energy' \
  -m '{"ts":1234567890,"wh_total":1500}'
```

### Subscribe to All Topics

```bash
mosquitto_sub -h localhost -t 'home/#' -v
```

### Test Device Control

From the web app, toggle a device ON/OFF. You should see in the subscriber:

```
home/home1/cmd/device_001/set {"on":false}
```

## Feature Testing Checklist

### Dashboard
- [ ] Live power gauge updates in real-time
- [ ] Today's kWh total displays correctly
- [ ] Estimated cost calculates properly
- [ ] Top consumers list shows devices ranked by usage
- [ ] Quick action buttons work (All Off, Away Mode)
- [ ] Alerts display with correct severity colors

### Devices
- [ ] Device list shows all connected devices
- [ ] Toggle switches turn devices on/off
- [ ] Filter by status (All/Active/Inactive) works
- [ ] Sort by usage/name works
- [ ] Click device card navigates to detail page
- [ ] Add Device button opens form
- [ ] New devices can be added manually

### Device Detail
- [ ] Real-time power chart updates every second
- [ ] Current power displays correctly
- [ ] Today's kWh total is accurate
- [ ] Threshold setting can be changed
- [ ] Auto-off delay can be configured
- [ ] Back button returns to device list

### Automations
- [ ] Scene cards are clickable
- [ ] New Rule button opens rule builder
- [ ] Rule builder form has all fields
- [ ] Device dropdown shows all devices
- [ ] Save Rule button works
- [ ] Cancel button closes form

### Insights
- [ ] Weekly bar chart displays data
- [ ] Period selector (Day/Week/Month) works
- [ ] Average kWh/day calculates correctly
- [ ] Projected monthly cost is accurate
- [ ] Device breakdown pie chart shows
- [ ] Recommendations display

### Settings
- [ ] Home ID can be changed
- [ ] Currency dropdown works
- [ ] Tariff can be updated
- [ ] MQTT broker URL can be changed
- [ ] Export Data downloads JSON file
- [ ] Save Settings shows success message

## Performance Testing

### Chart Performance
Test with high-frequency data:
```bash
# Publish 100 readings rapidly
for i in {1..100}; do
  mosquitto_pub -h localhost -t 'home/home1/sensor/device_001/power' \
    -m "{\"ts\":$(date +%s)000,\"watts\":$((RANDOM % 1000)),\"voltage\":220,\"current\":1.5}"
  sleep 0.1
done
```

Chart should:
- Update smoothly without lag
- Limit to last 60 points
- Not cause memory leaks

### Multiple Devices
Run simulator with 10+ devices:
```javascript
// Edit test-simulator.js and add more devices
const devices = [
  { id: 'device_001', name: 'Device 1', baseWatts: 100, variance: 20 },
  { id: 'device_002', name: 'Device 2', baseWatts: 200, variance: 30 },
  // ... add 8 more
];
```

App should:
- Handle 10+ devices without slowdown
- Update all device cards in real-time
- Maintain responsive UI

## Error Testing

### Connection Failures
1. Stop MQTT broker: `sudo systemctl stop mosquitto`
2. App should show "MQTT Disconnected" warning
3. Restart broker: `sudo systemctl start mosquitto`
4. Connection should restore automatically

### Invalid Data
Publish malformed JSON:
```bash
mosquitto_pub -h localhost -t 'home/home1/sensor/device_001/power' -m 'invalid json'
```

App should:
- Not crash
- Log error to console
- Continue processing other messages

### Network Interruption
1. Disconnect WiFi
2. App should work with cached data
3. Reconnect WiFi
4. App should sync automatically

## Browser Compatibility

Test in:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader announces elements correctly
- [ ] Color contrast meets WCAG AA standards
- [ ] Touch targets are at least 44x44px
- [ ] Focus indicators are visible

## Security Testing

- [ ] localStorage data is not exposed
- [ ] MQTT credentials are not logged
- [ ] XSS attempts are sanitized
- [ ] CSRF protection is in place

## Known Issues

1. **Chart may lag with >120 data points** - Implement downsampling
2. **localStorage has 5MB limit** - Add data pruning
3. **WebSocket reconnection may fail** - Implement exponential backoff

## Reporting Bugs

When reporting issues, include:
- Browser and version
- MQTT broker version
- Console error messages
- Steps to reproduce
- Expected vs actual behavior
