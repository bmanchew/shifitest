
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  role: "merchant" | "admin";
  component: React.ComponentType<any>;
}

export default function ProtectedRoute({ role, component: Component }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (user?.role !== role) {
    return <Navigate to="/not-found" />;
  }

  return <Component />;
}
