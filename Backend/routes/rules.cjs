// Backend/routes/rules.cjs
const express = require("express");
const { authenticate, requireAuth } = require("../middleware/auth.cjs");
const { db } = require("../db.cjs");

const router = express.Router();
router.use(authenticate);

// Get all rules for authenticated user
router.get('/', requireAuth, (req, res) => {
  const userId = req.user.sub || req.user.id;

  db.all(
    'SELECT * FROM rules WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching rules:', err);
        return res.status(500).json({ error: err.message });
      }
      
      // Parse JSON fields
      const rules = rows.map(r => ({
        ...r,
        enabled: Boolean(r.enabled),
        conditions: JSON.parse(r.conditions),
        actions: JSON.parse(r.actions)
      }));
      
      res.json(rules);
    }
  );
});

// Get single rule by ID
router.get('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const userId = req.user.sub || req.user.id;
  
  db.get(
    'SELECT * FROM rules WHERE id = ? AND user_id = ?',
    [id, userId],
    (err, row) => {
      if (err) {
        console.error('Error fetching rule:', err);
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      
      const rule = {
        ...row,
        enabled: Boolean(row.enabled),
        conditions: JSON.parse(row.conditions),
        actions: JSON.parse(row.actions)
      };
      
      res.json(rule);
    }
  );
});

// Create or update rule
router.post('/', requireAuth, (req, res) => {
  const { id, name, enabled, conditions, actions, homeId } = req.body;
  const userId = req.user.sub || req.user.id;
  
  // Validation
  if (!name || !conditions || !actions) {
    return res.status(400).json({ error: 'name, conditions, and actions are required' });
  }
  
  if (!Array.isArray(conditions) || !Array.isArray(actions)) {
    return res.status(400).json({ error: 'conditions and actions must be arrays' });
  }
  
  const ruleId = id || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const ruleHomeId = homeId || req.user.home_id || 'home1';
  
  db.run(
    `INSERT OR REPLACE INTO rules (id, user_id, home_id, name, enabled, conditions, actions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      ruleId,
      userId,
      ruleHomeId,
      name,
      enabled ? 1 : 0,
      JSON.stringify(conditions),
      JSON.stringify(actions)
    ],
    function(err) {
      if (err) {
        console.error('Error saving rule:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log(`✅ Rule saved: ${name} (${ruleId})`);
      res.json({ ok: true, id: ruleId, changes: this.changes });
    }
  );
});

// Toggle rule enabled/disabled
router.patch('/:id/toggle', requireAuth, (req, res) => {
  const { id } = req.params;
  const userId = req.user.sub || req.user.id;
  
  // First, get current state
  db.get(
    'SELECT enabled FROM rules WHERE id = ? AND user_id = ?',
    [id, userId],
    (err, row) => {
      if (err) {
        console.error('Error fetching rule:', err);
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      
      const newEnabled = row.enabled ? 0 : 1;
      
      // Update enabled state
      db.run(
        'UPDATE rules SET enabled = ? WHERE id = ? AND user_id = ?',
        [newEnabled, id, userId],
        function(err) {
          if (err) {
            console.error('Error updating rule:', err);
            return res.status(500).json({ error: err.message });
          }
          
          console.log(`✅ Rule ${id} ${newEnabled ? 'enabled' : 'disabled'}`);
          res.json({ ok: true, enabled: Boolean(newEnabled), changes: this.changes });
        }
      );
    }
  );
});

// Delete rule
router.delete('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const userId = req.user.sub || req.user.id;
  
  db.run(
    'DELETE FROM rules WHERE id = ? AND user_id = ?',
    [id, userId],
    function(err) {
      if (err) {
        console.error('Error deleting rule:', err);
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      
      console.log(`✅ Rule deleted: ${id}`);
      res.json({ ok: true, deleted: this.changes });
    }
  );
});

// Bulk delete rules
router.post('/bulk-delete', requireAuth, (req, res) => {
  const { ids } = req.body;
  const userId = req.user.sub || req.user.id;
  
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  
  const placeholders = ids.map(() => '?').join(',');
  const query = `DELETE FROM rules WHERE user_id = ? AND id IN (${placeholders})`;
  
  db.run(query, [userId, ...ids], function(err) {
    if (err) {
      console.error('Error bulk deleting rules:', err);
      return res.status(500).json({ error: err.message });
    }
    
    console.log(`✅ Bulk deleted ${this.changes} rules`);
    res.json({ ok: true, deleted: this.changes });
  });
});

module.exports = router;
