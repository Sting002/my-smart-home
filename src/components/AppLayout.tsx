import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { ConnectionStatus } from "./ConnectionStatus";
import { mqttService } from "@/services/mqttService";
import { useAuth } from "@/contexts/AuthContext";

const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const isOnboarded = localStorage.getItem("onboarded") === "true";

  useEffect(() => {
    if (user && isOnboarded) {
      const brokerUrl = localStorage.getItem("brokerUrl") || "ws://localhost:9001/mqtt";
      mqttService.connect(brokerUrl);
    }
  }, [user, isOnboarded]);

  return (
    <>
      <ConnectionStatus />
      <div className="min-h-screen bg-gray-900 pb-20">
        <div className="max-w-2xl mx-auto p-4">
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </>
  );
};

export default AppLayout;
