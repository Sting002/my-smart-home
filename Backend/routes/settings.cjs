// Backend/routes/settings.cjs
const express = require("express");
const { db } = require("../db.cjs");
const { authenticate, requireAuth, requireAdmin } = require("../middleware/auth.cjs");

const router = express.Router();
router.use(express.json());
router.use(authenticate);

function normalizeKey(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim();
}


router.get("/onboarding", requireAuth, (req, res) => {
  db.all(
    `SELECT key, value FROM settings WHERE key IN ('onboarded', 'brokerUrl')`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const settings = rows.reduce((acc, row) => {
        acc[row.key] = row.value;
        return acc;
      }, {});
      res.json(settings);
    }
  );
});

router.post("/onboarding", requireAuth, (req, res) => {
  const { onboarded, brokerUrl } = req.body || {};

  const promises = [];
  if (onboarded !== undefined) {
    promises.push(
      new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO settings (key, value) VALUES ('onboarded', ?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
          [onboarded],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      })
    );
  }

  if (brokerUrl !== undefined) {
    promises.push(
      new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO settings (key, value) VALUES ('brokerUrl', ?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
          [brokerUrl],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      })
    );
  }

  Promise.all(promises)
    .then(() => res.json({ ok: true }))
    .catch((err) => res.status(500).json({ error: err.message }));
});

router.get("/", requireAuth, (req, res) => {
  db.all(`SELECT key, value FROM settings`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json(settings);
  });
});

router.get(/^\/(.+)$/, requireAuth, (req, res) => {
  const key = normalizeKey(req.params[0]);
  if (!key) return res.status(400).json({ error: "key required" });
  db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ value: row ? row.value : null });
  });
});

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

router.delete(/^\/(.+)$/, requireAdmin, (req, res) => {
  const key = normalizeKey(req.params[0]);
  if (!key) return res.status(400).json({ error: "key required" });

  db.run(`DELETE FROM settings WHERE key = ?`, [key], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes ?? 0 });
  });
});

module.exports = router;
