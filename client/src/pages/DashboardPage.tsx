
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Route to the appropriate dashboard based on user type
    if (user?.role === 'admin') {
      navigate('/admin/dashboard');
    } else if (user?.role === 'merchant') {
      navigate('/merchant/dashboard');
    } else if (user?.role === 'customer') {
      navigate('/customer/dashboard');
    }
  }, [user, navigate]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
