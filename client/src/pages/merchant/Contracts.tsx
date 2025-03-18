import { useQuery } from "@tanstack/react-query";
import MerchantLayout from "@/components/layout/MerchantLayout";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { Contract } from "@shared/schema";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Search, Filter } from "lucide-react";
import { useState } from "react";
import Link from 'next/link'; // Assuming Next.js Link component

export default function Contracts() {
  const { user } = useAuth();
  const merchantId = user?.merchantId || 1;
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  const filteredContracts = statusFilter === "all" 
    ? contracts 
    : contracts.filter(contract => contract.status === statusFilter);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getCustomerName = (customerId?: number) => {
    if (!customerId) return "Unknown Customer";

    // Mock data for the demo
    const mockCustomers: Record<number, { name: string, email: string }> = {
      2: { name: "Sarah Johnson", email: "sarah.j@example.com" },
      3: { name: "Michael Brown", email: "m.brown@example.com" },
      4: { name: "Jennifer Smith", email: "j.smith@example.com" }
    };

    return mockCustomers[customerId]?.name || `Customer ${customerId}`;
  };

  const getCustomerEmail = (customerId?: number) => {
    if (!customerId) return "";

    // Mock data for the demo
    const mockCustomers: Record<number, { name: string, email: string }> = {
      2: { name: "Sarah Johnson", email: "sarah.j@example.com" },
      3: { name: "Michael Brown", email: "m.brown@example.com" },
      4: { name: "Jennifer Smith", email: "j.smith@example.com" }
    };

    return mockCustomers[customerId]?.email || "";
  };

  const columns: ColumnDef<Contract>[] = [
    {
      accessorKey: "customerId",
      header: "Customer",
      cell: ({ row }) => {
        const customerId = row.getValue("customerId") as number;
        return (
          <div className="flex flex-col">
            <div className="font-medium">{getCustomerName(customerId)}</div>
            <div className="text-gray-500 text-sm">{getCustomerEmail(customerId)}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "contractNumber",
      header: "Contract ID",
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
      accessorKey: "currentStep",
      header: "Current Step",
      cell: ({ row }) => {
        const step = row.getValue("currentStep") as string;
        return step.charAt(0).toUpperCase() + step.slice(1);
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
          <Link href={`/merchant/contracts/${row.original.id}`}>
            <Button variant="ghost" size="sm">
              View
            </Button>
          </Link>
        );
      },
    },
  ];

  return (
    <MerchantLayout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <h1 className="text-2xl font-semibold text-gray-900">Contracts</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage all your financing contracts
          </p>
        </div>

        <div className="mt-6">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mb-4 items-start sm:items-center">
            <div className="relative sm:max-w-xs flex-1">
              <Input
                placeholder="Search contracts..."
                className="pl-9"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            <div className="flex items-center">
              <Filter className="h-4 w-4 text-gray-400 mr-2" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contracts</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline">Export</Button>
          </div>

          <DataTable
            columns={columns}
            data={filteredContracts}
          />
        </div>
      </div>
    </MerchantLayout>
  );
}