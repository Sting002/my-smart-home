// Backend/server.cjs
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const { cookieParser } = require("./middleware/auth.cjs");
const { createHelmet, apiLimiter } = require("./middleware/security.cjs");
const { issueCsrfToken, checkCsrf, CSRF_ENABLED } = require("./middleware/csrf.cjs");
require("./db.cjs");

const authRouter = require("./routes/auth.cjs");
const devicesRouter = require("./routes/devices.cjs");
const settingsRouter = require("./routes/settings.cjs");
const historyRouter = require("./routes/history.cjs");
const rulesRouter = require("./routes/rules.cjs");

// Import backend services
const mqttSubscriber = require("./services/mqttSubscriber.cjs");
const ruleEngine = require("./services/ruleEngine.cjs");

const {
  PORT = 4000,
  NODE_ENV = "development",
  CORS_ORIGINS = "http://localhost:8080,http://127.0.0.1:8080",
} = process.env;

const app = express();

app.use(createHelmet());
app.use(cookieParser());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(apiLimiter);

const allowed = CORS_ORIGINS.split(",").map((s) => s.trim());
const corsMw = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowed.some((o) => origin.startsWith(o))) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
});
app.use(corsMw);
app.options(/.*/, corsMw);

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.use((_req, res, next) => {
  const csp = [
    "default-src 'self' 'unsafe-inline' data: blob:;",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
    "connect-src 'self' ws: wss: http://localhost:4000 http://127.0.0.1:4000 http://localhost:8080 http://127.0.0.1:8080;",
    "img-src 'self' data: blob:;",
    "style-src 'self' 'unsafe-inline';",
    "font-src 'self' data:;",
  ].join(" ");
  res.setHeader("Content-Security-Policy", csp);
  next();
});

app.get("/health", (_req, res) =>
  res.json({ status: "ok", time: Date.now(), csrf: CSRF_ENABLED })
);

app.get("/api/csrf", issueCsrfToken);

app.use("/api/auth", checkCsrf, authRouter);
app.use("/api/devices", checkCsrf, devicesRouter);
app.use("/api/settings", checkCsrf, settingsRouter);
app.use("/api/history", historyRouter);
app.use("/api/rules", rulesRouter);

app.use("/devices", checkCsrf, devicesRouter);
app.use("/settings", checkCsrf, settingsRouter);

app.get("/", (_req, res) => {
  res.send(`
    <html>
      <head>
        <title>Smart Home Backend</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 2rem; color: #333; }
          h2 { color: #007bff; }
          ul { line-height: 1.6; }
          a { color: #007bff; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .time { color: gray; font-size: 0.9em; }
          code { background:#f5f5f5; padding:2px 4px; border-radius:4px; }
        </style>
      </head>
      <body>
        <h2>Smart Home Backend is running!</h2>
        <p class="time">Server time: ${new Date().toLocaleString()}</p>
        <h3>Endpoints</h3>
        <ul>
          <li><a href="/health">/health</a></li>
          <li><a href="/api/auth/me">/api/auth/me</a></li>
          <li><a href="/api/devices">/api/devices</a></li>
          <li><a href="/api/settings/someKey">/api/settings/:key</a></li>
          <li><a href="/api/rules">/api/rules</a> - Automation rules</li>
          <li><a href="/api/history/alerts">/api/history/alerts</a> - Alert history</li>
        </ul>
        <p>DB file: <code>smarthome.db</code></p>
        <p>Services: MQTT Subscriber, Rule Engine</p>
      </body>
    </html>
  `);
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, _req, res, _next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Smart Home Backend on http://localhost:${PORT} (env: ${NODE_ENV})`);
  
  // Start backend services
  console.log('\n🚀 Starting backend services...');
  
  // Start MQTT subscriber to persist telemetry
  mqttSubscriber.connect();
  
  // Start rule engine to evaluate automations
  ruleEngine.start();
  
  console.log('✅ All services started\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Shutting down gracefully...');
  
  mqttSubscriber.disconnect();
  ruleEngine.stop();
  
  process.exit(0);
});

