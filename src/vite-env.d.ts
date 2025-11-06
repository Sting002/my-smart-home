/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_MQTT_BROKER_URL?: string;
  readonly VITE_DEFAULT_HOME_ID?: string;
  readonly VITE_DEFAULT_CURRENCY?: string;
  readonly VITE_DEFAULT_TARIFF?: string;
  readonly VITE_ENABLE_AUTO_DISCOVERY?: string;
  readonly VITE_ENABLE_NOTIFICATIONS?: string;
  readonly VITE_MAX_CHART_POINTS?: string;
  readonly VITE_DEBUG_MQTT?: string;
  readonly VITE_MOCK_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
