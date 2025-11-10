import { useCallback, useEffect, useState } from "react";

export const DEFAULT_BROKER_URL =
  import.meta.env?.VITE_MQTT_BROKER_URL || "ws://localhost:9001/mqtt";

type BrokerConfig = {
  onboarded: boolean;
  brokerUrl: string;
};

function readBrokerConfig(): BrokerConfig {
  return {
    onboarded: localStorage.getItem("onboarded") === "true",
    brokerUrl: localStorage.getItem("brokerUrl") || DEFAULT_BROKER_URL,
  };
}

export function useOnboardingConfig() {
  const [config, setConfig] = useState<BrokerConfig>(() => readBrokerConfig());

  const refresh = useCallback(() => {
    setConfig(readBrokerConfig());
  }, []);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === "onboarded" ||
        event.key === "brokerUrl"
      ) {
        setConfig(readBrokerConfig());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return { config, refresh };
}
