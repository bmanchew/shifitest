import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { usePlaidLink } from 'react-plaid-link';
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
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Check, CreditCard, Building2, Loader2 } from 'lucide-react';

export default function BankConnection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [accountLinked, setAccountLinked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Function to get a Plaid link token from our backend
  const getLinkToken = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest<{success: boolean; linkToken: string; expiration: string}>('POST', '/api/investor/plaid/create-link-token');
      
      if (response.linkToken) {
        setLinkToken(response.linkToken);
      } else {
        throw new Error('No link token received from server');
      }
    } catch (error) {
      console.error('Error getting Plaid link token:', error);
      toast({
        title: 'Connection Error',
        description: 'Unable to initialize bank connection. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Function to handle successful Plaid link
  const onSuccess = useCallback(async (publicToken: string, metadata: any) => {
    setIsLinking(true);
    try {
      // Extract the required account data from metadata
      const account = metadata.accounts[0];
      const institution = metadata.institution;
      
      const response = await apiRequest('POST', '/api/investor/plaid/exchange-token', {
        publicToken,
        accountId: account.id,
        accountName: account.name,
        accountType: account.type,
        institution: institution.name
      });
      
      setAccountLinked(true);
      
      toast({
        title: 'Account Connected',
        description: 'Your bank account has been successfully connected to ShiFi.',
      });
      
      // Navigate to the dashboard after a brief delay
      setTimeout(() => {
        setLocation('/investor/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error exchanging Plaid token:', error);
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect your bank account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLinking(false);
    }
  }, [setLocation, toast]);
  
  // Configure the Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess,
    onExit: () => {
      // User exited the Plaid Link flow
      console.log('User exited Plaid Link flow');
    },
    onEvent: (eventName, metadata) => {
      // Handle Link events
      console.log('Plaid Link event:', eventName, metadata);
    },
  });

  // Get a link token when the component mounts
  useEffect(() => {
    if (!linkToken) {
      getLinkToken();
    }
  }, [getLinkToken, linkToken]);

  // For demo purposes, let's simulate a successful connection
  const handleDemoConnect = () => {
    setIsLinking(true);
    // Simulating API delay
    setTimeout(() => {
      setAccountLinked(true);
      toast({
        title: 'Account Connected',
        description: 'Your bank account has been successfully connected to ShiFi.',
      });
      // Navigate to dashboard after delay
      setTimeout(() => {
        setLocation('/investor/dashboard');
      }, 2000);
    }, 1500);
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Connect Your Bank Account</h1>
        <p className="text-muted-foreground mt-2">
          Connect your bank account to invest, receive distributions, and manage your investments.
        </p>
      </div>

      <div className="mb-8">
        <Progress value={accountLinked ? 100 : 75} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground mt-2">
          <span>Personal Information</span>
          <span>Document Upload</span>
          <span>Connect Bank</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Link Your Bank Account</CardTitle>
          <CardDescription>
            ShiFi uses Plaid, a secure financial service, to connect your bank account. Your credentials are never stored on our servers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            {isLoading ? (
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p>Initializing secure connection...</p>
              </div>
            ) : accountLinked ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="rounded-full bg-green-100 p-3">
                  <Check className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="text-xl font-medium">Account Successfully Connected</h3>
                <p className="text-center text-muted-foreground">
                  You're all set! You'll be redirected to your investor dashboard momentarily.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-full bg-primary/10 p-3">
                  <Building2 className="h-10 w-10 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-medium">Connect Your Bank Account</h3>
                <p className="mt-2 text-center text-muted-foreground max-w-md">
                  Connect your bank account to deposit funds for investments and receive distributions.
                </p>
                <div className="mt-6 space-y-4">
                  <Button 
                    onClick={() => {
                      // Use the real Plaid Link if available
                      if (ready && linkToken) {
                        open();
                      } else {
                        // Fallback to demo mode if Plaid isn't configured
                        handleDemoConnect();
                      }
                    }}
                    disabled={(!ready && !linkToken) || isLinking || accountLinked}
                    className="w-full md:w-auto"
                    size="lg"
                  >
                    {isLinking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Connect Bank Account
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => setLocation('/investor/verify/kyc')}
            disabled={accountLinked}
          >
            Back to KYC Verification
          </Button>
          {accountLinked && (
            <Button onClick={() => setLocation('/investor/dashboard')}>
              Go to Dashboard
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}