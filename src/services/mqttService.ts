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

// Debug logger (silent unless VITE_DEBUG_MQTT === "true")
const debug = (...args: unknown[]) => {
  if ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DEBUG_MQTT === "true") {
    console.log("[MQTT]", ...args);
  }
};


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

  /** Fire-and-forget connect (use connectAndWait if you need to confirm link) */
  connect(brokerUrl: string, options?: IClientOptions) {
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
          if (err) {
            console.error("MQTT resubscribe error:", s.pattern, err);
          } else {
            debug("Resubscribed:", s.pattern);
          }
        });
      }
      this.notifyStatus("connected");
      debug("Connected");
    });

    client.on("reconnect", () => {
      this.notifyStatus("reconnecting");
      debug("Reconnecting…");
    });

    client.on("close", () => {
      this.notifyStatus("disconnected");
      debug("Disconnected");
    });

    client.on("offline", () => {
      this.notifyStatus("disconnected");
      debug("Offline");
    });

    client.on("error", (err: Error) => {
      this.notifyStatus("error", err);
      console.error("MQTT error:", err);
    });

    client.on("message", (topic: string, message: Buffer) => {
      const raw = message.toString();
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        // Not JSON – deliver raw string via ctx.raw; parsed will be undefined
        debug("Non-JSON payload on", topic, raw);
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

  /**
   * Connect and wait until the broker reports 'connect', or reject on error/timeout.
   * Ensures no empty catch blocks and proper cleanup on failure.
   */
  connectAndWait(brokerUrl: string, options?: IClientOptions, timeoutMs = 5000): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(brokerUrl, {
        reconnectPeriod: 0, // no auto-reconnect for deterministic outcome
        keepalive: 30,
        ...options,
      });

      let settled = false;
      const done = (fn: () => void) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };

      const onConnect = () =>
        done(() => {
          this.client = client;

          // wire the standard handlers now that we accept this client
          client.on("reconnect", () => {
            this.notifyStatus("reconnecting");
            debug("Reconnecting…");
          });
          client.on("close", () => {
            this.notifyStatus("disconnected");
            debug("Disconnected");
          });
          client.on("offline", () => {
            this.notifyStatus("disconnected");
            debug("Offline");
          });
          client.on("error", (err: Error) => {
            this.notifyStatus("error", err);
            console.error("MQTT error:", err);
          });
          client.on("message", (topic: string, message: Buffer) => {
            const raw = message.toString();
            let parsed: unknown;
            try {
              parsed = JSON.parse(raw);
            } catch (e) {
              debug("Non-JSON payload on", topic, raw);
              parsed = undefined;
            }
            const ctx: MqttMessageContext = { topic, raw };
            for (const s of this.subs) {
              if (s.regex.test(topic)) s.cb(parsed as MqttPayload, ctx);
            }
          });

          this.notifyStatus("connected");
          debug("Connected (await)");
          resolve();
        });

      const onError = (err: Error) =>
        done(() => {
          try {
            client.end(true);
          } catch (e) {
            // We intentionally swallow shutdown errors but leave a breadcrumb in debug mode.
            debug("Error while closing client after connect error:", e);
          }
          reject(err);
        });

      const onTimeout = () =>
        done(() => {
          try {
            client.end(true);
          } catch (e) {
            debug("Error while closing client after timeout:", e);
          }
          reject(new Error("MQTT connection timed out"));
        });

      // One-shot listeners for connect / error / timeout resolution
      client.once("connect", onConnect);
      client.once("error", onError);

      setTimeout(onTimeout, timeoutMs);
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
    if (!this.client) {
      console.warn("MQTT subscribe called before connect:", pattern);
      return;
    }
    const entry = { pattern, regex: mqttPatternToRegex(pattern), cb: callback as MessageCB };
    this.subs.push(entry);
    this.client.subscribe(pattern, (err) => {
      if (err) {
        console.error("MQTT subscribe error:", pattern, err);
      } else {
        debug("Subscribed:", pattern);
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
    // Unsub from broker (safe even if wildcard)
    if (this.client) {
      this.client.unsubscribe(pattern, (err) => {
        if (err) {
          console.error("MQTT unsubscribe error:", pattern, err);
        } else {
          debug("Unsubscribed:", pattern);
        }
      });
    }
  }

  publish<T extends object>(topic: string, payload: T, opts?: IClientPublishOptions) {
    if (!this.client) {
      console.warn("MQTT publish before connect:", topic);
      return;
    }
    this.client.publish(topic, JSON.stringify(payload), opts);
  }

  disconnect() {
    try {
      this.client?.end(true);
    } catch (e) {
      debug("Error while disconnecting:", e);
    }
    this.client = null;
    this.subs = [];
    this.statusListeners.clear();
  }
}

export const mqttService = new MQTTService();
