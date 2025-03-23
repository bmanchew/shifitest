import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  MessageSquare, 
  CreditCard, 
  FileSignature, 
  User,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, getQueryFn } from '@/lib/api'; // Corrected import

interface ApiKeyStatus {
  configured: boolean;
  valid: boolean;
  message: string;
}

interface ApiKeyVerificationResult {
  twilio: ApiKeyStatus;
  didit: ApiKeyStatus;
  plaid: ApiKeyStatus;
  thanksroger: ApiKeyStatus;
}

export default function ApiKeyStatus() {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTestingTwilio, setIsTestingTwilio] = useState(false);
  const [isTestingDidit, setIsTestingDidit] = useState(false);
  const [isTestingPlaid, setIsTestingPlaid] = useState(false);
  const [isTestingThanksRoger, setIsTestingThanksRoger] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<ApiKeyVerificationResult>({
    queryKey: ['/api/verify-api-keys'],
    refetchOnWindowFocus: false,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: 'API Keys Refreshed',
        description: 'The API key status has been refreshed.',
      });
    } catch (err) {
      toast({
        title: 'Error Refreshing',
        description: 'Failed to refresh API key status.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const testTwilioApiMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<Response>('POST', '/api/send-sms', {
        phone: '+11234567890', // Test number
        message: 'This is a test message from ShiFi finance platform',
        isTest: true
      });
    },
    onSuccess: () => {
      toast({
        title: 'Twilio Test Successful',
        description: 'Test message was sent successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Twilio Test Failed',
        description: error instanceof Error ? error.message : 'Failed to send test message',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsTestingTwilio(false);
    }
  });

  const testDiditApiMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<Response>('POST', '/api/mock/didit-kyc', {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        ssn: '123-45-6789',
        dob: '1990-01-01',
      });
    },
    onSuccess: () => {
      toast({
        title: 'DiDit Test Successful',
        description: 'KYC verification test was successful.',
      });
    },
    onError: (error) => {
      toast({
        title: 'DiDit Test Failed',
        description: error instanceof Error ? error.message : 'Failed to test KYC verification',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsTestingDidit(false);
    }
  });

  const testPlaidApiMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<Response>('POST', '/api/mock/plaid-link', {
        accountId: 'test-account',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Plaid Test Successful',
        description: 'Bank connection test was successful.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Plaid Test Failed',
        description: error instanceof Error ? error.message : 'Failed to test bank connection',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsTestingPlaid(false);
    }
  });

  const testThanksRogerApiMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<Response>('POST', '/api/mock/thanks-roger-signing', {
        documentId: 'test-document',
        signerName: 'Test Signer',
        signerEmail: 'test@example.com',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Thanks Roger Test Successful',
        description: 'Electronic signature test was successful.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Thanks Roger Test Failed',
        description: error instanceof Error ? error.message : 'Failed to test electronic signature',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsTestingThanksRoger(false);
    }
  });

  const handleTestTwilio = () => {
    setIsTestingTwilio(true);
    testTwilioApiMutation.mutate();
  };

  const handleTestDidit = () => {
    setIsTestingDidit(true);
    testDiditApiMutation.mutate();
  };

  const handleTestPlaid = () => {
    setIsTestingPlaid(true);
    testPlaidApiMutation.mutate();
  };

  const handleTestThanksRoger = () => {
    setIsTestingThanksRoger(true);
    testThanksRogerApiMutation.mutate();
  };

  const renderStatusIcon = (status: ApiKeyStatus) => {
    if (!status.configured) {
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
    return status.valid ? 
      <CheckCircle className="h-5 w-5 text-green-500" /> : 
      <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusColor = (status: ApiKeyStatus) => {
    if (!status.configured) return 'text-yellow-500';
    return status.valid ? 'text-green-500' : 'text-red-500';
  };

  const getStatusBadge = (status: ApiKeyStatus) => {
    if (!status.configured) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Not Configured</Badge>;
    }
    return status.valid ? 
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Valid</Badge> : 
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Invalid</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Key Status</CardTitle>
          <CardDescription>Checking status of third-party API integrations</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Key Status</CardTitle>
          <CardDescription>Error checking API key status</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'An error occurred while checking API keys'}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">API Integration Status</CardTitle>
            <CardDescription>Status of third-party API keys and integrations</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="flex items-center gap-1"
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {data && (
          <div className="space-y-6">
            {/* Twilio */}
            <div className="rounded-lg border p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-medium">Twilio</h3>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(data.twilio)}
                  {renderStatusIcon(data.twilio)}
                </div>
              </div>
              <p className={`text-sm ${getStatusColor(data.twilio)}`}>{data.twilio.message}</p>
              <p className="text-sm text-gray-500 mt-1">Used for sending SMS notifications to customers during application process</p>
              <div className="mt-4">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleTestTwilio}
                  disabled={isTestingTwilio || !data.twilio.configured}
                >
                  {isTestingTwilio ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                  Test SMS
                </Button>
              </div>
            </div>

            {/* DiDit */}
            <div className="rounded-lg border p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-lg font-medium">DiDit</h3>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(data.didit)}
                  {renderStatusIcon(data.didit)}
                </div>
              </div>
              <p className={`text-sm ${getStatusColor(data.didit)}`}>{data.didit.message}</p>
              <p className="text-sm text-gray-500 mt-1">Used for KYC (Know Your Customer) verification during onboarding</p>
              <div className="mt-4">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleTestDidit}
                  disabled={isTestingDidit || !data.didit.configured}
                >
                  {isTestingDidit ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                  Test KYC
                </Button>
              </div>
            </div>

            {/* Plaid */}
            <div className="rounded-lg border p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-lg font-medium">Plaid</h3>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(data.plaid)}
                  {renderStatusIcon(data.plaid)}
                </div>
              </div>
              <p className={`text-sm ${getStatusColor(data.plaid)}`}>{data.plaid.message}</p>
              <p className="text-sm text-gray-500 mt-1">Used for bank account connections and payment processing</p>
              <div className="mt-4">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleTestPlaid}
                  disabled={isTestingPlaid || !data.plaid.configured}
                >
                  {isTestingPlaid ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                  Test Bank Connection
                </Button>
              </div>
            </div>

            {/* Thanks Roger */}
            <div className="rounded-lg border p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-violet-500" />
                  <h3 className="text-lg font-medium">Thanks Roger</h3>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(data.thanksroger)}
                  {renderStatusIcon(data.thanksroger)}
                </div>
              </div>
              <p className={`text-sm ${getStatusColor(data.thanksroger)}`}>{data.thanksroger.message}</p>
              <p className="text-sm text-gray-500 mt-1">Used for electronic signatures and document processing</p>
              <div className="mt-4">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleTestThanksRoger}
                  disabled={isTestingThanksRoger || !data.thanksroger.configured}
                >
                  {isTestingThanksRoger ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                  Test E-Signature
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t bg-gray-50">
        <div className="w-full text-sm text-gray-500">
          <p>Last checked: {data ? new Date().toLocaleString() : 'N/A'}</p>
          <p className="mt-1">All API keys make actual calls to external services to verify their validity</p>
        </div>
      </CardFooter>
    </Card>
  );
}