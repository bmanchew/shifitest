
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Import your components/pages here
import LoginPage from './pages/auth/Login';
import DashboardPage from './pages/dashboard/Dashboard';
import CustomerApplicationPage from './pages/customer/Application';
import MerchantDashboardPage from './pages/merchant/Dashboard';
import AdminDashboardPage from './pages/admin/Dashboard';
import NotFoundPage from './pages/NotFoundPage';

// Import layouts
import CustomerLayout from './components/layout/CustomerLayout';
import MerchantLayout from './components/layout/MerchantLayout';
import AdminLayout from './components/layout/AdminLayout';

// This wrapper ensures a user is authenticated before accessing a route
const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (requiredRole && user?.role !== requiredRole) {
    // Redirect based on role if they don't have access
    if (user?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (user?.role === 'merchant') {
      return <Navigate to="/merchant/dashboard" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Customer routes */}
        <Route path="/" element={
          <ProtectedRoute requiredRole="customer">
            <CustomerLayout>
              <DashboardPage />
            </CustomerLayout>
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute requiredRole="customer">
            <CustomerLayout>
              <DashboardPage />
            </CustomerLayout>
          </ProtectedRoute>
        } />
        <Route path="/apply/:contractId" element={
          <ProtectedRoute requiredRole="customer">
            <CustomerLayout>
              <CustomerApplicationPage />
            </CustomerLayout>
          </ProtectedRoute>
        } />

        {/* Merchant routes */}
        <Route path="/merchant/dashboard" element={
          <ProtectedRoute requiredRole="merchant">
            <MerchantLayout>
              <MerchantDashboardPage />
            </MerchantLayout>
          </ProtectedRoute>
        } />

        {/* Admin routes */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout>
              <AdminDashboardPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        
        {/* Catch all route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
};

// The AppWrapper ensures the Router is correctly applied at the root level
const AppWrapper: React.FC = () => {
  return (
    <Router>
      <App />
    </Router>
  );
};

export default AppWrapper;
