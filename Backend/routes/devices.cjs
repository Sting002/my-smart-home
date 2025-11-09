// Backend/routes/devices.cjs
const express = require("express");
const { db } = require("../db.cjs");
const { authenticate, requireAuth } = require("../middleware/auth.cjs");

const router = express.Router();
router.use(express.json());
router.use(authenticate);

/** GET /api/devices */
router.get("/", (_req, res) => {
  db.all(`SELECT * FROM devices`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const mapped = rows.map((r) => ({ ...r, isOn: !!r.isOn }));
    res.json(mapped);
  });
});

/** POST /api/devices */
router.post("/", requireAuth, (req, res) => {
  const d = req.body || {};
  if (!d.id) return res.status(400).json({ error: "device id required" });

  db.run(
    `INSERT INTO devices (id, name, room, type, isOn, watts, kwhToday, thresholdW, autoOffMins, lastSeen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       room=excluded.room,
       type=excluded.type,
       isOn=excluded.isOn,
       watts=excluded.watts,
       kwhToday=excluded.kwhToday,
       thresholdW=excluded.thresholdW,
       autoOffMins=excluded.autoOffMins,
       lastSeen=excluded.lastSeen`,
    [
      d.id,
      d.name || null,
      d.room || null,
      d.type || null,
      d.isOn ? 1 : 0,
      typeof d.watts === "number" ? d.watts : 0,
      typeof d.kwhToday === "number" ? d.kwhToday : 0,
      typeof d.thresholdW === "number" ? d.thresholdW : 0,
      typeof d.autoOffMins === "number" ? d.autoOffMins : 0,
      typeof d.lastSeen === "number" ? d.lastSeen : Date.now(),
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

/** DELETE /api/devices/:id */
router.delete("/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "device id required" });
  db.run(`DELETE FROM devices WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes || 0 });
  });
});

module.exports = router;
