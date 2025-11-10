import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EnergyProvider } from "@/contexts/EnergyContext";

import PublicRoute from "@/routes/PublicRoute";
import ProtectedRoute from "@/routes/ProtectedRoute";

import AppLayout from "@/components/AppLayout";

import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import { Dashboard } from "@/pages/Dashboard";
import { Devices } from "@/pages/Devices";
import { DeviceDetail } from "@/pages/DeviceDetail";
import { Automations } from "@/pages/Automations";
import { Insights } from "@/pages/Insights";
import Settings from "@/pages/Settings";
import AddDevice from "@/pages/AddDevice";
import { Onboarding } from "@/pages/Onboarding";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="text-gray-200 p-4">Loading.</div>}>
          <Routes>
            {/* Public */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Protected app */}
            <Route element={<ProtectedRoute />}>
              {/* Parent needs trailing * because children are nested */}
              <Route
                path="/*"
                element={
                  <EnergyProvider>
                    <AppLayout />
                  </EnergyProvider>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="devices" element={<Devices />} />
                <Route path="devices/add" element={<AddDevice />} />
                <Route path="device/:deviceId" element={<DeviceDetail />} />
                <Route path="automations" element={<Automations />} />
                <Route path="insights" element={<Insights />} />
                <Route path="settings" element={<Settings />} />
                <Route path="onboarding" element={<Onboarding />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
