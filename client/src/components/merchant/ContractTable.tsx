import { Contract } from "@shared/schema";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

interface ContractTableProps {
  contracts: Contract[];
}

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

export default function ContractTable({ contracts }: ContractTableProps) {
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      // This would normally fetch all users, but for demo purposes we'll return empty
      // In a real app, we'd implement a proper users endpoint
      return [];
    },
    enabled: false, // Disable this query for the demo
  });

  // Get customer name by ID (mock data for now)
  const getCustomerName = (customerId?: number) => {
    if (!customerId) return "Unknown Customer";
    const user = users.find((u) => u.id === customerId);
    
    // Fallback mock data
    const mockCustomers: Record<number, { name: string, email: string }> = {
      2: { name: "Sarah Johnson", email: "sarah.j@example.com" },
      3: { name: "Michael Brown", email: "m.brown@example.com" },
      4: { name: "Jennifer Smith", email: "j.smith@example.com" }
    };
    
    return user?.name || mockCustomers[customerId]?.name || "Unknown Customer";
  };
  
  const getCustomerEmail = (customerId?: number) => {
    if (!customerId) return "";
    
    // Fallback mock data
    const mockCustomers: Record<number, { name: string, email: string }> = {
      2: { name: "Sarah Johnson", email: "sarah.j@example.com" },
      3: { name: "Michael Brown", email: "m.brown@example.com" },
      4: { name: "Jennifer Smith", email: "j.smith@example.com" }
    };
    
    return mockCustomers[customerId]?.email || "";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
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
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => {
        const date = row.getValue("createdAt") as string;
        return format(new Date(date), "MMM d, yyyy");
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <Button variant="ghost" size="sm">
            View
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <div className="sm:flex sm:items-center mb-4">
        <div className="sm:flex-auto">
          <h2 className="text-xl font-semibold text-gray-900">Recent Contracts</h2>
          <p className="mt-2 text-sm text-gray-700">
            A list of all your recent financing contracts including customer, amount and status.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button variant="outline">View All</Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={contracts}
        searchField="contractNumber"
        searchPlaceholder="Search contracts..."
      />
    </div>
  );
}
