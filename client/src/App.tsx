
import { Routes, Route, BrowserRouter } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import "./App.css";

// Lazy-loaded components
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const CustomerApplication = lazy(() => import("@/pages/customer/Application"));
const CustomerDashboard = lazy(() => import("@/pages/customer/Dashboard"));
const MerchantDashboard = lazy(() => import("@/pages/merchant/Dashboard"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function App() {
  return (
    <div className="min-h-screen bg-background">
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customer/dashboard" element={<CustomerDashboard />} />
            <Route path="/customer/application" element={<CustomerApplication />} />
            <Route path="/apply/:contractId" element={<CustomerApplication />} />
            <Route path="/merchant/dashboard" element={<MerchantDashboard />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
