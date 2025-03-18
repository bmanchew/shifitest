import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import LoadingFallback from "@/components/LoadingFallback";

// Import pages
const Login = lazy(() => import("@/pages/auth/Login"));
const CustomerApplication = lazy(() => import("@/pages/customer/Application"));
const CustomerContractOffer = lazy(() => import("@/pages/customer/ContractOffer"));
const CustomerDashboard = lazy(() => import("@/pages/customer/Dashboard"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminMerchants = lazy(() => import("@/pages/admin/Merchants"));
const AdminContracts = lazy(() => import("@/pages/admin/Contracts"));
const AdminLogs = lazy(() => import("@/pages/admin/Logs"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const Portfolio = lazy(() => import("@/pages/admin/Portfolio"));
const NotFound = lazy(() => import("@/pages/not-found")); //Added from original
const MerchantSignup = lazy(() => import("@/components/merchant/Signup")); //Added from original
const MerchantDashboard = lazy(() => import("@/pages/merchant/Dashboard")); //Added from original
const MerchantContracts = lazy(() => import("@/pages/merchant/Contracts")); //Added from original
const MerchantReports = lazy(() => import("@/pages/merchant/Reports")); //Added from original
const MerchantSettings = lazy(() => import("@/pages/merchant/Settings")); //Added from original


function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          {/* Public routes */}
          {!user && <Route path="/" component={Login} />}

          {/* Customer public routes */}
          <Route path="/offer/:contractId" component={CustomerContractOffer} />
          <Route path="/apply/:contractId" component={CustomerApplication} />
          <Route path="/apply" component={CustomerApplication} />
          <Route path="/customer/application/:contractId" component={CustomerApplication} />
          <Route path="/customer/contract-lookup" component={lazy(() => import("@/pages/customer/ContractLookup"))} />
          <Route path="/dashboard/:contractId" component={CustomerDashboard} />

          {/* Admin routes */}
          {user && user.role === "admin" && (
            <>
              <Route path="/" component={AdminDashboard} />
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/dashboard" component={AdminDashboard} />
              <Route path="/admin/merchants" component={AdminMerchants} />
              <Route path="/admin/contracts" component={AdminContracts} />
              <Route path="/admin/logs" component={AdminLogs} />
              <Route path="/admin/settings" component={AdminSettings} />
              <Route path="/admin/portfolio" component={Portfolio} />
            </>
          )}

          {/* Merchant routes */}
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

          {/* Public merchant signup route */}
          <Route path="/merchant/signup" element={<MerchantSignup />} />

          {/* Catch-all route */}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </div>
  );
}

export default App;