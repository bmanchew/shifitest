import React from "react";
import { Route, Routes } from "react-router-dom"; // Importing react-router-dom
import { Toaster } from "@/components/ui/toaster";

// Import your page components here
import HomePage from "@/pages/HomePage";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import NotFoundPage from "@/pages/not-found";

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <Routes> {/* Using Routes from react-router-dom */}
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} /> {/* Catch-all route */}
      </Routes>
    </div>
  );
};

export default App;