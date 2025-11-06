# Smart Home Energy Monitor

A real-time energy monitoring dashboard for ESP32-based smart home devices with MQTT connectivity.

## Features

- **Real-time Power Monitoring**: Live power consumption tracking with animated gauges and charts
- **Device Management**: Control and monitor multiple appliances with on/off toggles
- **Smart Automations**: Create scenes and rules for automated energy management
- **Insights & Analytics**: Visualize energy trends, costs, and get personalized recommendations
- **Offline-First**: Works with intermittent connectivity, syncs when online
- **Dark Mode UI**: High contrast, accessible interface optimized for readability

## Prerequisites

- Node.js 18+ and npm
- MQTT Broker (Mosquitto recommended)
- ESP32 devices with current/voltage sensors (INA219, HLW8012, etc.)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup MQTT Broker

Install Mosquitto (local broker):

```bash
# Ubuntu/Debian
sudo apt-get install mosquitto mosquitto-clients

# macOS
brew install mosquitto

# Windows
# Download from https://mosquitto.org/download/
```

Configure WebSocket support in `/etc/mosquitto/mosquitto.conf`:

```
listener 1883
protocol mqtt

listener 9001
protocol websockets
```

Start the broker:

```bash
mosquitto -c /etc/mosquitto/mosquitto.conf
```

### 3. Configure ESP32 Firmware

Your ESP32 should publish to these MQTT topics:

```
home/{homeId}/sensor/{deviceId}/power
Payload: {"ts": 1234567890, "watts": 150, "voltage": 230, "current": 0.65}

home/{homeId}/sensor/{deviceId}/energy
Payload: {"ts": 1234567890, "wh_total": 1500}
```

Subscribe to control commands:

```
home/{homeId}/cmd/{deviceId}/set
Payload: {"on": true/false}
```

### 4. Run the Application

```bash
npm run dev
```

Open http://localhost:5173

### 5. Onboarding

1. Enter your MQTT broker URL (e.g., `ws://localhost:9001`)
2. Configure home profile (currency, tariff rate)
3. Devices will auto-appear as they publish data

## MQTT Topic Schema

| Topic Pattern | Direction | Payload |
|--------------|-----------|---------|
| `home/{homeId}/sensor/{deviceId}/power` | ESP32 → App | `{ts, watts, voltage, current}` |
| `home/{homeId}/sensor/{deviceId}/energy` | ESP32 → App | `{ts, wh_total}` |
| `home/{homeId}/cmd/{deviceId}/set` | App → ESP32 | `{on: boolean}` |
| `home/{homeId}/event/alert` | ESP32 → App | `{ts, deviceId, type, severity, msg}` |

## Configuration

Settings are stored in browser localStorage:

- `homeId`: Unique home identifier
- `brokerUrl`: MQTT broker WebSocket URL
- `currency`: Display currency (USD, EUR, GBP, KES)
- `tariff`: Cost per kWh
- `onboarded`: Setup completion flag

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   ESP32     │ MQTT    │    Broker    │ WS/MQTT │  React App  │
│  + Sensor   ├────────►│  (Mosquitto) │◄────────┤  (Browser)  │
└─────────────┘         └──────────────┘         └─────────────┘
```

- **Frontend**: React + TypeScript + Tailwind CSS
- **State**: React Context API + localStorage
- **Charts**: Recharts for data visualization
- **Transport**: MQTT.js over WebSockets

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Troubleshooting

**MQTT Connection Failed**
- Verify broker is running: `mosquitto -v`
- Check WebSocket port (9001) is accessible
- Ensure firewall allows connections

**No Devices Showing**
- Confirm ESP32 is publishing to correct topics
- Check homeId matches in app settings
- Use MQTT client to verify messages: `mosquitto_sub -h localhost -t 'home/#' -v`

**Charts Not Updating**
- Verify payload format matches expected schema
- Check browser console for parsing errors
- Ensure timestamps are in milliseconds

## License

MIT License - Free for educational and commercial use
