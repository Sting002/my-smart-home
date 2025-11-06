// Backend/middleware/security.cjs
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

/** Helmet with a cross-origin image policy that works for dev */
function createHelmet() {
  return helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
}

/** 120 req/min/IP limiter for API */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { createHelmet, apiLimiter };
