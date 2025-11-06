// Backend/middleware/csrf.cjs
const crypto = require("crypto");

const { CSRF_PROTECT = "false" } = process.env;
const CSRF_ENABLED = String(CSRF_PROTECT).toLowerCase() === "true";
const CSRF_COOKIE = "smarthome_csrf";

/** Issue CSRF token: returns token and sets cookie */
function issueCsrfToken(req, res) {
  const token = crypto.randomBytes(24).toString("hex");
  res.setHeader("Set-Cookie", `${CSRF_COOKIE}=${token}; Path=/; SameSite=Lax`);
  res.json({ token, enabled: CSRF_ENABLED });
}

/** Check CSRF on mutating requests if enabled */
function checkCsrf(req, res, next) {
  if (!CSRF_ENABLED) return next();
  const method = (req.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers["x-csrf-token"];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "CSRF validation failed" });
  }
  next();
}

module.exports = { issueCsrfToken, checkCsrf, CSRF_ENABLED };
