// Backend/routes/auth.cjs
const express = require("express");
const { db } = require("../db.cjs");
const { v4: uuid } = require("uuid");
const {
  hashPassword,
  verifyPassword,
  setAuthCookie,
  clearAuthCookie,
  authenticate,
  requireAuth,
} = require("../middleware/auth.cjs");

const router = express.Router();

// Parse JSON
router.use(express.json());
// Attach auth info if present
router.use(authenticate);

/** POST /api/auth/register { username, password } */
router.post("/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  const { salt, hash } = hashPassword(password);
  const id = uuid();
  const now = Date.now();

  db.run(
    `INSERT INTO users (id, username, password_hash, password_salt, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, username, hash, salt, now],
    function (err) {
      if (err) {
        const msg = /UNIQUE/.test(err.message) ? "username already exists" : err.message;
        return res.status(400).json({ error: msg });
      }
      setAuthCookie(res, { userId: id, username });
      res.json({ id, username });
    }
  );
});

/** POST /api/auth/login { username, password } */
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: "invalid credentials" });

    const ok = verifyPassword(password, row.password_salt, row.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    setAuthCookie(res, { userId: row.id, username: row.username });
    res.json({ id: row.id, username: row.username });
  });
});

/** POST /api/auth/logout */
router.post("/logout", requireAuth, (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

/** GET /api/auth/me */
router.get("/me", authenticate, (req, res) => {
  if (!req.user) return res.status(200).json({ user: null });
  res.json({ user: { id: req.user.sub, username: req.user.username } });
});

module.exports = router;
