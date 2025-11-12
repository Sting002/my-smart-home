// Backend/middleware/security.cjs
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

function createHelmet() {
  return helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { createHelmet, apiLimiter };
