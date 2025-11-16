// Backend/services/ruleEngine.cjs
const { db } = require('../db.cjs');
const mqtt = require('mqtt');

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1884';
const EVAL_INTERVAL = parseInt(process.env.RULE_EVAL_INTERVAL_MS || '30000'); // 30 seconds
const DAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

class RuleEngine {
  constructor() {
    this.mqttClient = null;
    this.evalTimer = null;
    this.deviceStates = new Map();
    this.powerConditionTimers = new Map();
    this.timeConditionLog = new Map();
  }

  start() {
    console.log('🤖 Starting Rule Engine...');
    
    // Connect to MQTT for sending commands
    this.mqttClient = mqtt.connect(BROKER_URL);
    
    this.mqttClient.on('connect', () => {
      console.log('✅ Rule engine connected to MQTT broker');
    });

    this.mqttClient.on('error', (err) => {
      console.error('❌ Rule engine MQTT error:', err.message);
    });
    
    // Start rule evaluation loop
    this.evalTimer = setInterval(() => {
      this.evaluateRules();
    }, EVAL_INTERVAL);

    console.log(`✅ Rule engine running (eval every ${EVAL_INTERVAL / 1000}s)`);
  }

  async evaluateRules() {
    // Get all enabled rules
    db.all('SELECT * FROM rules WHERE enabled = 1', [], async (err, rules) => {
      if (err) {
        console.error('Error fetching rules:', err.message);
        return;
      }

      if (rules.length === 0) return;

      for (const rule of rules) {
        try {
          const conditions = JSON.parse(rule.conditions);
          const actions = JSON.parse(rule.actions);
          
          // Check if all conditions are met
          const conditionsMet = await this.checkConditions(conditions, rule.home_id, rule.id);
          
          if (conditionsMet) {
            console.log(`✅ Rule triggered: ${rule.name}`);
            await this.executeActions(actions, rule.home_id, rule.user_id);
          }
        } catch (err) {
          console.error(`Error evaluating rule ${rule.id}:`, err.message);
        }
      }
    });
  }

  async checkConditions(conditions, homeId, ruleId) {
    // If no conditions, always true
    if (!conditions || conditions.length === 0) return true;

    // Check each condition (AND logic)
    for (const condition of conditions) {
      try {
        const met = await this.checkSingleCondition(condition, homeId, ruleId);
        if (!met) return false; // Short-circuit on first failure
      } catch (err) {
        console.error('Error checking condition:', err.message);
        return false;
      }
    }
    
    return true; // All conditions met
  }

  async checkSingleCondition(condition, homeId, ruleId) {
    switch (condition.type) {
      case 'power_threshold': {
        const { deviceId, operator, threshold, durationMinutes } = condition;
        const reading = await this.getLatestPowerReading(deviceId);

        if (!reading) return false;

        const matches = this.evaluateOperator(reading.watts, operator, threshold);
        if (!durationMinutes || durationMinutes <= 0) {
          return matches;
        }

        const key = `${ruleId || "rule"}:${deviceId || "device"}`;
        if (matches) {
          const since = this.powerConditionTimers.get(key) ?? Date.now();
          this.powerConditionTimers.set(key, since);
          const elapsed = (Date.now() - since) / 60000;
          return elapsed >= durationMinutes;
        }
        this.powerConditionTimers.delete(key);
        return false;
      }

      case 'time_of_day': {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentMinutes = hour * 60 + minute;
        const { start, end, mode } = condition;

        const parseMinutes = (value) => {
          if (typeof value === 'string') {
            const [h, m] = value.split(':').map(Number);
            return (h || 0) * 60 + (m || 0);
          }
          return Number(value || 0) * 60;
        };

        if (mode === 'exact') {
          const startMinutes = parseMinutes(start);
          const targetHour = Math.floor(startMinutes / 60);
          const targetMinute = startMinutes % 60;
          const key = `${ruleId || "rule"}:${targetHour}:${targetMinute}`;
          const todayKey = now.toDateString();
          if (hour === targetHour && minute === targetMinute) {
            if (this.timeConditionLog.get(key) === todayKey) {
              return false;
            }
            this.timeConditionLog.set(key, todayKey);
            return true;
          }
          return false;
        }

        const startMinutes = parseMinutes(start);
        const endMinutes = parseMinutes(end);

        if (endMinutes < startMinutes) {
          return currentMinutes >= startMinutes || currentMinutes < endMinutes;
        }

        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      }

      case 'device_state': {
        const { deviceId, state } = condition;
        const reading = await this.getLatestPowerReading(deviceId);
        
        if (!reading) return state === 'off'; // No reading = assume off
        
        const isOn = reading.watts > 5;
        return (state === 'on' && isOn) || (state === 'off' && !isOn);
      }

      case 'energy_threshold': {
        const { deviceId, operator, threshold } = condition;
        const reading = await this.getLatestEnergyReading(deviceId);
        
        if (!reading) return false;
        
        return this.evaluateOperator(reading.wh_total, operator, threshold);
      }

      case 'day_of_week': {
        const currentDay = new Date().getDay(); // 0 = Sunday, 6 = Saturday
        const { days = [] } = condition;
        const normalized = days.map((day) => {
          if (typeof day === 'string') {
            const idx = DAY_ORDER.indexOf(day.toLowerCase());
            return idx >= 0 ? idx : null;
          }
          return day;
        });
        return normalized.includes(currentDay);
      }

      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  async executeActions(actions, homeId, userId) {
    for (const action of actions) {
      try {
        await this.executeSingleAction(action, homeId, userId);
      } catch (err) {
        console.error('Error executing action:', err.message);
      }
    }
  }

  async executeSingleAction(action, homeId, userId) {
    switch (action.type) {
      case 'set_device': {
        const { deviceId, on } = action;
        const topic = `home/${homeId}/cmd/${deviceId}/set`;
        const payload = JSON.stringify({ on });
        
        this.mqttClient.publish(topic, payload, { qos: 1 });
        console.log(`🎯 Action: ${deviceId} → ${on ? 'ON' : 'OFF'}`);
        break;
      }

      case 'alert': {
        const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = Date.now();
        
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO alerts (id, home_id, timestamp, severity, message, type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              alertId,
              homeId,
              timestamp,
              action.severity || 'info',
              action.message || 'Rule triggered',
              'rule_action'
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        console.log(`🚨 Alert created: [${action.severity}] ${action.message}`);
        break;
      }

      case 'scene': {
        // Execute a scene by name
        const { sceneName } = action;
        console.log(`🎬 Scene action: ${sceneName}`);
        // Scene logic would go here
        break;
      }

      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  getLatestPowerReading(deviceId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM power_readings
         WHERE device_id = ?
         ORDER BY timestamp DESC
         LIMIT 1`,
        [deviceId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  getLatestEnergyReading(deviceId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM energy_readings
         WHERE device_id = ?
         ORDER BY timestamp DESC
         LIMIT 1`,
        [deviceId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  evaluateOperator(value, operator, threshold) {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==':
      case '=': return value === threshold;
      case '!=': return value !== threshold;
      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  stop() {
    console.log('Stopping Rule Engine...');
    
    if (this.evalTimer) {
      clearInterval(this.evalTimer);
      this.evalTimer = null;
    }
    
    if (this.mqttClient) {
      this.mqttClient.end();
      this.mqttClient = null;
    }
  }
}

module.exports = new RuleEngine();
