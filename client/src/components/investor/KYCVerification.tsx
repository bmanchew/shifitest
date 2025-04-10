import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { VerificationStatusBadge } from '@/features/investor/VerificationStatusBadge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/apiClient';
// Removed formatVerificationStatus as it's not found
import { useVerification } from '@/context/VerificationContext';
import { useInvestorProfile } from '@/hooks/api/useInvestorProfile';

// Interface for the verification session
// API response types
interface ProfileResponse {
  success: boolean;
  profile: {
    id: number;
    userId: number;
    accreditationStatus: boolean | null;
    verificationStatus: string;
    kycCompleted: boolean;
    verificationSessionId: string | null;
    documentVerificationCompleted: boolean;
    investmentGoals: string;
    [key: string]: any; // For any additional fields
  };
}

interface CreateSessionResponse {
  success: boolean;
  sessionId: string;
  sessionUrl: string;
}

interface SessionStatusResponse {
  success: boolean;
  status: {
    status: string;
    decision?: {
      status: string;
    };
  };
}

interface VerificationSession {
  sessionId: string;
  sessionUrl: string;
  status: string;
  createdAt: string;
}

export default function KYCVerification() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/investor/verify/kyc/:status?');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [progress, setProgress] = useState(0);

  // Use our new hook instead of direct query
  const { profile, isLoading: profileLoading, error: profileError } = useInvestorProfile();
  
  // For backward compatibility during transition
  const profileQuery = useQuery({
    queryKey: ['/api/investor/profile'],
    queryFn: async () => {
      const response = await apiClient.get<ProfileResponse>('/api/investor/profile');
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data?.profile;
    },
    enabled: !profile // Only run this query if our hook doesn't return a profile
  });

  // Create a verification session with our new API client
  const createSessionMutation = useMutation({
    mutationFn: async (): Promise<CreateSessionResponse> => {
      const response = await apiClient.post<CreateSessionResponse>('/api/investor/kyc/create-session');
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as CreateSessionResponse;
    },
    onSuccess: (data: CreateSessionResponse) => {
      setSession({
        sessionId: data.sessionId,
        sessionUrl: data.sessionUrl,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      setProgress(25);
      
      // Start polling for status updates
      setIsPolling(true);
    },
    onError: (error) => {
      toast({
        title: "Error Creating Verification Session",
        description: "There was a problem setting up your identity verification. Please try again.",
        variant: "destructive",
      });
      console.error('Error creating verification session:', error);
    }
  });

  // Check session status with our new API client
  const checkSessionMutation = useMutation({
    mutationFn: async (sessionId: string): Promise<SessionStatusResponse> => {
      const response = await apiClient.get<SessionStatusResponse>(`/api/investor/kyc/session/${sessionId}`);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as SessionStatusResponse;
    },
    onSuccess: (data: SessionStatusResponse) => {
      // Check verification status based on the status object
      const status = data.status?.status;
      const decision = data.status?.decision?.status;
      
      if (status === 'completed' && decision === 'approved') {
        setProgress(100);
        setIsPolling(false);
        
        // Invalidate profile query to get updated verification status
        queryClient.invalidateQueries({ queryKey: ['/api/investor/profile'] });
        
        toast({
          title: "Verification Successful",
          description: "Your identity has been verified successfully. You can now access all investor features.",
        });
        
        // Redirect to connect bank account page
        setTimeout(() => {
          setLocation('/investor/verify/bank');
        }, 2000);
      } else if (status === 'rejected' || decision === 'rejected') {
        setProgress(0);
        setIsPolling(false);
        
        toast({
          title: "Verification Failed",
          description: "Your identity verification was not successful. Please contact support for assistance.",
          variant: "destructive",
        });
      }
    }
  });

  // Handle URL callback with status parameter
  useEffect(() => {
    if (match && params && params.status) {
      if (params.status === 'success') {
        setProgress(75);
        toast({
          title: "Verification Information Submitted",
          description: "Your identity verification information has been submitted. We're processing it now.",
        });
      } else if (params.status === 'cancelled') {
        toast({
          title: "Verification Cancelled",
          description: "You cancelled the identity verification process. You'll need to complete this step before investing.",
          variant: "destructive",
        });
      }
    }
  }, [match, params, toast]);

  // Poll for session status with exponential backoff
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let pollCount = 0;
    const MAX_POLLS = 12; // Maximum number of polls (1 hour with exponential backoff)
    const BASE_INTERVAL = 5000; // Start with 5 seconds
    
    const pollWithBackoff = () => {
      if (!isPolling || !session?.sessionId) return;
      
      // Exponential backoff with maximum interval capped at 2 minutes
      const interval = Math.min(BASE_INTERVAL * Math.pow(1.5, pollCount), 120000);
      
      // Log polling attempt for debugging
      console.log(`Polling session ${session.sessionId} (attempt ${pollCount + 1}/${MAX_POLLS})`);
      
      checkSessionMutation.mutate(session.sessionId, {
        onSuccess: (data: SessionStatusResponse) => {
          // If verification is complete, stop polling
          if (data.status?.status === 'completed') {
            setIsPolling(false);
            setProgress(100);
            
            // If approved, redirect to dashboard after a short delay
            if (data.status?.decision?.status === 'approved') {
              setTimeout(() => {
                setLocation('/investor/dashboard');
              }, 2000);
            }
          } else {
            // Continue polling if not complete and under max attempts
            pollCount++;
            if (pollCount < MAX_POLLS) {
              timeoutId = setTimeout(pollWithBackoff, interval);
            } else {
              // Stop polling after max attempts
              setIsPolling(false);
              toast({
                title: "Verification Status Check Timeout",
                description: "We were unable to determine your verification status. Please check back later or contact support.",
                variant: "destructive",
              });
            }
          }
        },
        onError: () => {
          // On error, retry with exponential backoff
          pollCount++;
          if (pollCount < MAX_POLLS) {
            timeoutId = setTimeout(pollWithBackoff, interval);
          } else {
            setIsPolling(false);
            toast({
              title: "Verification Status Check Failed",
              description: "There was a problem checking your verification status. Please check back later.",
              variant: "destructive",
            });
          }
        }
      });
    };
    
    if (isPolling && session?.sessionId) {
      pollWithBackoff();
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isPolling, session, checkSessionMutation, setLocation, toast]);

  // Start verification process
  const startVerification = () => {
    createSessionMutation.mutate();
  };

  // Redirect to verification provider
  const redirectToVerification = () => {
    if (session?.sessionUrl) {
      // For external URLs, we need to use window.location
      // This is the correct use case for window.location.href
      window.open(session.sessionUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Loading state
  if (profileLoading || (!profile && profileQuery.isLoading)) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">KYC Verification</h1>
          <p className="text-muted-foreground mt-2">
            Loading your verification status...
          </p>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-40 ml-auto" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  // If already verified - use profile from hook if available, otherwise fallback to query
  const currentProfile = profile || profileQuery.data;
  if (currentProfile?.verificationStatus === 'verified' || 
      currentProfile?.kycCompleted === true) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">KYC Verification</h1>
          <p className="text-muted-foreground mt-2">
            Your identity has been verified. You can now access all investor features.
          </p>
        </div>
        
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Verification Complete</AlertTitle>
          <AlertDescription className="text-green-700">
            Your identity has been successfully verified. You can proceed with investing in available offerings.
          </AlertDescription>
        </Alert>
        
        <div className="flex justify-end">
          <Button onClick={() => setLocation('/investor/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">KYC Verification</h1>
          {currentProfile?.verificationStatus && (
            <VerificationStatusBadge status={currentProfile.verificationStatus as any} />
          )}
        </div>
        <p className="text-muted-foreground mt-2">
          To comply with regulations, we need to verify your identity before you can access the investor portal.
        </p>
      </div>

      <div className="mb-8">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground mt-2">
          <span>Start</span>
          <span>Verification</span>
          <span>Processing</span>
          <span>Complete</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity Verification</CardTitle>
          <CardDescription>
            We've partnered with Didit, a trusted identity verification provider, to securely verify your identity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {currentProfile?.verificationStatus === 'pending' || isPolling ? (
              <Alert className="mb-6 bg-blue-50 border-blue-200">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <AlertTitle className="text-blue-800">Verification in Progress</AlertTitle>
                <AlertDescription className="text-blue-700">
                  We're currently processing your verification information. This typically takes 1-2 minutes, but may take longer in some cases.
                </AlertDescription>
              </Alert>
            ) : currentProfile?.verificationStatus === 'rejected' ? (
              <Alert className="mb-6 bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">Verification Failed</AlertTitle>
                <AlertDescription className="text-red-700">
                  We couldn't verify your identity with the information provided. Please try again or contact our support team for assistance.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="bg-gray-50 border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">What to Expect</h3>
              <ul className="space-y-2 list-disc pl-5">
                <li>You'll be redirected to our secure identity verification partner</li>
                <li>You'll need to provide a photo of your government-issued ID</li>
                <li>You'll be asked to take a selfie for facial verification</li>
                <li>The process typically takes less than 5 minutes</li>
                <li>Once verified, you'll be able to access all investor features</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Required Documents</h3>
              <ul className="space-y-2 list-disc pl-5">
                <li>Government-issued photo ID (driver's license, passport, or state ID)</li>
                <li>Access to your device's camera</li>
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          {!session ? (
            <Button 
              onClick={startVerification}
              disabled={createSessionMutation.isPending}
            >
              {createSessionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting Up Verification
                </>
              ) : (
                'Start Verification Process'
              )}
            </Button>
          ) : !isPolling ? (
            <Button 
              onClick={redirectToVerification}
            >
              Continue to Identity Verification
            </Button>
          ) : (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying Identity
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}