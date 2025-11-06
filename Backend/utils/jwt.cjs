// Backend/utils/jwt.cjs
const jwt = require("jsonwebtoken");

const {
  JWT_SECRET = "dev_secret_change_me",
  COOKIE_NAME = "smarthome_token",
  NODE_ENV = "development",
} = process.env;

const isProd = NODE_ENV === "production";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 2,
    path: "/",
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie, COOKIE_NAME };
