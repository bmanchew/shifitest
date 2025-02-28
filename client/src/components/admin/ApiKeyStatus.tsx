import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
            {error instanceof Error ? error.message : 'An error occurred while checking API keys'}
          </div>
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
    <Card>
      <CardHeader>
        <CardTitle>API Integration Status</CardTitle>
        <CardDescription>Status of third-party API keys and integrations</CardDescription>
      </CardHeader>
      <CardContent>
        {data && (
          <div className="space-y-6">
            {/* Twilio */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">Twilio</h3>
                {renderStatusIcon(data.twilio)}
              </div>
              <p className={`text-sm ${getStatusColor(data.twilio)}`}>{data.twilio.message}</p>
              <p className="text-sm text-gray-500 mt-1">Used for sending SMS notifications to customers</p>
            </div>
            
            <Separator />
            
            {/* DiDit */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">DiDit</h3>
                {renderStatusIcon(data.didit)}
              </div>
              <p className={`text-sm ${getStatusColor(data.didit)}`}>{data.didit.message}</p>
              <p className="text-sm text-gray-500 mt-1">Used for KYC (Know Your Customer) verification</p>
            </div>
            
            <Separator />
            
            {/* Plaid */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">Plaid</h3>
                {renderStatusIcon(data.plaid)}
              </div>
              <p className={`text-sm ${getStatusColor(data.plaid)}`}>{data.plaid.message}</p>
              <p className="text-sm text-gray-500 mt-1">Used for bank account connections and verification</p>
            </div>
            
            <Separator />
            
            {/* Thanks Roger */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">Thanks Roger</h3>
                {renderStatusIcon(data.thanksroger)}
              </div>
              <p className={`text-sm ${getStatusColor(data.thanksroger)}`}>{data.thanksroger.message}</p>
              <p className="text-sm text-gray-500 mt-1">Used for electronic signatures and document processing</p>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Refresh Status
        </Button>
      </CardFooter>
    </Card>
  );
}