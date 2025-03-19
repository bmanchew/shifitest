import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import LoadingFallback from "./components/LoadingFallback";
import ContractDetails from "@/components/contract/ContractDetails";

// Import pages
const Login = lazy(() => import("@/pages/Login"));
const CustomerApplication = lazy(() => import("@/pages/customer/Application"));
const CustomerContractOffer = lazy(() => import("@/pages/customer/ContractOffer"));
const CustomerDashboard = lazy(() => import("@/pages/customer/Dashboard"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminMerchants = lazy(() => import("@/pages/admin/Merchants"));
const AdminMerchantDetailPage = lazy(() => import("@/pages/admin/MerchantDetailPage"));
const AdminContracts = lazy(() => import("@/pages/admin/Contracts"));
const AdminLogs = lazy(() => import("@/pages/admin/Logs"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const Portfolio = lazy(() => import("@/pages/admin/Portfolio"));
const NotFound = lazy(() => import("@/pages/not-found"));
const MerchantSignup = lazy(() => import("@/components/merchant/Signup"));
const MerchantDashboard = lazy(() => import("@/pages/merchant/Dashboard"));
const MerchantContracts = lazy(() => import("@/pages/merchant/Contracts"));
const MerchantReports = lazy(() => import("@/pages/merchant/Reports"));
const MerchantSettings = lazy(() => import("@/pages/merchant/Settings"));

export default function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  return (
    <div className="min-h-screen bg-gray-50"> {/* Restored div element */}
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/apply/:contractId" component={CustomerApplication} />
          <Route path="/offer/:contractId" component={CustomerContractOffer} />

          {/* Customer routes */}
          <Route path="/customer/dashboard" component={CustomerDashboard} />

          {/* Admin routes */}
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/merchants" component={AdminMerchants} />
          <Route path="/admin/merchants/:id" component={AdminMerchantDetailPage} />
          <Route path="/admin/contracts" component={AdminContracts} />
          <Route path="/admin/logs" component={AdminLogs} />
          <Route path="/admin/settings" component={AdminSettings} />
          <Route path="/admin/portfolio" component={Portfolio} />

          {/* Merchant routes */}
          <Route path="/merchant/signup" component={MerchantSignup} />
          <Route path="/merchant/dashboard" component={MerchantDashboard} />
          <Route path="/merchant/contracts" component={MerchantContracts} />
          <Route path="/merchant/reports" component={MerchantReports} />
          <Route path="/merchant/settings" component={MerchantSettings} />

          {/* Contract routes */}
          <Route path="/contracts/:contractId">
            {(params) => <ContractDetails />}
          </Route>

          {/* Admin dashboard explicit route */}
          <Route path="/admin/dashboard" component={AdminDashboard} />

          {/* Default route */}
          <Route path="/" component={user ? MerchantDashboard : Login} />

          {/* 404 route */}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </div>
  );
}