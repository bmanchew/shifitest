
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

// Import your pages
import LoginPage from './pages/Login';
import DashboardPage from './pages/dashboard/Dashboard';
import CustomerApplicationPage from './pages/customer/Application';
import MerchantDashboardPage from './pages/merchant/Dashboard';
import AdminDashboardPage from './pages/admin/Dashboard';
import NotFoundPage from './pages/not-found';

// Import your layouts
import CustomerLayout from './components/layout/CustomerLayout';
import MerchantLayout from './components/layout/MerchantLayout';
import AdminLayout from './components/layout/AdminLayout';

// ProtectedRoute component
interface ProtectedRouteProps {
  element: React.ReactNode;
  requiredRole?: 'admin' | 'merchant' | 'customer';
}

const ProtectedRoute = ({ element, requiredRole }: ProtectedRouteProps) => {
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

  };

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

export default App;
