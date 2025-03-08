
import React from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';

// Import your page components here
// Example: import HomePage from './pages/HomePage';

export default function App() {
  return (
    <div className="app">
      <Routes>
        {/* Define your routes here */}
        {/* Example: <Route path="/" element={<HomePage />} /> */}
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/admin/*" element={<AdminRoutes />} />
      </Routes>
      <Toaster />
    </div>
  );
}

function AdminRoutes() {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <nav className="space-y-1">
          <AdminNavLink to="/admin/dashboard">Dashboard</AdminNavLink>
          <AdminNavLink to="/admin/contracts">Contracts</AdminNavLink>
          <AdminNavLink to="/admin/users">Users</AdminNavLink>
          <AdminNavLink to="/admin/merchants">Merchants</AdminNavLink>
        </nav>
      </aside>
      <main className="admin-content">
        <Routes>
          <Route path="dashboard" element={<div>Admin Dashboard</div>} />
          <Route path="contracts" element={<div>Contracts Management</div>} />
          <Route path="users" element={<div>Users Management</div>} />
          <Route path="merchants" element={<div>Merchants Management</div>} />
        </Routes>
      </main>
    </div>
  );
}

// Helper component to handle navigation links with active state
function AdminNavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const isActive = window.location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
        isActive
          ? 'bg-gray-100 text-gray-900'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {children}
    </Link>
  );
}
