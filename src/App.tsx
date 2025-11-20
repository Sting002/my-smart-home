import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EnergyProvider } from "@/contexts/EnergyContext";

import PublicRoute from "@/routes/PublicRoute";
import ProtectedRoute from "@/routes/ProtectedRoute";

import AppLayout from "@/components/AppLayout";

// Eager load critical pages
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import { Dashboard } from "@/pages/Dashboard";

// Lazy load secondary pages for code splitting
const Devices = lazy(() => import("@/pages/Devices").then(m => ({ default: m.Devices })));
const DeviceDetail = lazy(() => import("@/pages/DeviceDetail").then(m => ({ default: m.DeviceDetail })));
const Automations = lazy(() => import("@/pages/Automations").then(m => ({ default: m.Automations })));
const Insights = lazy(() => import("@/pages/Insights").then(m => ({ default: m.Insights })));
const Settings = lazy(() => import("@/pages/Settings"));
const AddDevice = lazy(() => import("@/pages/AddDevice"));
const Onboarding = lazy(() => import("@/pages/Onboarding").then(m => ({ default: m.Onboarding })));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const ChangePassword = lazy(() => import("@/pages/ChangePassword"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-gray-900">
    <div className="text-gray-200 text-lg">Loading...</div>
  </div>
);

export default function App() {
  const routerFutureFlags = {
    // Opt into React Router v7 behaviors early to remove deprecation warnings
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    v7_prependBasename: true,
  };

  return (
    <BrowserRouter future={routerFutureFlags}>
      <AuthProvider>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Protected app */}
            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePassword />} />
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
                <Route path="admin" element={<AdminDashboard />} />
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
