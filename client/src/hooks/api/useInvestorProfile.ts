import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/apiClient";

export interface InvestorProfile {
  id: number;
  userId: number;
  accreditationStatus: boolean | null;
  verificationStatus: string;
  kycCompleted: boolean;
  // Add other profile fields
}

export function useInvestorProfile() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["investorProfile"],
    queryFn: async () => {
      const response = await apiClient.get<{ profile: InvestorProfile }>("/api/investor/profile");
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data?.profile;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (profileData: Partial<InvestorProfile>) => {
      const response = await apiClient.post<{ success: boolean }>("/api/investor/profile", profileData);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate profile query to refresh data
      queryClient.invalidateQueries({ queryKey: ["investorProfile"] });
    },
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile: updateProfile.mutate,
    isUpdating: updateProfile.isPending,
  };
}