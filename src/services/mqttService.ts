// src/services/mqttService.ts
import mqtt, { IClientOptions, MqttClient, IClientPublishOptions } from "mqtt";

export interface PowerReading {
  ts: number;
  watts: number;
  voltage?: number;
  current?: number;
}
export interface EnergyReading {
  ts: number;
  wh_total: number;
}
export interface DeviceCommand {
  on: boolean;
}
export interface AlertPayload {
  ts: number;
  deviceId: string;
  type: string;
  severity: "info" | "warning" | "danger";
  message: string;
}

export type MqttStatus = "connected" | "disconnected" | "reconnecting" | "error";
export type MqttPayload = PowerReading | EnergyReading | DeviceCommand | AlertPayload | Record<string, unknown>;

export interface MqttMessageContext {
  topic: string;
  raw: string;
}

type StatusCB = (status: MqttStatus, err?: Error) => void;
type MessageCB<T = unknown> = (data: T, ctx: MqttMessageContext) => void;

function mqttPatternToRegex(pattern: string): RegExp {
  // Convert MQTT wildcards to regex:
  // "+"  -> one level: [^/]+
  // "#"  -> multi level: .*
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const plus = esc.replace(/\\\+/g, "[^/]+");
  const hash = plus.replace(/\\#/g, ".*");
  return new RegExp(`^${hash}$`);
}

class MQTTService {
  private client: MqttClient | null = null;

  // Wildcard-friendly subscription registry
  private subs: Array<{ pattern: string; regex: RegExp; cb: MessageCB }> = [];

  private statusListeners: Set<StatusCB> = new Set();

  connect(brokerUrl: string, options?: IClientOptions) {
    // Sensible defaults; allow override
    const client = mqtt.connect(brokerUrl, {
      reconnectPeriod: 1000,
      keepalive: 30,
      ...options,
    });

    this.client = client;

    client.on("connect", () => {
      // Re-subscribe all patterns after reconnect
      for (const s of this.subs) {
        client.subscribe(s.pattern, (err) => {
          if (err && import.meta.env?.VITE_DEBUG_MQTT === "true") {
            console.error("MQTT resubscribe error:", s.pattern, err);
          }
        });
      }
      this.notifyStatus("connected");
      if (import.meta.env?.VITE_DEBUG_MQTT === "true") {
        console.log("MQTT Connected");
      }
    });

    client.on("reconnect", () => {
      this.notifyStatus("reconnecting");
      if (import.meta.env?.VITE_DEBUG_MQTT === "true") {
        console.log("MQTT reconnecting…");
      }
    });

    client.on("close", () => {
      this.notifyStatus("disconnected");
      if (import.meta.env?.VITE_DEBUG_MQTT === "true") {
        console.log("MQTT Disconnected");
      }
    });

    client.on("offline", () => {
      this.notifyStatus("disconnected");
      if (import.meta.env?.VITE_DEBUG_MQTT === "true") {
        console.log("MQTT Offline");
      }
    });

    client.on("error", (err: Error) => {
      this.notifyStatus("error", err);
      if (import.meta.env?.VITE_DEBUG_MQTT === "true") {
        console.error("MQTT error:", err);
      }
    });

    client.on("message", (topic: string, message: Buffer) => {
      const raw = message.toString();
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // ignore non-JSON payloads
        parsed = undefined;
      }
      const ctx: MqttMessageContext = { topic, raw };

      // Dispatch to all matching wildcard subscribers
      for (const s of this.subs) {
        if (s.regex.test(topic)) {
          s.cb(parsed as MqttPayload, ctx);
        }
      }
    });
  }

  onStatusChange(cb: StatusCB) {
    this.statusListeners.add(cb);
  }
  offStatusChange(cb: StatusCB) {
    this.statusListeners.delete(cb);
  }
  private notifyStatus(status: MqttStatus, err?: Error) {
    for (const cb of this.statusListeners) cb(status, err);
  }

  subscribe<T = unknown>(pattern: string, callback: MessageCB<T>) {
    if (!this.client) return;
    const entry = { pattern, regex: mqttPatternToRegex(pattern), cb: callback as MessageCB };
    this.subs.push(entry);
    this.client.subscribe(pattern, (err) => {
      if (err) {
        console.error("MQTT subscribe error:", pattern, err);
      }
    });
  }

  unsubscribe<T = unknown>(pattern: string, callback?: MessageCB<T>) {
    // Remove from local registry
    if (callback) {
      this.subs = this.subs.filter((s) => !(s.pattern === pattern && s.cb === (callback as MessageCB)));
    } else {
      this.subs = this.subs.filter((s) => s.pattern !== pattern);
    }
    // Unsub from broker (safe even if wildcard)
    this.client?.unsubscribe(pattern, (err) => {
      if (err && import.meta.env?.VITE_DEBUG_MQTT === "true") {
        console.error("MQTT unsubscribe error:", pattern, err);
      }
    });
  }

  publish<T extends object>(topic: string, payload: T, opts?: IClientPublishOptions) {
    if (!this.client) return;
    this.client.publish(topic, JSON.stringify(payload), opts);
  }

  disconnect() {
    this.client?.end(true);
    this.client = null;
    this.subs = [];
    this.statusListeners.clear();
  }
}

export const mqttService = new MQTTService();
