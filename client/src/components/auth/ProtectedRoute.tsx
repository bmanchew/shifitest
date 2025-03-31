
import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  role: "merchant" | "admin" | "investor";
  component: React.ComponentType<any>;
}

export default function ProtectedRoute({ role, component: Component }: ProtectedRouteProps) {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();

  // If user isn't logged in, redirect to login
  if (!user) {
    setLocation("/login");
    return null;
  }

  // If user doesn't have the required role, redirect to not found
  if (user.role !== role) {
    setLocation("/not-found");
    return null;
  }

  return <Component />;
}
