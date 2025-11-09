// Backend/middleware/auth.cjs
const crypto = require("crypto");

const {
  JWT_SECRET = "dev_secret_change_me",
  COOKIE_NAME = "smarthome_token",
} = process.env;

/** Lightweight cookie parser (no external dep) */
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

/** Base64url helpers */
function b64url(data) {
  return Buffer.from(data).toString("base64url");
}
function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

/** HMAC-based signed token (JWT-like, but no external lib) */
function signToken(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const p1 = b64urlJson(header);
  const p2 = b64urlJson(payload);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${p1}.${p2}`);
  const sig = hmac.digest("base64url");
  return `${p1}.${p2}.${sig}`;
}

function verifyToken(token, secret) {
  const [p1, p2, sig] = token.split(".");
  if (!p1 || !p2 || !sig) return null;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${p1}.${p2}`);
  const expected = hmac.digest("base64url");
  if (expected !== sig) return null;
  try {
    const json = JSON.parse(Buffer.from(p2, "base64url").toString());
    if (json.exp && Date.now() > json.exp) return null;
    return json;
  } catch {
    return null;
  }
}

/** Password hashing using PBKDF2 (no external dep) */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256").toString("hex");
  return { salt, hash };
}
function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
}

/** Issue auth cookie */
function setAuthCookie(res, data, maxAgeMs = 1000 * 60 * 60 * 24 * 7) {
  const payload = {
    sub: data.userId,
    username: data.username,
    iat: Date.now(),
    exp: Date.now() + maxAgeMs,
  };
  const token = signToken(payload, JWT_SECRET);
  const isProd = String(process.env.NODE_ENV).toLowerCase() === "production";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${
      isProd ? "; Secure" : ""
    }`
  );
}

/** Clear auth cookie */
function clearAuthCookie(res) {
  const isProd = String(process.env.NODE_ENV).toLowerCase() === "production";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
      isProd ? "; Secure" : ""
    }`
  );
}

/** Auth middleware: populates req.user if cookie valid */
function authenticate(req, _res, next) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return next();
  const payload = verifyToken(raw, JWT_SECRET);
  if (payload) req.user = payload;
  next();
}

/** Require-auth guard */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
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
};
