import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background antialiased">
      <Router>
        <Routes>
          {/* Add your routes here */}
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/register" element={<div>Register Page</div>} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          <Route path="*" element={<div>Page Not Found</div>} />
        </Routes>
      </Router>
      <Toaster />
    </div>
  );
}