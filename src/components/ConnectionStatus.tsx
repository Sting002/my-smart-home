import React, { useState, useEffect } from "react";

export const ConnectionStatus: React.FC = () => {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const brokerUrl = localStorage.getItem("brokerUrl");
      setConnected(Boolean(brokerUrl));
    }, 2000);

    return () => window.clearInterval(interval);
  }, []);

  if (!connected) {
    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/20 border border-yellow-500 text-yellow-400 px-4 py-2 rounded-lg text-sm z-50">
        ⚠️ MQTT Disconnected - Check broker
      </div>
    );
  }

  return null;
};
