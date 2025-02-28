import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Contract, Merchant } from "@shared/schema";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

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

export default function ContractList() {
  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: merchants = [] } = useQuery<Merchant[]>({
    queryKey: ["/api/merchants"],
  });

  // Get merchant name by ID
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
          <Button variant="ghost" size="sm">
            View
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Contracts</h2>
          <p className="mt-1 text-sm text-gray-500">
            View and manage all financing contracts
          </p>
        </div>
        <Button variant="outline">Export</Button>
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
