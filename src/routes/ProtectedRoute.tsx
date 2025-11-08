// src/routes/ProtectedRoute.tsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute: React.FC = () => {
  const { user, ready } = useAuth();
  const loc = useLocation();

  if (!ready) return <div className="text-gray-200 p-4">Loading…</div>;

  // Not logged in → go to /login
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;

  // Enforce onboarding
  const onboarded = localStorage.getItem("onboarded") === "true";
  const isOnboardingRoute = loc.pathname.endsWith("/onboarding");

  if (!onboarded && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }
  if (onboarded && isOnboardingRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
