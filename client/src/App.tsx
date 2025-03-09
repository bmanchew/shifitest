import { Switch, Route, Router } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import { useAuth } from "@/hooks/use-auth";
import { Suspense, lazy } from "react";

// Admin pages
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminMerchants = lazy(() => import("@/pages/admin/Merchants"));
const AdminContracts = lazy(() => import("@/pages/admin/Contracts"));
const AdminLogs = lazy(() => import("@/pages/admin/Logs"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));

// Merchant pages
const MerchantDashboard = lazy(() => import("@/pages/merchant/Dashboard"));
const MerchantContracts = lazy(() => import("@/pages/merchant/Contracts"));
const MerchantReports = lazy(() => import("@/pages/merchant/Reports"));
const MerchantSettings = lazy(() => import("@/pages/merchant/Settings"));

// Customer pages
const CustomerApplication = lazy(() => import("@/pages/customer/Application"));
const CustomerContractOffer = lazy(
  () => import("@/pages/customer/ContractOffer"),
);
const CustomerDashboard = lazy(() => import("@/pages/customer/Dashboard"));

function LoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
        <p className="mt-4 text-lg font-medium text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  const { user, isLoading } = useAuth();

  return (
    <Suspense fallback={<LoadingFallback />}>
      {isLoading ? (
        <LoadingFallback />
      ) : (
        <Switch>
          {!user && <Route path="/" component={Login} />}

          {user && user.role === "admin" && (
            <>
              <Route path="/" component={AdminDashboard} />
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/dashboard" component={AdminDashboard} />
              <Route path="/admin/merchants" component={AdminMerchants} />
              <Route path="/admin/contracts" component={AdminContracts} />
              <Route path="/admin/logs" component={AdminLogs} />
              <Route path="/admin/settings" component={AdminSettings} />
            </>
          )}

          {user && user.role === "merchant" && (
            <>
              <Route path="/" component={MerchantDashboard} />
              <Route path="/merchant" component={MerchantDashboard} />
              <Route path="/merchant/dashboard" component={MerchantDashboard} />
              <Route path="/merchant/contracts" component={MerchantContracts} />
              <Route path="/merchant/reports" component={MerchantReports} />
              <Route path="/merchant/settings" component={MerchantSettings} />
            </>
          )}

          {/* Public customer routes */}
          <Router>
            <Route path="/offer/:contractId" component={CustomerContractOffer} />
            <Route path="/apply/:contractId?" component={CustomerApplication} />
            <Route path="/customer/application" component={CustomerApplication} />
            <Route path="/dashboard/:contractId" component={CustomerDashboard} />

            <Route component={NotFound} />
          </Router>
        </Switch>
      )}
      <Toaster />
    </Suspense>
  );
}

export default App;
