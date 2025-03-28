import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import { useAuth } from "@/hooks/use-auth";
import { Suspense, lazy } from "react";
import Portfolio from "@/pages/admin/Portfolio"; // Import Portfolio component

// Admin pages
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminMerchants = lazy(() => import("@/pages/admin/Merchants"));
const AdminContracts = lazy(() => import("@/pages/admin/Contracts"));
const AdminLogs = lazy(() => import("@/pages/admin/Logs"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminBlockchain = lazy(() => import("@/pages/admin/Blockchain"));
const AdminSupportTickets = lazy(() => import("@/pages/admin/SupportTickets"));
const AdminMessages = lazy(() => import("@/pages/admin/Messages"));

// Merchant pages
const MerchantDashboard = lazy(() => import("@/pages/merchant/Dashboard"));
const MerchantContracts = lazy(() => import("@/pages/merchant/Contracts"));
const MerchantPayments = lazy(() => import("@/pages/merchant/Payments"));
const MerchantReports = lazy(() => import("@/pages/merchant/Reports"));
const MerchantSettings = lazy(() => import("@/pages/merchant/Settings"));
const MerchantSupportTicketsList = lazy(() => import("@/pages/merchant/SupportTicketsList"));
const MerchantCreateSupportTicket = lazy(() => import("@/pages/merchant/CreateSupportTicket"));
const MerchantSupportTicket = lazy(() => import("@/pages/merchant/SupportTicket"));
const MerchantMessages = lazy(() => import("@/pages/merchant/Messages"));
const MerchantMessageDetail = lazy(() => import("@/pages/merchant/MessageDetail"));

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

  if (isLoading) {
    return <LoadingFallback />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        {/* Public routes */}
        {!user && <Route path="/" component={Login} />}
        {!user && <Route path="/login" component={Login} />}
        {!user && <Route path="/merchant/signup" component={lazy(() => import("@/components/merchant/Signup"))} />}
        
        {/* Test route that everyone can access */}
        <Route path="/test-page" component={lazy(() => import("@/pages/TestPage"))} />

        {/* Customer public routes */}
        <Route path="/offer/:contractId" component={CustomerContractOffer} />
        <Route path="/apply/:contractId" component={CustomerApplication} />
        <Route path="/apply" component={CustomerApplication} />
        <Route
          path="/customer/application/:contractId"
          component={CustomerApplication}
        />
        <Route
          path="/customer/contract-lookup"
          component={lazy(() => import("@/pages/customer/ContractLookup"))}
        />
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
            <Route path="/admin/blockchain" component={AdminBlockchain} />
            <Route path="/admin/support-tickets" component={AdminSupportTickets} />
            <Route path="/admin/messages" component={AdminMessages} />
          </>
        )}

        {/* Merchant routes */}
        {user && user.role === "merchant" && (
          <>
            <Route path="/" component={MerchantDashboard} />
            <Route path="/merchant" component={MerchantDashboard} />
            <Route path="/merchant/dashboard" component={MerchantDashboard} />
            <Route path="/merchant/contracts" component={MerchantContracts} />
            <Route path="/merchant/contracts/:contractId" component={lazy(() => import("@/pages/merchant/ContractDetails"))} />
            <Route path="/merchant/payments" component={MerchantPayments} />
            <Route path="/merchant/reports" component={MerchantReports} />
            <Route path="/merchant/settings" component={MerchantSettings} />
            <Route path="/merchant/support-tickets" component={MerchantSupportTicketsList} />
            <Route path="/merchant/support-tickets/create" component={MerchantCreateSupportTicket} />
            <Route path="/merchant/support-tickets/:id" component={MerchantSupportTicket} />
            <Route path="/merchant/messages" component={MerchantMessages} />
            <Route path="/merchant/messages/:id" component={MerchantMessageDetail} />
          </>
        )}

        {/* Catch-all route */}
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </Suspense>
  );
}

export default App;