import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute: React.FC = () => {
  const { user, ready } = useAuth();
  const loc = useLocation();

  if (!ready) return <div className="text-gray-200 p-4">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;

  return <Outlet />;
};

export default ProtectedRoute;
