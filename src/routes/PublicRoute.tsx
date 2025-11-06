// src/routes/PublicRoute.tsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const PublicRoute: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null; // or spinner
  }
  if (user) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }
  return <Outlet />;
};

export default PublicRoute;
