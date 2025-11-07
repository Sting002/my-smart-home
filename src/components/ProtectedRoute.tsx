// src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, ready } = useAuth();
  const loc = useLocation();

  if (!ready) {
    return <div className="text-gray-200 p-4">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;
