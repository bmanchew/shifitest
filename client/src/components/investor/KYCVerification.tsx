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
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Interface for the verification session
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

  // Get investor profile to check current verification status
  const profileQuery = useQuery({
    queryKey: ['/api/investor/profile'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/investor/profile');
      return response.profile;
    }
  });

  // Create a verification session
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/investor/kyc/create-session');
      return response;
    },
    onSuccess: (data) => {
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

  // Check session status
  const checkSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest('GET', `/api/investor/kyc/session/${sessionId}`);
      return response;
    },
    onSuccess: (data) => {
      if (data.status === 'approved' || data.status === 'verified') {
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
      } else if (data.status === 'rejected') {
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

  // Poll for session status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPolling && session?.sessionId) {
      interval = setInterval(() => {
        checkSessionMutation.mutate(session.sessionId);
      }, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling, session, checkSessionMutation]);

  // Start verification process
  const startVerification = () => {
    createSessionMutation.mutate();
  };

  // Redirect to verification provider
  const redirectToVerification = () => {
    if (session?.sessionUrl) {
      window.location.href = session.sessionUrl;
    }
  };

  // Loading state
  if (profileQuery.isLoading) {
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

  // If already verified
  if (profileQuery.data?.verificationStatus === 'verified' || 
      profileQuery.data?.kycCompleted === true) {
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
        <h1 className="text-3xl font-bold">KYC Verification</h1>
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
            {profileQuery.data?.verificationStatus === 'pending' || isPolling ? (
              <Alert className="mb-6 bg-blue-50 border-blue-200">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <AlertTitle className="text-blue-800">Verification in Progress</AlertTitle>
                <AlertDescription className="text-blue-700">
                  We're currently processing your verification information. This typically takes 1-2 minutes, but may take longer in some cases.
                </AlertDescription>
              </Alert>
            ) : profileQuery.data?.verificationStatus === 'rejected' ? (
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