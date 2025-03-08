import React from "react";
import { Route, Routes } from "react-router-dom"; // Importing react-router-dom
import { Toaster } from "@/components/ui/toaster";

// Import your page components here
import LoginPage from "@/pages/Login.tsx";
// Commented out until RegisterPage is available
// import RegisterPage from "@/pages/RegisterPage.tsx";
import NotFoundPage from "@/pages/not-found.tsx";
import AdminDashboard from "@/pages/AdminDashboard.tsx"; // Added AdminDashboard
import MerchantDashboard from "@/pages/MerchantDashboard.tsx"; // Added MerchantDashboard
import CustomerDashboard from "@/pages/CustomerDashboard"; // Added CustomerDashboard

// Creating the DashboardPage component
const DashboardPage = () => {
  // Logic to determine the user type and redirect to the appropriate dashboard
  // This is a placeholder, replace with actual logic to determine user type
  const userType = localStorage.getItem('userType') || 'customer';

  switch (userType) {
    case 'admin':
      return <AdminDashboard />;
    case 'merchant':
      return <MerchantDashboard />;
    case 'customer':
    default:
      return <CustomerDashboard />;
  }
};


const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <Routes> {/* Using Routes from react-router-dom */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} /> {/* Route to the new DashboardPage */}
        <Route path="/login" element={<LoginPage />} />
        {/* Uncomment when RegisterPage is available */}
        {/* <Route path="/register" element={<RegisterPage />} /> */}
        <Route path="*" element={<NotFoundPage />} /> {/* Catch-all route */}
      </Routes>
    </div>
  );
};

export default App;