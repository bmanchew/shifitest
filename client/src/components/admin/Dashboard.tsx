import AdminLayout from "@/components/layout/AdminLayout";
import StatCard from "@/components/admin/StatCard";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Contract, Merchant, User } from "@shared/schema";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Users,
  FileText,
  AlertTriangle,
  Search,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { data: merchants = [] } = useQuery<Merchant[]>({
    queryKey: ["/api/admin/merchants"],
    queryFn: async () => {
      const res = await fetch("/api/admin/merchants", {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch merchants");
      const data = await res.json();
      return data.merchants || [];
    }
  });

  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
    queryFn: async () => {
      const res = await fetch("/api/contracts?admin=true", {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch contracts");
      
      const data = await res.json();
      
      // Handle both the new response format and the legacy format
      if (data && data.success && Array.isArray(data.contracts)) {
        // New format with success and contracts fields
        return data.contracts;
      } else if (Array.isArray(data)) {
        // Legacy format (direct array)
        console.warn("Admin dashboard using legacy contracts API format");
        return data;
      } else {
        console.error("Unexpected API response format:", data);
        return [];
      }
    }
  });
  
  // Get dashboard stats
  const { data: dashboardStats } = useQuery({
    queryKey: ["/api/admin/dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard-stats", {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      const data = await res.json();
      return data.stats || {};
    }
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    }
  });

  const getCustomerName = (customerId: number | null) => {
    if (!customerId) return "No Customer";
    const customer = customers.find(c => c.id === customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : "Unknown Customer";
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "pending":
        return "warning";
      case "completed":
        return "info";
      case "declined":
        return "danger";
      case "cancelled":
        return "danger";
      default:
        return "default";
    }
  };

  const getMerchantName = (merchantId: number) => {
    const merchant = merchants.find((m) => m.id === merchantId);
    return merchant ? merchant.name : "Unknown Merchant";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Statistics
  const activeContracts = contracts.filter((c) => c.status === "active").length;
  const pendingContracts = contracts.filter(
    (c) => c.status === "pending",
  ).length;
  const activeMerchants = merchants.filter((m) => m.active).length;

  // For the table
  const recentContracts = [...contracts]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  const columns: ColumnDef<Contract>[] = [
    {
      accessorKey: "contractNumber",
      header: "Contract ID",
    },
    {
      accessorKey: "merchantId",
      header: "Merchant",
      cell: ({ row }) => getMerchantName(row.getValue("merchantId")),
    },
    {
      accessorKey: "customerId",
      header: "Customer",
      cell: ({ row }) => {
        const customerId = row.getValue("customerId");
        // This would normally fetch customer data, but for demo we'll use placeholder data
        return (
          <div>
            <div className="text-sm text-gray-900">Customer {customerId}</div>
            <div className="text-sm text-gray-500">
              customer{customerId}@example.com
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => formatCurrency(row.getValue("amount")),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge variant={getStatusBadgeVariant(status)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        const date = row.getValue("createdAt") as string;
        return format(new Date(date), "MMM d, yyyy");
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/contracts/${row.original.id}`}>View</Link>
          </Button>
        );
      },
    },
  ];

  return (
    <AdminLayout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            Admin Dashboard
          </h1>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Stats cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            <StatCard
              title="Active Merchants"
              value={activeMerchants}
              icon={<Users />}
              iconBgColor="bg-primary-100"
              iconColor="text-primary-600"
              linkText="View all merchants"
              linkHref="/admin/merchants"
            />
            <StatCard
              title="Active Contracts"
              value={activeContracts}
              icon={<FileText />}
              iconBgColor="bg-green-100"
              iconColor="text-green-600"
              linkText="View all contracts"
              linkHref="/admin/contracts"
            />
            <StatCard
              title="Contracts Pending"
              value={pendingContracts}
              icon={<AlertTriangle />}
              iconBgColor="bg-yellow-100"
              iconColor="text-yellow-600"
              linkText="View pending contracts"
              linkHref="/admin/contracts?status=pending"
            />
          </div>

          {/* Recent Contracts Table */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg leading-6 font-medium text-gray-900">
                Recent Contracts
              </h2>
              <div className="flex space-x-3">
                <div className="relative">
                  <Input placeholder="Search contracts..." className="pl-9" />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
                <Button variant="outline">Export</Button>
              </div>
            </div>
            <div className="mt-4">
              <DataTable columns={columns} data={recentContracts} />
            </div>
            <div className="mt-4 text-right">
              <Button variant="ghost" asChild className="text-primary-600">
                <Link href="/admin/contracts">
                  View all contracts <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
