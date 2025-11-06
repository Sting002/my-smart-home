// src/components/AppLayout.tsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { EnergyProvider } from "../contexts/EnergyContext";
import { BottomNav } from "./BottomNav";
import { ConnectionStatus } from "./ConnectionStatus";

import { Dashboard } from "../pages/Dashboard";
import { Devices } from "../pages/Devices";
import { DeviceDetail } from "../pages/DeviceDetail";
import { Automations } from "../pages/Automations";
import { Insights } from "../pages/Insights";
import { Settings } from "../pages/Settings";
import { AddDevice } from "../pages/AddDevice";
import { Onboarding } from "../pages/Onboarding";
import Login from "@/pages/Login";

import ProtectedRoute from "@/routes/ProtectedRoute";
import PublicRoute from "@/routes/PublicRoute";

import { mqttService } from "../services/mqttService";
import { useAuth } from "@/contexts/AuthContext";

const AppLayout: React.FC = () => {
  const isOnboarded = localStorage.getItem("onboarded") === "true";
  const { user } = useAuth();

  useEffect(() => {
    if (user && isOnboarded) {
      const brokerUrl = localStorage.getItem("brokerUrl") || "ws://localhost:9001/mqtt";
      mqttService.connect(brokerUrl);
    }
  }, [user, isOnboarded]);

  return (
    <>
      <Routes>
        {/* Public area (only when logged OUT) */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
        </Route>

        {/* Protected area (only when logged IN) */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/*"
            element={
              <EnergyProvider>
                <AppShell isOnboarded={isOnboarded} />
              </EnergyProvider>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

const AppShell: React.FC<{ isOnboarded: boolean }> = ({ isOnboarded }) => {
  if (!isOnboarded) {
    return <Onboarding />;
  }
  return (
    <>
      <ConnectionStatus />
      <div className="min-h-screen bg-gray-900 pb-20">
        <div className="max-w-2xl mx-auto p-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/devices/add" element={<AddDevice />} />
            <Route path="/device/:deviceId" element={<DeviceDetail />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </>
  );
};

export default AppLayout;
