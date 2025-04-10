
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
import { useLocation } from "wouter";
import { Contract } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface ContractTableProps {
  contracts: Contract[];
  isLoading: boolean;
  onSendApplication?: (contract: Contract) => void;
}

export default function ContractTable({ contracts, isLoading, onSendApplication }: ContractTableProps) {
  const [_, setLocation] = useLocation();
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
      case "active":
        return "success";
      case "completed":
        return "success";
      case "pending":
        return "warning";
      case "declined":
        return "destructive";
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
    setLocation(`/merchant/contracts/${contract.id}`);
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
