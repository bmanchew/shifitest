import AdminLayout from "@/components/layout/AdminLayout";
import ContractList from "@/components/admin/ContractList";
import { useQuery } from "@tanstack/react-query";
import { Contract } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function Contracts() {
  const {
    data: contracts = [],
    isLoading,
    error,
  } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
    retry: 1,
  });

  return (
    <AdminLayout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">
            Contracts
          </h1>

          {error ? (
            <div className="p-4 border border-red-200 rounded-md bg-red-50 text-red-700">
              Error loading contracts. Please try again.
            </div>
          ) : (
            <ContractList contracts={contracts} isLoading={isLoading} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
