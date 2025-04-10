import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { apiClient } from "@/lib/api/apiClient";

type VerificationStatus = "not_started" | "pending" | "verified" | "rejected";

interface VerificationState {
  kycStatus: VerificationStatus;
  accreditationStatus: VerificationStatus;
  bankConnected: boolean;
  isVerified: boolean;
}

interface VerificationContextType {
  verificationState: VerificationState;
  refreshVerificationStatus: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

const VerificationContext = createContext<VerificationContextType | null>(null);

export function VerificationProvider({ children }: { children: ReactNode }) {
  const [verificationState, setVerificationState] = useState<VerificationState>({
    kycStatus: "not_started",
    accreditationStatus: "not_started",
    bankConnected: false,
    isVerified: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshVerificationStatus = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get<{ profile: any }>("/api/investor/profile");
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      const profile = response.data?.profile;
      
      if (profile) {
        setVerificationState({
          kycStatus: profile.kycStatus || "not_started",
          accreditationStatus: profile.accreditationStatus ? "verified" : "not_started",
          bankConnected: !!profile.plaidItemId,
          isVerified: profile.verificationStatus === "verified",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch verification status"));
    } finally {
      setIsLoading(false);
    }
  };

  // Load verification status on mount
  useEffect(() => {
    refreshVerificationStatus();
  }, []);

  return (
    <VerificationContext.Provider
      value={{
        verificationState,
        refreshVerificationStatus,
        isLoading,
        error,
      }}
    >
      {children}
    </VerificationContext.Provider>
  );
}

export function useVerification() {
  const context = useContext(VerificationContext);
  
  if (!context) {
    throw new Error("useVerification must be used within a VerificationProvider");
  }
  
  return context;
}