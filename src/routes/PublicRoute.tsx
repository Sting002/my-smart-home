import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const PublicRoute: React.FC = () => {
  const { user, ready } = useAuth();
  const loc = useLocation();

  if (!ready) return <div className="text-gray-200 p-4">Loading…</div>;
  if (user) {
    const to = (loc.state as { from?: string } | null)?.from || "/dashboard";
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
};

export default PublicRoute;
