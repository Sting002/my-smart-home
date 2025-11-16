import { useCallback, useEffect, useState } from "react";
import { fetchOnboardingConfig } from "@/api/onboarding";

export const DEFAULT_BROKER_URL =
  import.meta.env?.VITE_MQTT_BROKER_URL || "ws://localhost:9002/mqtt";

type BrokerConfig = {
  onboarded: boolean;
  brokerUrl: string;
};

async function readBrokerConfig(): Promise<BrokerConfig> {
  try {
    const config = await fetchOnboardingConfig();
    return {
      onboarded: config.onboarded === "true",
      brokerUrl: config.brokerUrl || DEFAULT_BROKER_URL,
    };
  } catch (error) {
    console.error("Error fetching onboarding config:", error);
    return {
      onboarded: false,
      brokerUrl: DEFAULT_BROKER_URL,
    };
  }
}

export function useOnboardingConfig() {
  const [config, setConfig] = useState<BrokerConfig>({
    onboarded: false,
    brokerUrl: DEFAULT_BROKER_URL,
  });
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    readBrokerConfig()
      .then(setConfig)
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { config, refresh, loaded };
}
