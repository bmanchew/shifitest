
import React from "react";
import { Route, Switch } from "wouter";
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
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/:path*" component={NotFoundPage} />
      </Switch>
    </div>
  );
};

export default App;
