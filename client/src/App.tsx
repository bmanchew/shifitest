import React from 'react';
import { useAuth } from './hooks/useAuth';
import { Route } from 'wouter'; // Using only wouter
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
      <Route path="/login" component={LoginPage} />

      <Route path="/" component={() => (
        <ProtectedRoute requiredRole="customer">
          <CustomerLayout>
            <DashboardPage />
          </CustomerLayout>
        </ProtectedRoute>
      )} />
      <Route path="/dashboard" component={() => (
        <ProtectedRoute requiredRole="customer">
          <CustomerLayout>
            <DashboardPage />
          </CustomerLayout>
        </ProtectedRoute>
      )} />
      <Route path="/apply/:contractId" component={() => (
        <ProtectedRoute requiredRole="customer">
          <CustomerLayout>
            <CustomerApplicationPage />
          </CustomerLayout>
        </ProtectedRoute>
      )} />

      <Route path="/merchant/dashboard" component={() => (
        <ProtectedRoute requiredRole="merchant">
          <MerchantLayout>
            <MerchantDashboardPage />
          </MerchantLayout>
        </ProtectedRoute>
      )} />

      <Route path="/admin/dashboard" component={() => (
        <ProtectedRoute requiredRole="admin">
          <AdminLayout>
            <AdminDashboardPage />
          </AdminLayout>
        </ProtectedRoute>
      )} />

      <Route path="*" component={NotFoundPage} />
    </div>
  );
};


const AppWrapper: React.FC = () => {
  return (
    <Router> {/*wouter's Router is not necessary here*/}
      <App />
    </Router>
  );
};

export default AppWrapper;