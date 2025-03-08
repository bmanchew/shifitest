import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  role: "merchant" | "admin";
  component: React.ComponentType<any>;
}

export default function ProtectedRoute({ role, component: Component }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (user?.role !== role) {
    return <Redirect to="/not-found" />;
  }

  return <Component />;
}