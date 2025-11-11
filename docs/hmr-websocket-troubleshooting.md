# Vite HMR WebSocket Troubleshooting

## Error Context
The browser console showed `client:755 WebSocket connection to 'ws://localhost:8080/?token=…' failed` and "[vite] failed to connect to websocket". HTTP fetches still work, which means the hot-module-reload (HMR) socket cannot complete the upgrade handshake.

## Fix Steps

### 1. Pin the dev server and HMR endpoints
Bind the server on every interface and tell the client exactly which host/port/protocol to use. Add the following to `vite.config.ts` and restart `npm run dev`:

```ts
server: {
  host: "0.0.0.0",
  port: 8080,
  strictPort: true,
  hmr: {
    host: "localhost",  // replace with the hostname the browser actually uses
    clientPort: 8080,
    port: 8080,
    protocol: "ws",      // switch to "wss" when serving over HTTPS
  },
},
```

### 2. Ensure the port is free
With `strictPort: true`, Vite exits instead of silently jumping to 8081 if something already binds 8080. If a conflict remains, run `netstat -ano | findstr 8080` (PowerShell) and stop the offending process before retrying.

### 3. Keep reverse proxies/tunnels WebSocket-aware
If you reach the dev server through nginx, Traefik, IIS, ngrok, Codespaces, etc., make sure the proxy forwards `Upgrade`/`Connection` headers and exposes the same host/port pair you configured above. Set `hmr.host` to the public hostname (for example `abc.ngrok.app`) and `clientPort` to the forwarded port when developing over tunnels/containers.

### 4. Match protocols when using HTTPS
Browsers block `ws://` sockets if the page itself loaded over `https://` (mixed content). Either visit the HTTP version during development or start Vite with HTTPS (`npm run dev -- --https`) and set `server.hmr.protocol = "wss"` so the socket also uses TLS.

### 5. Use a reachable hostname for external devices/VMs
From a phone, VM, or WSL guest, `localhost` points to that device—not your host machine. Replace the URL and `hmr.host` with the host's LAN IP (e.g., `192.168.1.50`) so the browser can reach the websocket.

## Verification Checklist
1. Restart the dev server (`npm run dev`) and wait for the console to log the HMR endpoint.
2. Load the app (http://localhost:8080 or your tunnel host) and confirm the console stops logging WebSocket failures.
3. Edit a React component; the browser should hot-reload without a full refresh.