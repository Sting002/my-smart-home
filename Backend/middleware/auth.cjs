// Backend/middleware/auth.cjs
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const {
  JWT_SECRET = "dev_secret_change_me",
  COOKIE_NAME = "smarthome_token",
} = process.env;

function cookieParser() {
  return function (req, _res, next) {
    const header = req.headers.cookie || "";
    const parts = header.split(/; */).filter(Boolean);
    req.cookies = {};
    for (const part of parts) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      const key = decodeURIComponent(part.slice(0, eq).trim());
      const val = decodeURIComponent(part.slice(eq + 1).trim());
      req.cookies[key] = val;
    }
    next();
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
}

function signUserToken(data, maxAgeMs) {
  const expiresInSeconds = Math.floor(maxAgeMs / 1000);
  return jwt.sign(
    {
      sub: data.userId,
      username: data.username,
      role: data.role || "user",
    },
    JWT_SECRET,
    { expiresIn: expiresInSeconds || undefined }
  );
}

const isProd = String(process.env.NODE_ENV).toLowerCase() === "production";

function setAuthCookie(res, data, maxAgeMs = 1000 * 60 * 60 * 24 * 7) {
  const token = signUserToken(data, maxAgeMs);
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`
  );
}

function clearAuthCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`
  );
}

function authenticate(req, _res, next) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return next();
  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    if (payload && typeof payload === "object") {
      req.user = payload;
    }
  } catch {
    // ignore invalid token
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin privileges required" });
  }
  next();
}

module.exports = {
  cookieParser,
  hashPassword,
  verifyPassword,
  setAuthCookie,
  clearAuthCookie,
  authenticate,
  requireAuth,
  requireAdmin,
};
