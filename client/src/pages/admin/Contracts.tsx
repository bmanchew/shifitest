import AdminLayout from "@/components/layout/AdminLayout";
import ContractList from "@/components/admin/ContractList";
import { useQuery } from "@tanstack/react-query";
import { Contract } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { extractApiErrorMessage, isSessionExpiredError } from '@/lib/errorHandling';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function Contracts() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: contracts = [],
    isLoading,
    error,
    refetch
  } = useQuery<Contract[]>({
    queryKey: ["/api/contracts", { admin: true }],
    queryFn: async () => {
      try {
        // Use apiRequest to include auth token and proper error handling
        const response = await apiRequest("GET", "/api/contracts?admin=true");
        
        // Handle response data
        if (Array.isArray(response)) {
          return response;
        } else if (response && response.success === false) {
          throw new Error(response.message || "Failed to fetch contracts");
        }
        
        // Default return if response doesn't match expected format
        return [];
      } catch (error) {
        console.error("Error fetching contracts:", error);
        
        // Extract user-friendly error message
        const errorMsg = extractApiErrorMessage(error);
        
        // Check for specific error types
        if (isSessionExpiredError(error)) {
          throw new Error("Your session has expired. Please log in again.");
        }
        
        throw new Error(`Error: ${errorMsg}`);
      }
    },
    // Add error handling
    onError: (err) => {
      console.error("Contracts listing error:", err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  });

  return (
    <AdminLayout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              Contracts
            </h1>
            
            {errorMessage && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            )}
          </div>

          {errorMessage ? (
            <div className="p-4 border border-red-200 rounded-md bg-red-50 text-red-700 mb-4">
              <h3 className="font-medium mb-1">Error loading contracts</h3>
              <p className="text-sm">{errorMessage}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()} 
                className="mt-2 text-xs bg-red-100/50 hover:bg-red-100 border-red-200 text-red-700"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <ContractList contracts={contracts} isLoading={isLoading} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
