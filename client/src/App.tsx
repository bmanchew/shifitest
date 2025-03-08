import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Import layouts
import AdminLayout from './components/layout/AdminLayout';
import CustomerLayout from './components/layout/CustomerLayout';
import MerchantLayout from './components/layout/MerchantLayout';

// Import pages
import LoginPage from './pages/auth/Login';
import AdminDashboardPage from './pages/admin/Dashboard';
import CustomerApplicationPage from './pages/customer/Application';
import MerchantDashboardPage from './pages/merchant/Dashboard';
import NotFoundPage from './pages/NotFound';

// ProtectedRoute component
interface ProtectedRouteProps {
  element: React.ReactNode;
  requiredRole?: 'admin' | 'merchant' | 'customer';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ element, requiredRole }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  // Check authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{element}</>;
};

// Main App component
export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Customer routes */}
        <Route path="/customer" element={
          <ProtectedRoute 
            element={<CustomerLayout />} 
            requiredRole="customer"
          />
        }>
          <Route index element={<Navigate to="application" replace />} />
          <Route path="application" element={<CustomerApplicationPage />} />
        </Route>

        {/* Merchant routes */}
        <Route path="/merchant" element={
          <ProtectedRoute 
            element={<MerchantLayout />} 
            requiredRole="merchant"
          />
        }>
          <Route index element={<MerchantDashboardPage />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={
          <ProtectedRoute 
            element={<AdminLayout />} 
            requiredRole="admin"
          />
        }>
          <Route index element={<AdminDashboardPage />} />
        </Route>

        {/* Default route redirect to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Catch-all route for 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}