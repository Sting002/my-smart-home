import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EnergyProvider } from "@/contexts/EnergyContext";

import PublicRoute from "@/routes/PublicRoute";
import ProtectedRoute from "@/routes/ProtectedRoute";

import AppLayout from "@/components/AppLayout";

import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

// Pages
import { Dashboard } from "@/pages/Dashboard";
import { Devices } from "@/pages/Devices";
import { DeviceDetail } from "@/pages/DeviceDetail";
import { Automations } from "@/pages/Automations";
import { Insights } from "@/pages/Insights";
import Settings from "@/pages/Settings";
import  AddDevice from "@/pages/AddDevice";
import { Onboarding } from "@/pages/Onboarding";

export default function App() {
  const onboardingElement = <Onboarding />;
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="text-gray-200 p-4">Loading…</div>}>
          <Routes>
            {/* Public */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Protected shell + all app pages */}
            <Route
              element={
                <ProtectedRoute />
              }
            >
              <Route
                element={
                  <EnergyProvider>
                    <AppLayout />
                  </EnergyProvider>
                }
              >
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/devices/add" element={<AddDevice />} />
                <Route path="/device/:deviceId" element={<DeviceDetail />} />
                <Route path="/automations" element={<Automations />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/settings" element={<Settings />} />
                {/* If you gate onboarding too, you can route it here: */}
                <Route path="/onboarding" element={onboardingElement} />
              </Route>
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
