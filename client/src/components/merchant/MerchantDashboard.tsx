import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import StatCard from "@/components/admin/StatCard";
import SendApplication from "@/components/merchant/SendApplication";
import ContractTable from "@/components/merchant/ContractTable";
import MerchantFunding from "@/components/merchant/MerchantFunding";
import SalesRepAnalytics from "@/components/merchant/SalesRepAnalytics";
import { useAuth } from "@/hooks/use-auth";
import { Contract } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, DollarSign, BarChart3, BanknoteIcon, UserRound } from "lucide-react";

export default function MerchantDashboard() {
  const { user } = useAuth();
  const merchantId = user?.merchantId || 49; // Default to Shiloh Finance ID (49)
  const [activeTab, setActiveTab] = useState<string>("overview");

  const { data: contracts = [], isLoading: isContractsLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts", { merchantId }],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/contracts?merchantId=${merchantId}`, {
          credentials: "include",
        });
        if (!res.ok) {
          console.error(`Failed to fetch contracts: ${res.status}`);
          return [];
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching contracts:", error);
        return [];
      }
    },
    retry: 1,
    retryDelay: 1000,
  });

  // Calculate statistics
  const activeContracts = contracts.filter((c) => c.status === "active").length;

  const totalFinanced = contracts
    .filter((c) => c.status === "active" || c.status === "completed")
    .reduce((sum, contract) => sum + contract.financedAmount, 0);

  const pendingApplications = contracts.filter(
    (c) => c.status === "pending",
  ).length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-5 sm:px-0">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 mb-6 text-white">
          <h1 className="text-2xl font-bold">Welcome to ShiFi Dashboard</h1>
          <p className="mt-2 text-blue-100">
            Hello, {user?.name || "Merchant"}! Manage your financing contracts
            and track your funding through our platform.
          </p>
          <div className="mt-4 flex space-x-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="text-sm text-blue-100">Current Date</div>
              <div className="font-medium">
                {new Date().toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="text-sm text-blue-100">Last Login</div>
              <div className="font-medium">
                Today,{" "}
                {new Date().toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Active Contracts"
          value={activeContracts}
          icon={<FileText />}
          iconBgColor="bg-primary-100"
          iconColor="text-primary-600"
        />
        <StatCard
          title="Total Financed"
          value={formatCurrency(totalFinanced)}
          icon={<DollarSign />}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
        />
        <StatCard
          title="Pending Applications"
          value={pendingApplications}
          icon={<Users />}
          iconBgColor="bg-yellow-100"
          iconColor="text-yellow-600"
        />
      </div>

      {/* Main Content Tabs */}
      <div className="mt-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="funding">
              <BanknoteIcon className="h-4 w-4 mr-2" />
              Funding
            </TabsTrigger>
            <TabsTrigger value="sales-analytics">
              <UserRound className="h-4 w-4 mr-2" />
              Sales Rep Analytics
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            {/* Create New Contract Section */}
            <div className="mb-8">
              <SendApplication />
            </div>

            {/* Recent Contracts */}
            <div>
              <ContractTable contracts={contracts} isLoading={isContractsLoading} />
            </div>
          </TabsContent>
          
          <TabsContent value="funding">
            <MerchantFunding />
          </TabsContent>
          
          <TabsContent value="sales-analytics">
            <SalesRepAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
