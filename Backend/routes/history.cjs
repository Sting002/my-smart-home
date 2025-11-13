// Backend/routes/history.cjs
const express = require('express');
const { requireAuth } = require('../middleware/auth.cjs');
const { db } = require('../db.cjs');

const router = express.Router();

// Get power history for a device
router.get('/power/:deviceId', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const { start, end, limit = 1000 } = req.query;
  const homeId = req.user.home_id || 'home1';
  
  let query = `
    SELECT timestamp, watts, voltage, current
    FROM power_readings
    WHERE device_id = ? AND home_id = ?
  `;
  const params = [deviceId, homeId];
  
  if (start) {
    query += ' AND timestamp >= ?';
    params.push(parseInt(start));
  }
  if (end) {
    query += ' AND timestamp <= ?';
    params.push(parseInt(end));
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching power history:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.reverse()); // Return chronological order
  });
});

// Get energy history for a device
router.get('/energy/:deviceId', requireAuth, (req, res) => {
  const { deviceId } = req.params;
  const { start, end, limit = 1000 } = req.query;
  const homeId = req.user.home_id || 'home1';
  
  let query = `
    SELECT timestamp, wh_total
    FROM energy_readings
    WHERE device_id = ? AND home_id = ?
  `;
  const params = [deviceId, homeId];
  
  if (start) {
    query += ' AND timestamp >= ?';
    params.push(parseInt(start));
  }
  if (end) {
    query += ' AND timestamp <= ?';
    params.push(parseInt(end));
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching energy history:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.reverse());
  });
});

// Get aggregated daily stats
router.get('/daily-stats', requireAuth, (req, res) => {
  const { deviceId, startDate, endDate } = req.query;
  const homeId = req.user.home_id || 'home1';
  
  let query = `
    SELECT * FROM daily_stats
    WHERE home_id = ?
  `;
  const params = [homeId];
  
  if (deviceId) {
    query += ' AND device_id = ?';
    params.push(deviceId);
  }
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY date DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching daily stats:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get recent alerts
router.get('/alerts', requireAuth, (req, res) => {
  const { limit = 50, deviceId, severity } = req.query;
  const homeId = req.user.home_id || 'home1';
  
  let query = `
    SELECT * FROM alerts
    WHERE home_id = ?
  `;
  const params = [homeId];
  
  if (deviceId) {
    query += ' AND device_id = ?';
    params.push(deviceId);
  }
  if (severity) {
    query += ' AND severity = ?';
    params.push(severity);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching alerts:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Acknowledge alert
router.patch('/alerts/:id/acknowledge', requireAuth, (req, res) => {
  const { id } = req.params;
  
  db.run(
    'UPDATE alerts SET acknowledged = 1 WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        console.error('Error acknowledging alert:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ ok: true, changes: this.changes });
    }
  );
});

// Get power statistics for a time range
router.get('/stats/power', requireAuth, (req, res) => {
  const { deviceId, start, end } = req.query;
  const homeId = req.user.home_id || 'home1';
  
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId required' });
  }
  
  let query = `
    SELECT 
      COUNT(*) as count,
      AVG(watts) as avg_watts,
      MAX(watts) as max_watts,
      MIN(watts) as min_watts,
      SUM(CASE WHEN watts > 5 THEN 1 ELSE 0 END) as on_readings
    FROM power_readings
    WHERE device_id = ? AND home_id = ?
  `;
  const params = [deviceId, homeId];
  
  if (start) {
    query += ' AND timestamp >= ?';
    params.push(parseInt(start));
  }
  if (end) {
    query += ' AND timestamp <= ?';
    params.push(parseInt(end));
  }
  
  db.get(query, params, (err, row) => {
    if (err) {
      console.error('Error fetching power stats:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(row || {});
  });
});

module.exports = router;
