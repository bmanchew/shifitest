import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/apiClient';

export interface InvestorProfile {
  id: number;
  userId: number;
  accreditationStatus: boolean | null;
  verificationStatus: string;
  kycCompleted: boolean;
  verificationSessionId: string | null;
  documentVerificationCompleted: boolean;
  investmentGoals: string;
  [key: string]: any; // For any additional fields
}

interface ProfileResponse {
  success: boolean;
  profile: InvestorProfile;
}

/**
 * Hook to fetch and manage the investor profile data
 * Centralizes the fetching logic and provides consistent error handling
 */
export function useInvestorProfile() {
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/investor/profile'],
    queryFn: async () => {
      const response = await apiClient.get<ProfileResponse>('/api/investor/profile');
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      if (!response.data?.profile) {
        return null;
      }
      
      return response.data.profile;
    }
  });

  return {
    profile: data,
    isLoading,
    error: error as Error | null,
    refetch
  };
}