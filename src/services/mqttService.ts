// src/services/mqttService.ts
import mqtt, {
  IClientOptions,
  MqttClient,
  IClientPublishOptions,
} from "mqtt";

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
export type MqttPayload =
  | PowerReading
  | EnergyReading
  | DeviceCommand
  | AlertPayload
  | Record<string, unknown>;

export interface MqttMessageContext {
  topic: string;
  raw: string;
}

type StatusCB = (status: MqttStatus, err?: Error) => void;
type MessageCB<T = unknown> = (data: T, ctx: MqttMessageContext) => void;

function mqttPatternToRegex(pattern: string): RegExp {
  // Convert MQTT wildcards to regex
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const plus = esc.replace(/\\\+/g, "[^/]+");
  const hash = plus.replace(/\\#/g, ".*");
  return new RegExp(`^${hash}$`);
}

class MQTTService {
  private client: MqttClient | null = null;
  private currentUrl: string | null = null;

  // Wildcard-friendly subscription registry
  private subs: Array<{ pattern: string; regex: RegExp; cb: MessageCB }> = [];

  private statusListeners: Set<StatusCB> = new Set();

  /** Public helper for guards in React code */
  public isConnected(): boolean {
    return this.client?.connected === true;
  }

  /** Low-level connect (does not wait) */
  connect(brokerUrl: string, options?: IClientOptions) {
    const client = mqtt.connect(brokerUrl, {
      reconnectPeriod: 1000,
      keepalive: 30,
      ...options,
    });

    this.client = client;
    this.currentUrl = brokerUrl;

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
      } catch (e) {
        // keep ESLint happy and skip non-JSON payloads
        if (import.meta.env?.VITE_DEBUG_MQTT === "true") {
          console.debug("MQTT non-JSON payload on", topic);
        }
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

  /** High-level connect that **waits** for 'connect' or rejects on error/timeout */
  async connectAndWait(brokerUrl: string, timeoutMs = 7000, options?: IClientOptions) {
    // If already connected to the same URL, resolve quick
    if (this.client && this.client.connected && this.currentUrl === brokerUrl) {
      return;
    }

    // If connected to a different URL, switch by disconnecting first
    if (this.client && this.client.connected && this.currentUrl !== brokerUrl) {
      this.disconnect();
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          // Ensure no lingering auto-reconnect loop
          this.disconnect();
          reject(new Error("MQTT connect timeout"));
        }
      }, timeoutMs);

      const onConnect = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        // Ensure no lingering auto-reconnect loop
        this.disconnect();
        reject(err);
      };

      const cleanup = () => {
        this.client?.off("connect", onConnect);
        this.client?.off("error", onError);
      };

      this.connect(brokerUrl, options);
      this.client?.once("connect", onConnect);
      this.client?.once("error", onError);
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
    const entry = { pattern, regex: mqttPatternToRegex(pattern), cb: callback as MessageCB };
    this.subs.push(entry);

    if (!this.client || !this.client.connected) {
      if (import.meta.env?.VITE_DEBUG_MQTT === "true") {
        console.warn("MQTT subscribe called before connect:", pattern);
      }
      return;
    }

    this.client.subscribe(pattern, (err) => {
      if (err) {
        console.error("MQTT subscribe error:", pattern, err);
      }
    });
  }

  unsubscribe<T = unknown>(pattern: string, callback?: MessageCB<T>) {
    // Remove from local registry
    if (callback) {
      this.subs = this.subs.filter(
        (s) => !(s.pattern === pattern && s.cb === (callback as MessageCB))
      );
    } else {
      this.subs = this.subs.filter((s) => s.pattern !== pattern);
    }

    // Unsub from broker if connected
    if (this.client && this.client.connected) {
      this.client.unsubscribe(pattern, (err) => {
        if (err && import.meta.env?.VITE_DEBUG_MQTT === "true") {
          console.error("MQTT unsubscribe error:", pattern, err);
        }
      });
    } else {
      // keep ESLint happy (no-empty)
      if (import.meta.env?.VITE_DEBUG_MQTT === "true") {
        console.debug("MQTT unsubscribe queued (not connected yet):", pattern);
      }
    }
  }

  publish<T extends object>(topic: string, payload: T, opts?: IClientPublishOptions) {
    if (!this.client || !this.client.connected) return;
    this.client.publish(topic, JSON.stringify(payload), opts);
  }

  /** Publish raw payload without JSON encoding (e.g., to clear retained messages) */
  publishRaw(topic: string, payload: string | Buffer, opts?: IClientPublishOptions) {
    if (!this.client || !this.client.connected) return;
    this.client.publish(topic, payload, opts);
  }

  disconnect() {
    this.client?.end(true);
    this.client = null;
    this.currentUrl = null;
    this.subs = [];
    // Keep status listeners registered so consumers continue to receive updates after reconnect
  }
}

export const mqttService = new MQTTService();
