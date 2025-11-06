# Deployment Guide

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Production Deployment

### Option 1: Static Hosting (Netlify/Vercel)

1. **Build the app**:
```bash
npm run build
```

2. **Deploy to Netlify**:
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

3. **Deploy to Vercel**:
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Option 2: Self-Hosted (Nginx)

1. **Build the app**:
```bash
npm run build
```

2. **Copy to web server**:
```bash
sudo cp -r dist/* /var/www/html/energy-monitor/
```

3. **Configure Nginx** (`/etc/nginx/sites-available/energy-monitor`):
```nginx
server {
    listen 80;
    server_name energy-monitor.local;
    root /var/www/html/energy-monitor;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # WebSocket proxy for MQTT
    location /mqtt {
        proxy_pass http://localhost:9001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

4. **Enable and restart**:
```bash
sudo ln -s /etc/nginx/sites-available/energy-monitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## MQTT Broker Setup (Production)

### Mosquitto with SSL/TLS

1. **Generate certificates**:
```bash
# Generate CA key
openssl genrsa -out ca.key 2048

# Generate CA certificate
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt

# Generate server key
openssl genrsa -out server.key 2048

# Generate server CSR
openssl req -new -key server.key -out server.csr

# Sign server certificate
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 3650
```

2. **Configure Mosquitto** (`/etc/mosquitto/mosquitto.conf`):
```
# Standard MQTT
listener 1883
protocol mqtt

# WebSocket with TLS
listener 8083
protocol websockets
cafile /etc/mosquitto/certs/ca.crt
certfile /etc/mosquitto/certs/server.crt
keyfile /etc/mosquitto/certs/server.key

# Authentication
allow_anonymous false
password_file /etc/mosquitto/passwd
```

3. **Create users**:
```bash
sudo mosquitto_passwd -c /etc/mosquitto/passwd admin
sudo mosquitto_passwd /etc/mosquitto/passwd esp32_device
```

4. **Restart broker**:
```bash
sudo systemctl restart mosquitto
```

## Environment Configuration

Create `.env` file for production:

```env
VITE_MQTT_BROKER_URL=wss://your-domain.com:8083
VITE_DEFAULT_HOME_ID=home1
VITE_DEFAULT_CURRENCY=USD
VITE_DEFAULT_TARIFF=0.12
```

Update `src/pages/Onboarding.tsx` to use env variables:
```typescript
const [brokerUrl, setBrokerUrl] = useState(
  import.meta.env.VITE_MQTT_BROKER_URL || 'ws://localhost:9001'
);
```

## Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:80"
    depends_on:
      - mosquitto

  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf
      - mosquitto-data:/mosquitto/data
      - mosquitto-logs:/mosquitto/log

volumes:
  mosquitto-data:
  mosquitto-logs:
```

Deploy:
```bash
docker-compose up -d
```

## Security Considerations

1. **Use HTTPS/WSS** in production
2. **Enable MQTT authentication**
3. **Implement rate limiting**
4. **Use environment variables** for sensitive data
5. **Enable CORS** properly
6. **Regular security updates**

## Monitoring

Set up monitoring for:
- MQTT broker uptime
- WebSocket connection health
- Device last-seen timestamps
- Error rates in browser console

## Backup Strategy

Backup these regularly:
- MQTT broker configuration
- User credentials
- Device configurations (localStorage data)
- Historical energy data (if stored server-side)

## Troubleshooting Production Issues

**WebSocket connection fails**:
- Check SSL certificates
- Verify firewall rules
- Confirm WebSocket proxy configuration

**High latency**:
- Reduce MQTT message frequency
- Implement message batching
- Use QoS 0 for non-critical data

**Memory leaks**:
- Limit chart data points (max 120)
- Clear old localStorage entries
- Implement data pruning in devices
