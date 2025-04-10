import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useInvestorProfile } from '@/hooks/api/useInvestorProfile';

// Define the shape of our verification state
interface VerificationState {
  // Verification flow steps
  kycCompleted: boolean;
  accountLinkCompleted: boolean;
  accreditationCompleted: boolean;
  
  // Step-specific data
  verificationSessionId: string | null;
  verificationStatus: string | null;
  
  // Progress tracking
  currentStep: 'kyc' | 'bank' | 'accreditation' | 'complete';
  overallProgress: number; // 0-100
}

// Define the interface for our context
interface VerificationContextType {
  state: VerificationState;
  
  // Methods to update state
  setKycCompleted: (completed: boolean) => void;
  setAccountLinkCompleted: (completed: boolean) => void;
  setAccreditationCompleted: (completed: boolean) => void;
  setVerificationSessionId: (sessionId: string | null) => void;
  setVerificationStatus: (status: string | null) => void;
  
  // Helper methods
  getNextStep: () => string;
  isVerificationComplete: () => boolean;
  resetVerification: () => void;
}

// Create the context with a default empty state
const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

// Initial state for the verification process
const initialState: VerificationState = {
  kycCompleted: false,
  accountLinkCompleted: false,
  accreditationCompleted: false,
  verificationSessionId: null,
  verificationStatus: null,
  currentStep: 'kyc',
  overallProgress: 0,
};

// Props for the provider component
interface VerificationProviderProps {
  children: ReactNode;
}

// Provider component to wrap around components that need access to verification state
export function VerificationProvider({ children }: VerificationProviderProps) {
  const [state, setState] = useState<VerificationState>(initialState);
  const { profile } = useInvestorProfile();
  
  // Update state based on profile data when it's loaded
  useEffect(() => {
    if (profile) {
      setState(prevState => ({
        ...prevState,
        kycCompleted: profile.kycCompleted || false,
        verificationStatus: profile.verificationStatus || null,
        verificationSessionId: profile.verificationSessionId || null,
        accountLinkCompleted: profile.bankAccountLinked || false,
        accreditationCompleted: profile.accreditationStatus || false,
        currentStep: determineCurrentStep(profile),
        overallProgress: calculateProgress(profile),
      }));
    }
  }, [profile]);
  
  // Helper function to determine the current step based on profile data
  function determineCurrentStep(profile: any): 'kyc' | 'bank' | 'accreditation' | 'complete' {
    if (!profile.kycCompleted) {
      return 'kyc';
    }
    
    if (!profile.bankAccountLinked) {
      return 'bank';
    }
    
    if (!profile.accreditationStatus) {
      return 'accreditation';
    }
    
    return 'complete';
  }
  
  // Helper function to calculate overall progress
  function calculateProgress(profile: any): number {
    let progress = 0;
    
    // KYC is 40% of the process
    if (profile.kycCompleted) {
      progress += 40;
    } else if (profile.verificationStatus === 'pending') {
      progress += 20;
    }
    
    // Bank account linking is 30% of the process
    if (profile.bankAccountLinked) {
      progress += 30;
    }
    
    // Accreditation is 30% of the process
    if (profile.accreditationStatus) {
      progress += 30;
    }
    
    return progress;
  }
  
  // Methods to update state
  const setKycCompleted = (completed: boolean) => {
    setState(prevState => {
      const newState = {
        ...prevState,
        kycCompleted: completed,
      };
      
      // If KYC is completed, move to the next step
      if (completed && prevState.currentStep === 'kyc') {
        newState.currentStep = 'bank';
      }
      
      // Update overall progress
      newState.overallProgress = calculateProgressFromState(newState);
      
      return newState;
    });
  };
  
  const setAccountLinkCompleted = (completed: boolean) => {
    setState(prevState => {
      const newState = {
        ...prevState,
        accountLinkCompleted: completed,
      };
      
      // If account linking is completed, move to the next step
      if (completed && prevState.currentStep === 'bank') {
        newState.currentStep = 'accreditation';
      }
      
      // Update overall progress
      newState.overallProgress = calculateProgressFromState(newState);
      
      return newState;
    });
  };
  
  const setAccreditationCompleted = (completed: boolean) => {
    setState(prevState => {
      const newState = {
        ...prevState,
        accreditationCompleted: completed,
      };
      
      // If accreditation is completed, move to the final step
      if (completed && prevState.currentStep === 'accreditation') {
        newState.currentStep = 'complete';
      }
      
      // Update overall progress
      newState.overallProgress = calculateProgressFromState(newState);
      
      return newState;
    });
  };
  
  const setVerificationSessionId = (sessionId: string | null) => {
    setState(prevState => ({
      ...prevState,
      verificationSessionId: sessionId,
    }));
  };
  
  const setVerificationStatus = (status: string | null) => {
    setState(prevState => ({
      ...prevState,
      verificationStatus: status,
    }));
  };
  
  // Helper function to calculate progress based on state
  function calculateProgressFromState(state: VerificationState): number {
    let progress = 0;
    
    // KYC is 40% of the process
    if (state.kycCompleted) {
      progress += 40;
    } else if (state.verificationStatus === 'pending') {
      progress += 20;
    }
    
    // Bank account linking is 30% of the process
    if (state.accountLinkCompleted) {
      progress += 30;
    }
    
    // Accreditation is 30% of the process
    if (state.accreditationCompleted) {
      progress += 30;
    }
    
    return progress;
  }
  
  // Helper method to get the next step
  const getNextStep = (): string => {
    switch (state.currentStep) {
      case 'kyc':
        return '/investor/verify/kyc';
      case 'bank':
        return '/investor/verify/bank';
      case 'accreditation':
        return '/investor/verify/accreditation';
      case 'complete':
        return '/investor/dashboard';
      default:
        return '/investor/verify/kyc';
    }
  };
  
  // Helper method to check if verification is complete
  const isVerificationComplete = (): boolean => {
    return state.kycCompleted && state.accountLinkCompleted && state.accreditationCompleted;
  };
  
  // Reset verification state
  const resetVerification = () => {
    setState(initialState);
  };
  
  // Create the value object to provide to consumers
  const value: VerificationContextType = {
    state,
    setKycCompleted,
    setAccountLinkCompleted,
    setAccreditationCompleted,
    setVerificationSessionId,
    setVerificationStatus,
    getNextStep,
    isVerificationComplete,
    resetVerification,
  };
  
  return (
    <VerificationContext.Provider value={value}>
      {children}
    </VerificationContext.Provider>
  );
}

// Custom hook to use the verification context
export function useVerification() {
  const context = useContext(VerificationContext);
  
  if (context === undefined) {
    throw new Error('useVerification must be used within a VerificationProvider');
  }
  
  return context;
}