// Backend/services/mqttSubscriber.cjs
const mqtt = require('mqtt');
const { db } = require('../db.cjs');

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1884';
const HOME_ID = process.env.HOME_ID || 'home1';

class MqttSubscriberService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  connect() {
    console.log(`🔌 Connecting backend MQTT subscriber to ${BROKER_URL}...`);
    
    this.client = mqtt.connect(BROKER_URL);

    this.client.on('connect', () => {
      console.log('✅ Backend MQTT subscriber connected');
      this.connected = true;
      
      // Subscribe to all power and energy topics
      this.client.subscribe(`home/${HOME_ID}/sensor/+/power`, (err) => {
        if (err) console.error('Error subscribing to power topics:', err);
        else console.log(`📡 Subscribed to: home/${HOME_ID}/sensor/+/power`);
      });
      
      this.client.subscribe(`home/${HOME_ID}/sensor/+/energy`, (err) => {
        if (err) console.error('Error subscribing to energy topics:', err);
        else console.log(`📡 Subscribed to: home/${HOME_ID}/sensor/+/energy`);
      });
      
      this.client.subscribe(`home/${HOME_ID}/event/alert`, (err) => {
        if (err) console.error('Error subscribing to alert topic:', err);
        else console.log(`📡 Subscribed to: home/${HOME_ID}/event/alert`);
      });
    });

    this.client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload.toString());
    });

    this.client.on('error', (err) => {
      console.error('❌ MQTT subscriber error:', err.message);
      this.connected = false;
    });

    this.client.on('close', () => {
      console.log('⚠️  MQTT subscriber disconnected');
      this.connected = false;
    });

    this.client.on('reconnect', () => {
      console.log('🔄 MQTT subscriber reconnecting...');
    });
  }

  handleMessage(topic, payload) {
    try {
      const data = JSON.parse(payload);
      
      if (topic.includes('/power')) {
        this.storePowerReading(topic, data);
      } else if (topic.includes('/energy')) {
        this.storeEnergyReading(topic, data);
      } else if (topic.includes('/alert')) {
        this.storeAlert(data);
      }
    } catch (err) {
      console.error('Error handling MQTT message:', err.message);
    }
  }

  storePowerReading(topic, data) {
    const parts = topic.split('/');
    const deviceId = parts[3];
    
    const timestamp = data.ts || Date.now();
    const watts = data.watts || 0;
    const voltage = data.voltage || null;
    const current = data.current || null;
    
    db.run(
      `INSERT INTO power_readings (device_id, home_id, timestamp, watts, voltage, current)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [deviceId, HOME_ID, timestamp, watts, voltage, current],
      (err) => {
        if (err) {
          console.error('Error storing power reading:', err.message);
        } else {
          // Only log every 10th reading to avoid spam
          if (Math.random() < 0.1) {
            console.log(`📊 Power: ${deviceId} = ${watts}W`);
          }
        }
      }
    );
  }

  storeEnergyReading(topic, data) {
    const parts = topic.split('/');
    const deviceId = parts[3];
    
    const timestamp = data.ts || Date.now();
    const whTotal = data.wh_total || 0;
    
    db.run(
      `INSERT INTO energy_readings (device_id, home_id, timestamp, wh_total)
       VALUES (?, ?, ?, ?)`,
      [deviceId, HOME_ID, timestamp, whTotal],
      (err) => {
        if (err) {
          console.error('Error storing energy reading:', err.message);
        } else {
          console.log(`⚡ Energy: ${deviceId} = ${whTotal}Wh total`);
        }
      }
    );
  }

  storeAlert(data) {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = data.ts || Date.now();
    
    db.run(
      `INSERT INTO alerts (id, home_id, device_id, timestamp, severity, message, type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        alertId,
        HOME_ID,
        data.deviceId || null,
        timestamp,
        data.severity || 'info',
        data.message || '',
        data.type || 'mqtt'
      ],
      (err) => {
        if (err) {
          console.error('Error storing alert:', err.message);
        } else {
          console.log(`🚨 Alert: [${data.severity}] ${data.message}`);
        }
      }
    );
  }

  disconnect() {
    if (this.client) {
      console.log('Disconnecting MQTT subscriber...');
      this.client.end();
      this.connected = false;
    }
  }
}

module.exports = new MqttSubscriberService();
