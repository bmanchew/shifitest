
import { Navigate } from "react-router-dom";

export default function DashboardPage() {
  // Redirect to the merchant dashboard page
  return <Navigate to="/merchant/dashboard" replace />;
}
