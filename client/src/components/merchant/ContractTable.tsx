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
      return "secondary";
    case "declined":
      return "destructive";
    case "cancelled":
      return "outline";
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
        data={contracts.map(contract => ({
          ...contract,
          // Format customer name for display, falling back to various options if specific fields aren't available
          customerName: contract.customerFirstName && contract.customerLastName 
            ? `${contract.customerFirstName} ${contract.customerLastName}`
            : contract.customerName || "Unknown Customer"
        }))}
        searchField="contractNumber"
        searchPlaceholder="Search contracts..."
      />
    </div>
  );
}
import { useState, useEffect } from "react";
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useNavigate } from "wouter";
import { Contract } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface ContractTableProps {
  contracts: Contract[];
  isLoading: boolean;
  onSendApplication?: (contract: Contract) => void;
}

export default function ContractTable({ contracts, isLoading, onSendApplication }: ContractTableProps) {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Record<number, { name: string; email: string }>>({});
  
  useEffect(() => {
    // Fetch customer data for all contracts
    const uniqueCustomerIds = [...new Set(contracts.map(contract => contract.customerId).filter(Boolean))];
    
    if (uniqueCustomerIds.length > 0) {
      Promise.all(
        uniqueCustomerIds.map(customerId => 
          fetch(`/api/customers/${customerId}`)
            .then(res => res.ok ? res.json() : null)
            .catch(err => {
              console.error(`Error fetching customer ${customerId}:`, err);
              return null;
            })
        )
      ).then(customersData => {
        const newCustomers: Record<number, { name: string; email: string }> = {};
        customersData.forEach(customer => {
          if (customer && customer.id) {
            const fullName = customer.firstName && customer.lastName 
              ? `${customer.firstName} ${customer.lastName}`
              : customer.name || 'Unknown';
            
            newCustomers[customer.id] = {
              name: fullName,
              email: customer.email || ''
            };
          }
        });
        setCustomers(newCustomers);
      });
    }
  }, [contracts]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "in_progress":
        return "warning";
      case "pending":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getCustomerName = (customerId: number | null) => {
    if (!customerId) return "No Customer";
    return customers[customerId]?.name || "Loading...";
  };

  const getCustomerEmail = (customerId: number | null) => {
    if (!customerId) return "";
    return customers[customerId]?.email || "";
  };

  const handleRowClick = (contract: Contract) => {
    navigate(`/merchant/contracts/${contract.id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Contract ID</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                No contracts found
              </TableCell>
            </TableRow>
          ) : (
            contracts.map((contract) => (
              <TableRow 
                key={contract.id} 
                className="cursor-pointer"
                onClick={() => handleRowClick(contract)}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <div className="font-medium">{getCustomerName(contract.customerId)}</div>
                    <div className="text-gray-500 text-sm">{getCustomerEmail(contract.customerId)}</div>
                  </div>
                </TableCell>
                <TableCell>{contract.contractNumber}</TableCell>
                <TableCell>{formatCurrency(contract.amount)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(contract.status)}>
                    {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(contract.createdAt), "MMM d, yyyy")}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {onSendApplication && contract.status === "completed" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onSendApplication(contract)}
                    >
                      Send Application
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
