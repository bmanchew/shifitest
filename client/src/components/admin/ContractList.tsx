
import { useState, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useLocation, Link } from "wouter";
import { Contract } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ContractListProps {
  contracts: Contract[];
  isLoading: boolean;
}

export default function ContractList({ contracts, isLoading }: ContractListProps) {
  const [_, navigate] = useLocation();
  const [customers, setCustomers] = useState<Record<number, { name: string; email: string }>>({});
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    // Fetch customer data for all contracts
    const uniqueCustomerIds: number[] = [];
    
    // Extract customer IDs that are not null
    contracts.forEach(contract => {
      if (contract.customerId !== null && contract.customerId !== undefined) {
        if (!uniqueCustomerIds.includes(contract.customerId)) {
          uniqueCustomerIds.push(contract.customerId);
        }
      }
    });
    
    if (uniqueCustomerIds.length > 0) {
      setIsLoadingCustomers(true);
      
      Promise.all(
        uniqueCustomerIds.map(customerId => 
          apiRequest("GET", `/api/users/${customerId}`)
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
      })
      .catch(error => {
        console.error("Error fetching customer data:", error);
        toast({
          title: "Error loading customer information",
          description: "Unable to load customer details. Please try refreshing the page.",
          variant: "destructive"
        });
      })
      .finally(() => {
        setIsLoadingCustomers(false);
      });
    }
  }, [contracts, toast]);

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
    return customers[customerId]?.name || (isLoadingCustomers ? "Loading..." : "Unknown");
  };

  const getCustomerEmail = (customerId: number | null) => {
    if (!customerId) return "";
    return customers[customerId]?.email || (isLoadingCustomers ? "" : "Email unavailable");
  };

  const handleViewDetails = (contractId: number) => {
    navigate(`/admin/contracts/${contractId}`);
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
              <TableRow key={contract.id}>
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
                <TableCell>
                  {contract.createdAt ? format(new Date(contract.createdAt), "MMM d, yyyy") : "N/A"}
                </TableCell>
                <TableCell>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    asChild
                  >
                    <Link href={`/admin/contracts/${contract.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
