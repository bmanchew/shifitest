
import React from 'react';
import { Route, Switch, Link, useLocation } from "wouter";
import { Toaster } from '@/components/ui/toaster';

// Import your page components here
// Example: import HomePage from './pages/HomePage';

export default function App() {
  return (
    <div className="app">
      <Switch>
        <Route path="/" component={() => <div>Home Page</div>} />
        <Route path="/admin/*" component={AdminRoutes} />
        <Route path="/merchant/*" component={() => <div>Merchant Dashboard</div>} />
        <Route path="/customer/dashboard" component={() => <div>Customer Dashboard</div>} />
        <Route path="/customer/contracts" component={() => <div>Customer Contracts</div>} />
        <Route path="/apply/:contractId" component={() => <div>Application Flow</div>} />
        <Route path="/login" component={() => <div>Login Page</div>} />
        <Route path="/register" component={() => <div>Register Page</div>} />
        <Route path="*" component={() => <div>404 Not Found</div>} />
      </Switch>
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
        <Switch>
          <Route path="/admin/dashboard" component={() => <div>Admin Dashboard</div>} />
          <Route path="/admin/contracts" component={() => <div>Contracts Management</div>} />
          <Route path="/admin/users" component={() => <div>Users Management</div>} />
          <Route path="/admin/merchants" component={() => <div>Merchants Management</div>} />
          <Route path="/admin/*" component={() => <div>Admin Page Not Found</div>} />
        </Switch>
      </main>
    </div>
  );
}

// Helper component to handle navigation links with active state
function AdminNavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const [location] = useLocation();
  const isActive = location === to;

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
