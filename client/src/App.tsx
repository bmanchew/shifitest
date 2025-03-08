
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

// Import your page components here
import LoginPage from "@/pages/Login";
import NotFoundPage from "@/pages/not-found";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AdminDashboard from "@/pages/admin/Dashboard";
import MerchantDashboard from "@/pages/merchant/Dashboard";
import MerchantReports from "@/pages/merchant/Reports";

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
      </BrowserRouter>
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
