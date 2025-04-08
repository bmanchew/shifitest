import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import { useAuth } from "@/hooks/use-auth";
import { Suspense, lazy } from "react";
import Portfolio from "@/pages/admin/Portfolio"; // Import Portfolio component
import ErrorBoundary from "@/components/ErrorBoundary";
import IntercomProvider from "@/components/IntercomProvider";

// Admin pages
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminMerchants = lazy(() => import("@/pages/admin/Merchants"));
const AdminContracts = lazy(() => import("@/pages/admin/Contracts"));
const AdminLogs = lazy(() => import("@/pages/admin/Logs"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminBlockchain = lazy(() => import("@/pages/admin/Blockchain"));
const AdminSupportTickets = lazy(() => import("@/pages/admin/SupportTickets"));
const AdminSupportTicket = lazy(() => import("@/pages/admin/SupportTicket"));
const AdminMessages = lazy(() => import("@/pages/admin/Messages"));
const AdminMessageDetail = lazy(() => import("@/pages/admin/MessageDetail"));
const AdminKnowledgeBase = lazy(() => import("@/pages/admin/KnowledgeBase"));
const AdminTicketAnalytics = lazy(() => import("@/pages/admin/TicketAnalytics"));
const AdminPlaidCredentials = lazy(() => import("@/pages/admin/PlaidCredentials"));

// Merchant pages
const MerchantDashboard = lazy(() => import("@/pages/merchant/Dashboard"));
const MerchantContracts = lazy(() => import("@/pages/merchant/Contracts"));
const MerchantPayments = lazy(() => import("@/pages/merchant/Payments"));
const MerchantReports = lazy(() => import("@/pages/merchant/Reports"));
const MerchantSettings = lazy(() => import("@/pages/merchant/Settings"));
const MerchantSupportTicketsList = lazy(() => import("@/pages/merchant/SupportTicketsList"));
const MerchantCreateSupportTicket = lazy(() => import("@/pages/merchant/CreateSupportTicket"));
const MerchantKnowledgeBase = lazy(() => import("@/pages/merchant/KnowledgeBase"));
const MerchantTicketAnalytics = lazy(() => import("@/pages/merchant/TicketAnalytics"));

// Investor pages
const InvestorDashboard = lazy(() => import("@/components/investor/InvestorDashboard"));
const InvestorOfferings = lazy(() => import("@/components/investor/InvestorOfferings"));
const OfferingDetail = lazy(() => import("@/components/investor/OfferingDetail"));
const InvestmentDetail = lazy(() => import("@/components/investor/InvestmentDetail"));
const DocumentLibrary = lazy(() => import("@/components/investor/DocumentLibrary"));
const InvestorSignup = lazy(() => import("@/components/investor/InvestorSignup"));
const KYCVerification = lazy(() => import("@/components/investor/KYCVerification"));
const BankConnection = lazy(() => import("@/components/investor/BankConnection"));
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
    <ErrorBoundary
      fallback={
        <div className="p-6 bg-red-50 min-h-screen flex flex-col items-center justify-center">
          <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-red-800 mb-4">Application Error</h2>
            <p className="text-gray-700 mb-6">
              Sorry, something went wrong with the application. Please try refreshing the page.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-primary text-white py-2 px-4 rounded hover:bg-primary/90 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      }
    >
      <IntercomProvider>
        <Suspense fallback={<LoadingFallback />}>
          <Switch>
            {/* Public routes - don't use conditional rendering for login route to prevent routing issues */}
            
            {/* Investor landing page and signup - accessible to everyone */}
            <Route path="/investor/landing" component={lazy(() => import("@/pages/InvestorLanding"))} />
            <Route path="/investor/signup" component={InvestorSignup} />
            <Route path="/investor/verify/kyc/:status?" component={KYCVerification} />
            <Route path="/investor/verify/bank" component={BankConnection} />
            
            {/* Auto-redirect to application process */}
            <Route path="/apply-investor" component={lazy(() => import("@/pages/InvestorLanding"))} />
            
            <Route path="/login" component={Login} />
            {!user && <Route path="/merchant/signup" component={lazy(() => import("@/components/merchant/Signup"))} />}
            
            {/* Test route that everyone can access */}
            <Route path="/test-page" component={lazy(() => import("@/pages/TestPage"))} />
            <Route path="/accreditation-demo" component={lazy(() => import("@/pages/AccreditationDemo"))} />

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
            
            {/* The root path should be processed last to avoid hijacking other routes */}
            <Route path="/" component={user ? 
              (user.role === 'admin' ? AdminDashboard : 
               user.role === 'merchant' ? MerchantDashboard : 
               user.role === 'investor' ? InvestorDashboard : Login) : 
              Login
            } />

            {/* Admin routes */}
            {user && user.role === "admin" && (
              <>
                {/* Home route is already handled above */}
                <Route path="/admin" component={AdminDashboard} />
                <Route path="/admin/dashboard" component={AdminDashboard} />
                <Route path="/admin/merchants" component={AdminMerchants} />
                <Route path="/admin/merchants/:id" component={lazy(() => import("@/pages/admin/MerchantDetailPage"))} />
                <Route path="/admin/contracts" component={AdminContracts} />
                <Route path="/admin/logs" component={AdminLogs} />
                <Route path="/admin/settings" component={AdminSettings} />
                <Route path="/admin/portfolio" component={Portfolio} />
                <Route path="/admin/blockchain" component={AdminBlockchain} />
                <Route path="/admin/support-tickets" component={AdminSupportTickets} />
                <Route path="/admin/support-tickets/:id" component={AdminSupportTicket} />
                <Route path="/admin/messages" component={AdminMessages} />
                <Route path="/admin/messages/:id" component={AdminMessageDetail} />
                <Route path="/admin/knowledge-base" component={AdminKnowledgeBase} />
                <Route path="/admin/ticket-analytics" component={AdminTicketAnalytics} />
                <Route path="/admin/plaid-credentials" component={AdminPlaidCredentials} />
              </>
            )}

            {/* Merchant routes */}
            {user && user.role === "merchant" && (
              <>
                {/* Home route is already handled above */}
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
                <Route path="/merchant/knowledge-base" component={MerchantKnowledgeBase} />
                <Route path="/merchant/ticket-analytics" component={MerchantTicketAnalytics} />
              </>
            )}
            
            {/* Investor routes */}
            <Route 
              path="/investor" 
              component={user && user.role === "investor" ? InvestorDashboard : lazy(() => import("@/pages/InvestorLanding"))} 
            />
            
            {user && user.role === "investor" && (
              <>
                <Route path="/investor/dashboard" component={InvestorDashboard} />
                <Route path="/investor/offerings" component={InvestorOfferings} />
                <Route path="/investor/offerings/:id" component={OfferingDetail} />
                <Route path="/investor/investments/:id" component={InvestmentDetail} />
                <Route path="/investor/documents" component={DocumentLibrary} />
                <Route path="/investor/profile" component={lazy(() => import("@/components/investor/InvestorProfile"))} />
              </>
            )}

            {/* Catch-all route */}
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </Suspense>
      </IntercomProvider>
    </ErrorBoundary>
  );
}

export default App;
