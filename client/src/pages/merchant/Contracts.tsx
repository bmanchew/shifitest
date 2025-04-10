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
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/api";

interface Customer {
  id: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export default function Contracts() {
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<number | undefined>(user?.merchantId);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerCache, setCustomerCache] = useState<Record<number, Customer>>({});
  
  // If user exists but merchantId is missing, try to fetch it from the API
  useEffect(() => {
    if (user?.role === 'merchant' && !merchantId) {
      const fetchMerchantId = async () => {
        try {
          console.log("Attempting to fetch merchant ID from API...");
          
          // Try the new current-merchant endpoint first
          try {
            const response = await apiRequest<{ success: boolean; data?: { id: number } }>(
              "GET", 
              "/api/current-merchant"
            );
            
            if (response.success && response.data?.id) {
              console.log(`Successfully retrieved merchant ID from current-merchant endpoint: ${response.data.id}`);
              setMerchantId(response.data.id);
              return;
            }
          } catch (err) {
            console.log("Primary endpoint failed, trying fallback...");
          }
          
          // Try the versioned endpoint as fallback
          try {
            const v1Response = await apiRequest<{ success: boolean; data?: { id: number } }>(
              "GET", 
              "/api/v1/current-merchant"
            );
            
            if (v1Response.success && v1Response.data?.id) {
              console.log(`Successfully retrieved merchant ID from v1 endpoint: ${v1Response.data.id}`);
              setMerchantId(v1Response.data.id);
              return;
            }
          } catch (err) {
            console.log("V1 endpoint failed, trying legacy endpoint...");
          }
          
          // Try the legacy merchant-dashboard endpoint as a last resort
          try {
            const dashboardResponse = await apiRequest<{ success: boolean; merchant?: { id: number } }>(
              "GET", 
              "/api/merchant-dashboard/current"
            );
            
            if (dashboardResponse.success && dashboardResponse.merchant?.id) {
              console.log(`Successfully retrieved merchant ID from dashboard endpoint: ${dashboardResponse.merchant.id}`);
              setMerchantId(dashboardResponse.merchant.id);
              return;
            }
          } catch (err) {
            console.error("All merchant endpoints failed", err);
          }
          
        } catch (error) {
          console.error("Failed to fetch merchant ID:", error);
        }
      };
      
      fetchMerchantId();
    }
  }, [user]);

  // Define a proper type for the API response
  interface ContractsApiResponse {
    success: boolean;
    contracts: Contract[];
    message?: string;
  }

  // Query to fetch contracts when merchantId is available
  const { data: contracts = [], isLoading: isContractsLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts", { merchantId }],
    queryFn: async () => {
      try {
        // Using apiRequest from lib/api.ts to properly handle token auth
        console.log(`Fetching contracts for merchant ID: ${merchantId}`);
        
        // Make the API request with proper typing
        const response = await apiRequest<ContractsApiResponse>(
          "GET", 
          `/api/contracts?merchantId=${merchantId}`
        );
        
        // Debug output of the response
        console.log('Contracts API response received:', {
          success: response.success,
          hasContracts: 'contracts' in response,
          contractsCount: response.contracts ? response.contracts.length : 0,
        });
        
        // Ensure we have a valid response with contracts array
        if (response.success && Array.isArray(response.contracts)) {
          console.log(`Successfully retrieved ${response.contracts.length} contracts for merchant ID ${merchantId}`);
          
          // Log first few contracts for debugging
          if (response.contracts.length > 0) {
            console.log('First contract sample:', {
              id: response.contracts[0].id,
              contractNumber: response.contracts[0].contractNumber,
              status: response.contracts[0].status
            });
          }
          
          return response.contracts;
        } else {
          console.warn('API returned success=true but no contracts array or empty contracts array');
          return [];
        }
      } catch (error) {
        console.error("Contract fetch error:", error);
        throw error;
      }
    },
    enabled: !!merchantId, // Only run query when merchantId is available
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
        return "destructive";
      case "cancelled":
        return "destructive";
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

  // Optimized batch fetching for customer data
  useQuery({
    queryKey: ["customers", contracts.map(c => c.customerId).filter(Boolean)],
    queryFn: async () => {
      const customerIds = contracts
        .map(c => c.customerId)
        .filter((id): id is number => id !== null && id !== undefined);
      
      if (customerIds.length === 0) {
        return true;
      }
      
      // Get only unique ids and filter out any that are already in cache
      const uniqueIds = [...new Set(customerIds)];
      const idsToFetch = uniqueIds.filter(id => !customerCache[id]);
      
      if (idsToFetch.length === 0) {
        return true; // All customers already in cache
      }
      
      // Log progress
      console.log(`Fetching ${idsToFetch.length} unique customers in batch instead of individual requests`);
      
      try {
        // Make a single batch request for all needed customers
        const response = await apiRequest<{customers: Customer[]}>( 
          "GET", 
          `/api/customers/batch?ids=${idsToFetch.join(',')}`,
        );
        
        if (response.customers && Array.isArray(response.customers)) {
          // Create a new cache object with all the fetched customers
          const newCache = { ...customerCache };
          
          response.customers.forEach(customer => {
            if (customer && customer.id) {
              newCache[customer.id] = customer;
            }
          });
          
          // Update cache state with all fetched customers at once
          setCustomerCache(newCache);
          
          console.log(`Successfully loaded ${response.customers.length} customers in batch`);
        } else {
          // Fallback to individual requests if batch request format is unexpected
          console.warn('Batch customer API returned unexpected format, falling back to individual requests');
          
          // Fetch each customer individually as fallback
          const results = await Promise.all(
            idsToFetch.map(async id => {
              try {
                const customer = await apiRequest<Customer>("GET", `/api/customers/${id}`);
                return { id, customer };
              } catch (error) {
                console.error(`Failed to fetch customer ${id}:`, error);
                return { id, customer: { id } };
              }
            })
          );
          
          // Update the cache with individual results
          const newCache = { ...customerCache };
          results.forEach(({ id, customer }) => {
            newCache[id] = customer;
          });
          setCustomerCache(newCache);
        }
      } catch (error) {
        console.error('Batch customer fetch failed:', error);
        
        // Fallback to loading placeholders for the customers
        const placeholders = idsToFetch.reduce((acc, id) => {
          acc[id] = { id };
          return acc;
        }, {} as Record<number, Customer>);
        
        setCustomerCache(prev => ({ ...prev, ...placeholders }));
      }
      
      return true;
    },
    enabled: contracts.length > 0,
  });

  const getCustomerName = (customerId?: number) => {
    if (!customerId) return "Unknown Customer";
    
    const customer = customerCache[customerId];
    if (!customer) return `Loading...`;
    
    if (customer.name) return customer.name;
    if (customer.firstName && customer.lastName) return `${customer.firstName} ${customer.lastName}`;
    if (customer.firstName) return customer.firstName;
    if (customer.lastName) return customer.lastName;
    if (customer.email) return customer.email.split('@')[0];
    if (customer.phone) return customer.phone;
    
    return `Customer ${customerId}`;
  };

  const getCustomerEmail = (customerId?: number) => {
    if (!customerId) return "";
    
    const customer = customerCache[customerId];
    if (!customer) return "";
    
    return customer.email || "";
  };

  // Function to get credit tier badge variant
  const getCreditTierBadgeVariant = (tier: string | null) => {
    if (!tier) return "default";
    
    switch (tier) {
      case "tier1":
        return "success";
      case "tier2":
        return "warning";
      case "tier3":
        return "secondary";
      case "declined":
        return "destructive";
      default:
        return "default";
    }
  };
  
  // Function to format credit tier for display
  const formatCreditTier = (tier: string | null) => {
    if (!tier) return "Not Rated";
    
    // Convert tier1 to Tier 1, etc.
    return tier.replace(/tier(\d)/, 'Tier $1').charAt(0).toUpperCase() + tier.slice(1).replace(/tier(\d)/, 'Tier $1');
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
      accessorKey: "creditTier",
      header: "Credit Tier",
      cell: ({ row }) => {
        const creditTier = row.getValue("creditTier") as string | null;
        return (
          <Badge variant={getCreditTierBadgeVariant(creditTier)}>
            {formatCreditTier(creditTier)}
          </Badge>
        );
      },
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

          {!merchantId ? (
            <div className="bg-blue-50 p-4 rounded-md mt-4 flex flex-col items-center justify-center">
              <h3 className="text-lg font-medium text-blue-800 mb-2">Loading merchant information...</h3>
              <p className="text-blue-700 text-center mb-4">
                We're retrieving your merchant profile data to show your contracts.
              </p>
            </div>
          ) : isContractsLoading ? (
            <div className="bg-blue-50 p-4 rounded-md mt-4 flex flex-col items-center justify-center">
              <h3 className="text-lg font-medium text-blue-800 mb-2">Loading contracts...</h3>
              <p className="text-blue-700 text-center mb-4">
                We're retrieving your contracts from the server.
              </p>
            </div>
          ) : contracts.length === 0 ? (
            <div className="bg-yellow-50 p-4 rounded-md mt-4 flex flex-col items-center justify-center">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">No contracts found</h3>
              <p className="text-yellow-700 text-center mb-4">
                We couldn't find any contracts for your merchant account.
              </p>
              <div className="text-sm text-gray-600 mt-2">
                Merchant ID: {merchantId}
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-600 mb-2">
                Found {contracts.length} contracts
              </div>
              <DataTable
                columns={columns}
                data={filteredContracts}
              />
            </>
          )}
        </div>
      </div>
    </MerchantLayout>
  );
}