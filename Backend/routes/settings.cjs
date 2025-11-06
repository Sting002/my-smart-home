// Backend/routes/settings.cjs
const express = require("express");
const { db } = require("../db.cjs");
const { authenticate, requireAuth } = require("../middleware/auth.cjs");

const router = express.Router();
router.use(express.json());
router.use(authenticate);

/** GET /api/settings/:key */
router.get("/:key", (req, res) => {
  const key = req.params.key;
  db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ value: row ? row.value : null });
  });
});

/** POST /api/settings { key, value } */
router.post("/", requireAuth, (req, res) => {
  const { key, value } = req.body || {};
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

module.exports = router;
