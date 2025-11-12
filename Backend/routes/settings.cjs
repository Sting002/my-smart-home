// Backend/routes/settings.cjs
const express = require("express");
const { db } = require("../db.cjs");
const { authenticate, requireAuth } = require("../middleware/auth.cjs");

const router = express.Router();
router.use(express.json());
router.use(authenticate);

function normalizeKey(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

/** GET /api/settings/:key */
router.get("/:key(*)", (req, res) => {
  const key = normalizeKey(req.params.key);
  if (!key) return res.status(400).json({ error: "key required" });
  db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ value: row ? row.value : null });
  });
});

/** POST /api/settings { key, value } */
router.post("/", requireAuth, (req, res) => {
  const { key: rawKey, value } = req.body || {};
  const key = normalizeKey(rawKey);
  if (!key) return res.status(400).json({ error: "key required" });

  db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, value],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

/** DELETE /api/settings/:key */
router.delete("/:key(*)", requireAuth, (req, res) => {
  const key = normalizeKey(req.params.key);
  if (!key) return res.status(400).json({ error: "key required" });

  db.run(`DELETE FROM settings WHERE key = ?`, [key], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes ?? 0 });
  });
});

module.exports = router;
