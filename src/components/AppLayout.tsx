// src/components/AppLayout.tsx
import React, { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { mqttService } from "@/services/mqttService";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { BottomNav } from "@/components/BottomNav";

const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const didConnectRef = useRef(false);

  // Connect to MQTT once when logged in AND onboarded
  useEffect(() => {
    const onboarded = localStorage.getItem("onboarded") === "true";
    if (!user || !onboarded || didConnectRef.current) return;

    const brokerUrl =
      localStorage.getItem("brokerUrl") || "ws://localhost:9001/mqtt";
    mqttService.connect(brokerUrl, { keepalive: 30, reconnectPeriod: 1000 });
    didConnectRef.current = true;
  }, [user]);

  return (
    <>
      <ConnectionStatus />
      <div className="min-h-screen bg-gray-900 pb-[82px]">
        <div className="max-w-2xl mx-auto p-4">
          {/* Nested routes render here */}
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </>
  );
};

export default AppLayout;
