import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Routes, Route, Navigate } from 'react-router-dom';
// Import your components/pages here
import LoginPage from './pages/Login';
import DashboardPage from './pages/dashboard/Dashboard';
import CustomerApplicationPage from './pages/customer/Application';
import MerchantDashboardPage from './pages/merchant/MerchantDashboard';
import AdminDashboardPage from './pages/admin/AdminDashboard';
import NotFoundPage from './pages/error/NotFound';
import CustomerLayout from './components/layout/CustomerLayout';
import MerchantLayout from './components/layout/MerchantLayout';
import AdminLayout from './components/layout/AdminLayout';

// ProtectedRoute component
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // Redirect to appropriate dashboard based on role
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
        <Route path="/login" element={<LoginPage />} />

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

        <Route path="/merchant/dashboard" element={
          <ProtectedRoute requiredRole="merchant">
            <MerchantLayout>
              <MerchantDashboardPage />
            </MerchantLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin/dashboard" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout>
              <AdminDashboardPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
};

const AppWrapper: React.FC = () => {
  return <App />;
};

export default AppWrapper;