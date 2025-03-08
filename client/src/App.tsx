import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Routes, Route, BrowserRouter as Router } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

// Import your page components here
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import NotFoundPage from "@/pages/not-found";
import AdminDashboard from "@/pages/admin/Dashboard"; // Import from correct path
import MerchantDashboard from "@/pages/merchant/Dashboard"; // Added MerchantDashboard
import MerchantReports from "@/pages/merchant/Reports"; // Added MerchantReports
import ProtectedRoute from "@/components/auth/ProtectedRoute"; // Import from correct path

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute role="admin" component={AdminDashboard} />
          } />
          <Route path="/merchant/dashboard" element={
            <ProtectedRoute role="merchant" component={MerchantDashboard} />
          } />
          <Route path="/merchant/reports" element={
            <ProtectedRoute role="merchant" component={MerchantReports} />
          } />
          <Route path="/" element={<DashboardRedirector />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
      <Toaster />
    </div>
  );
}

// Redirector component based on user role
function DashboardRedirector() {
  const { user } = useAuth();

  React.useEffect(() => {
    // This will redirect after render based on role
    const redirectTo = user?.role === "admin" 
      ? "/admin/dashboard" 
      : user?.role === "merchant" 
        ? "/merchant/dashboard" 
        : "/login";

    window.location.href = redirectTo;
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}