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
  requireAdmin,
} = require("../middleware/auth.cjs");

const router = express.Router();
router.use(express.json());
router.use(authenticate);

router.post("/register", requireAdmin, (req, res) => {
  const { username, password, role: requestedRole } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }
  const role = requestedRole === "admin" ? "admin" : "user";

  const { salt, hash } = hashPassword(password);
  const id = uuid();
  const now = Date.now();

  db.run(
    `INSERT INTO users (id, username, password_hash, password_salt, created_at, role)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, username, hash, salt, now, role],
    function (err) {
      if (err) {
        const msg = /UNIQUE/.test(err.message) ? "username already exists" : err.message;
        return res.status(400).json({ error: msg });
      }
      res.json({ id, username, role });
    }
  );
});

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

    const role = row.role === "admin" ? "admin" : "user";
    setAuthCookie(res, { userId: row.id, username: row.username, role });
    res.json({ id: row.id, username: row.username, role });
  });
});

router.post("/logout", requireAuth, (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", authenticate, (req, res) => {
  if (!req.user) return res.status(200).json({ user: null });
  res.json({
    user: { id: req.user.sub, username: req.user.username, role: req.user.role || "user" },
  });
});

router.get("/users", requireAdmin, (_req, res) => {
  db.all(`SELECT id, username, role, created_at FROM users ORDER BY username ASC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ users: rows });
  });
});

module.exports = router;
