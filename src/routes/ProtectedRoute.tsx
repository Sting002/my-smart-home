// src/routes/ProtectedRoute.tsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute: React.FC = () => {
  const { user, ready } = useAuth();
  const loc = useLocation();

  if (!ready) return <div className="text-gray-200 p-4">Loading...</div>;

  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;

  const needsPasswordUpdate = !!user.mustChangePassword;
  const isChangePasswordRoute = loc.pathname.startsWith("/change-password");

  if (needsPasswordUpdate && !isChangePasswordRoute) {
    return <Navigate to="/change-password" replace />;
  }
  if (!needsPasswordUpdate && isChangePasswordRoute) {
    return <Navigate to="/dashboard" replace />;
  }

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
