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

const DEFAULT_TEMP_PASSWORD = process.env.DEFAULT_TEMP_PASSWORD || "test123";

const router = express.Router();
router.use(express.json());
router.use(authenticate);

router.post("/register", requireAdmin, (req, res) => {
  const { username, role: requestedRole } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }
  const role = requestedRole === "admin" ? "admin" : "user";

  const tempPassword = DEFAULT_TEMP_PASSWORD;
  const { salt, hash } = hashPassword(tempPassword);
  const id = uuid();
  const now = Date.now();

  db.run(
    `INSERT INTO users (id, username, password_hash, password_salt, created_at, role, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, username, hash, salt, now, role],
    function (err) {
      if (err) {
        const msg = /UNIQUE/.test(err.message) ? "username already exists" : err.message;
        return res.status(400).json({ error: msg });
      }
      res.json({ id, username, role, temporaryPassword: tempPassword });
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
    const mustChangePassword = row.must_change_password === 1;
    setAuthCookie(res, { userId: row.id, username: row.username, role, mustChangePassword });
    res.json({ id: row.id, username: row.username, role, mustChangePassword });
  });
});

router.post("/logout", requireAuth, (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", authenticate, (req, res) => {
  if (!req.user) return res.status(200).json({ user: null });
  res.json({
    user: {
      id: req.user.sub,
      username: req.user.username,
      role: req.user.role || "user",
      mustChangePassword: !!req.user.mustChangePassword,
    },
  });
});

router.get("/users", requireAdmin, (_req, res) => {
  db.all(
    `SELECT id, username, role, created_at, must_change_password as mustChangePassword
     FROM users ORDER BY username ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ users: rows });
    }
  );
});

router.delete("/users/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "user id required" });
  if (req.user && req.user.sub === id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  db.run(`DELETE FROM users WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes || 0 });
  });
});

router.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    return res.status(400).json({ error: "newPassword must be at least 6 characters" });
  }
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });

  db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "User not found" });

    if (!currentPassword || !verifyPassword(currentPassword, row.password_salt, row.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const { salt, hash } = hashPassword(newPassword);
    db.run(
      `UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?`,
      [hash, salt, userId],
      function (updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        const role = row.role === "admin" ? "admin" : "user";
        setAuthCookie(res, {
          userId: row.id,
          username: row.username,
          role,
          mustChangePassword: false,
        });
        res.json({ ok: true });
      }
    );
  });
});

module.exports = router;
