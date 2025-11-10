# Deployment Guide

This project is a Vite + React SPA that talks to an MQTT broker over WebSockets and optionally to a REST API under `/api`. Deploy it as static files behind a reverse proxy, or on a static host with an external WSS broker.

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (Vite on http://localhost:8080)
npm run dev

# Build for production
npm run build

# Preview the production build locally
npm run preview
```

## Environment Variables

These are read at build time by Vite:

- `VITE_API_BASE` — Base URL for API requests (default `/api`; in dev, proxied to `http://localhost:4000`).
- `VITE_MQTT_BROKER_URL` — Default MQTT WS URL if none saved (e.g., `wss://your-domain.com/mqtt` or `ws://localhost:9001/mqtt`).
- `VITE_MAX_CHART_POINTS` — Max in-memory points for power history (default 120).
- `VITE_DEBUG_MQTT` — Set to `true` for verbose MQTT logs.

Create `.env` or `.env.production` as needed, for example:

```env
VITE_API_BASE=/api
VITE_MQTT_BROKER_URL=wss://your-domain.com/mqtt
VITE_MAX_CHART_POINTS=120
VITE_DEBUG_MQTT=false
```

Note: Do not modify source files to inject env values; Vite automatically exposes `import.meta.env.*` at build time.

## Production Deployment

### Option 1: Static Hosting (Netlify, Vercel, S3+CloudFront, etc.)

- Build locally or in CI: `npm run build` -> uploads `dist/`.
- Configure SPA fallback to `index.html` (history API rewrite) so client routes work:
  - Netlify: add a `_redirects` file: `/* /index.html 200`.
  - Vercel: SPA works when deployed as static; custom rewrites only needed if also proxying `/api`.
- MQTT access:
  - Use an external WSS broker (recommended). Set `VITE_MQTT_BROKER_URL` to `wss://.../mqtt`.
  - Static hosts generally cannot proxy raw WebSockets to Mosquitto; prefer direct WSS.
- Optional API:
  - If your API runs on another domain, set `VITE_API_BASE` to its absolute URL and enable CORS on the API, or front it with a reverse proxy under the same origin.

### Option 2: Self‑Hosted with Nginx

1) Build and copy files

```bash
npm run build
sudo mkdir -p /var/www/energy-monitor
sudo cp -r dist/* /var/www/energy-monitor/
```

2) Nginx site config (SPA + optional API + MQTT WS proxy)

`/etc/nginx/sites-available/energy-monitor`:

```nginx
server {
  listen 80;
  server_name energy-monitor.local;

  root /var/www/energy-monitor;
  index index.html;

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Optional: proxy API to backend (keeps same-origin, avoids CORS)
  location /api/ {
    proxy_pass http://localhost:4000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # WebSocket proxy to Mosquitto WS listener (expects client URL like ws[s]://host/mqtt)
  location /mqtt {
    proxy_pass http://localhost:9001/;  # rewrite /mqtt -> /
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_read_timeout 600s;
    proxy_set_header Host $host;
  }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/energy-monitor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

3) TLS (recommended)

- Terminate TLS at Nginx. Use Certbot or your PKI. Then serve app on `https://` and proxy WSS via `wss://host/mqtt`.

## MQTT Broker Setup (Mosquitto)

Minimal WS (no TLS) for local/private networks:

`/etc/mosquitto/mosquitto.conf`

```
listener 1883
protocol mqtt

listener 9001
protocol websockets
```

TLS + auth (production):

```
listener 1883
protocol mqtt

listener 8083
protocol websockets
cafile /etc/mosquitto/certs/ca.crt
certfile /etc/mosquitto/certs/server.crt
keyfile /etc/mosquitto/certs/server.key

allow_anonymous false
password_file /etc/mosquitto/passwd
```

Create users and restart:

```bash
sudo mosquitto_passwd -c /etc/mosquitto/passwd dashboard
sudo systemctl restart mosquitto
```

Tip: The frontend default path is `/mqtt` (behind Nginx). If exposing Mosquitto directly, set `VITE_MQTT_BROKER_URL` to your `ws(s)://host:port/mqtt` and route accordingly.

### Windows (Mosquitto) quick example

`C:\\mosquitto\\mosquitto.conf`:

```
allow_anonymous true

# Standard MQTT for devices
listener 1883

# WebSockets for the web app
listener 9001
protocol websockets

# Optional persistence
# persistence true
# persistence_location C:/mosquitto/data/
```

Run from an elevated PowerShell:

```
"C:\\Program Files\\mosquitto\\mosquitto.exe" -c C:\\mosquitto\\mosquitto.conf -v
```

The app’s default WS URL is `ws://localhost:9001/mqtt`. If your broker serves WS at `/` (no `/mqtt`), update the app Settings Broker URL accordingly.

## Docker Deployment

Dockerfile (multi-stage build):

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Simple SPA config with MQTT WS proxy at /mqtt (adjust upstreams for your infra)
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  location / { try_files $uri $uri/ /index.html; }' \
  '  location /mqtt { proxy_pass http://mosquitto:9001/; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "Upgrade"; proxy_read_timeout 600s; }' \
  '}' \
  > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Compose (web + Mosquitto with WS):

```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:80"
    depends_on:
      - mosquitto
    environment:
      - VITE_API_BASE=/api
      - VITE_MQTT_BROKER_URL=ws://localhost:3000/mqtt

  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - mosq-data:/mosquitto/data
      - mosq-log:/mosquitto/log

volumes:
  mosq-data:
  mosq-log:
```

Example `mosquitto.conf` for compose:

```
listener 1883
protocol mqtt

listener 9001
protocol websockets
```

Start:

```bash
docker compose up -d --build
```

## Operational Tips

- SPA base path: hosting under a sub-path? Build with `vite build --base /energy-monitor/` or set `base` in `vite.config.ts`.
- Broker retained messages: use the helper to clear retained sensor topics after test data:
  - `npm run mqtt:clear` or see `scripts/clear-retained.cjs`.
- Backend proxy: in dev, `vite.config.ts` proxies `/api` to `http://localhost:4000`. In prod, front the API under `/api` via Nginx to avoid CORS.

## Security & Monitoring

- Serve over HTTPS and use WSS to the broker.
- Enable Mosquitto auth; scope credentials per client/device.
- Limit retained data and validate payloads on the producer side.
- Monitor:
  - Broker uptime and listener ports
  - WebSocket connection rates and errors
  - Device last-seen timestamps
  - Backend `/api` error rates, if used

## Troubleshooting

- WebSocket fails: confirm `wss://` certificate chain, firewall rules, and Nginx `Upgrade` headers. Test via `wscat`.
- No devices appear: verify topics and `homeId`; subscribe with `mosquitto_sub -h host -t 'home/#' -v`.
- Charts empty: ensure payloads match schemas and timestamps are in milliseconds.
- Hosted on static platform: point `VITE_MQTT_BROKER_URL` to an external WSS broker; don’t expect platform to proxy WS to Mosquitto.
