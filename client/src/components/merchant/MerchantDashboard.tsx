import { useQuery } from "@tanstack/react-query";
import StatCard from "@/components/admin/StatCard";
import SendApplication from "@/components/merchant/SendApplication";
import ContractTable from "@/components/merchant/ContractTable";
import { useAuth } from "@/hooks/use-auth";
import { Contract } from "@shared/schema";
import { Users, FileText, DollarSign } from "lucide-react";

export default function MerchantDashboard() {
  const { user } = useAuth();
  const merchantId = user?.merchantId || 1;

  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contracts", { merchantId }],
    queryFn: async () => {
      const res = await fetch(`/api/contracts?merchantId=${merchantId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch contracts");
      }
      return res.json();
    },
  });

  // Calculate statistics
  const activeContracts = contracts.filter((c) => c.status === "active").length;
  
  const totalFinanced = contracts
    .filter((c) => c.status === "active" || c.status === "completed")
    .reduce((sum, contract) => sum + contract.financedAmount, 0);
  
  const pendingApplications = contracts.filter((c) => c.status === "pending").length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 sm:px-0">
        <h1 className="text-2xl font-semibold text-gray-900">Merchant Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">{user?.name || "Your Company"}</p>
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

      {/* Create New Contract Section */}
      <div className="mt-8">
        <SendApplication />
      </div>

      {/* Recent Contracts */}
      <div className="mt-8">
        <ContractTable contracts={contracts} />
      </div>
    </div>
  );
}
