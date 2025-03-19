import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface MerchantPlaidSettingsProps {
  merchantId: number;
}

interface PlaidSettings {
  id: number;
  merchantId: number;
  clientId: string | null;
  originatorId: string | null;
  onboardingStatus: string;
  defaultFundingAccount: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export function MerchantPlaidSettings({ merchantId }: MerchantPlaidSettingsProps) {
  const [formData, setFormData] = useState({
    clientId: '',
    defaultFundingAccount: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  // Fetch the merchant's Plaid settings
  const { 
    data: plaidSettings,
    isLoading,
    isError,
    refetch 
  } = useQuery({
    queryKey: ['/api/merchants', merchantId, 'plaid-settings'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/merchants/${merchantId}/plaid-settings`);
        return response as unknown as PlaidSettings;
      } catch (error) {
        // If 404, it means settings don't exist yet which is okay
        if (error instanceof Response && error.status === 404) {
          return null;
        }
        throw error;
      }
    }
  });

  // Mutation to update the Plaid settings
  const { mutate: updateSettings, isPending: isUpdating } = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest('PATCH', `/api/merchants/${merchantId}/plaid-settings`, data);
    },
    onSuccess: () => {
      toast({
        title: 'Settings Updated',
        description: 'Plaid settings have been successfully updated.',
      });
      setIsEditing(false);
      refetch();
    },
    onError: (error) => {
      console.error('Failed to update Plaid settings:', error);
      toast({
        title: 'Update Failed',
        description: 'There was an error updating the Plaid settings.',
        variant: 'destructive',
      });
    }
  });

  // Mutation to sync with Plaid
  const { mutate: syncWithPlaid, isPending: isSyncing } = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/merchants/${merchantId}/plaid-sync`);
    },
    onSuccess: () => {
      toast({
        title: 'Sync Successful',
        description: 'Successfully synced with Plaid platform.',
      });
      refetch();
    },
    onError: (error) => {
      console.error('Failed to sync with Plaid:', error);
      toast({
        title: 'Sync Failed',
        description: 'There was an error syncing with Plaid.',
        variant: 'destructive',
      });
    }
  });

  // Update form data when settings are loaded
  useEffect(() => {
    if (plaidSettings) {
      setFormData({
        clientId: plaidSettings.clientId || '',
        defaultFundingAccount: plaidSettings.defaultFundingAccount || ''
      });
    }
  }, [plaidSettings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-500">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plaid Settings</CardTitle>
          <CardDescription>Configure Plaid platform integration for this merchant</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Loading settings...</span>
        </CardContent>
      </Card>
    );
  }

  if (isError && !plaidSettings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plaid Settings</CardTitle>
          <CardDescription>Configure Plaid platform integration for this merchant</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex items-center text-red-500 mb-4">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>Error loading Plaid settings</p>
          </div>
          <Button onClick={() => refetch()}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Plaid Settings</CardTitle>
            <CardDescription>Configure Plaid platform integration for this merchant</CardDescription>
          </div>
          {plaidSettings && plaidSettings.onboardingStatus && (
            <div className="flex items-center">
              <span className="mr-2">Status:</span>
              {getStatusBadge(plaidSettings.onboardingStatus)}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="clientId">Plaid Client ID</Label>
              <div className="flex">
                <Input
                  id="clientId"
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleChange}
                  disabled={!isEditing || isUpdating}
                  placeholder="Client ID from Plaid Dashboard"
                  className="flex-1"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                This is the unique client identifier assigned by Plaid for this merchant.
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="defaultFundingAccount">Default Funding Account</Label>
              <Input
                id="defaultFundingAccount"
                name="defaultFundingAccount"
                value={formData.defaultFundingAccount}
                onChange={handleChange}
                disabled={!isEditing || isUpdating}
                placeholder="Account ID for default funding"
              />
              <p className="text-sm text-muted-foreground">
                The account ID to use for funding payments by default.
              </p>
            </div>

            {plaidSettings && plaidSettings.originatorId && (
              <div className="grid gap-2 mt-4">
                <Label>Originator ID</Label>
                <div className="p-2 bg-muted rounded-md">
                  {plaidSettings.originatorId}
                </div>
                <p className="text-sm text-muted-foreground">
                  The Plaid originator ID assigned to this merchant. This is generated by Plaid during onboarding.
                </p>
              </div>
            )}
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between gap-2 pt-0">
        {isEditing ? (
          <>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditing(false);
                // Reset form to current settings
                if (plaidSettings) {
                  setFormData({
                    clientId: plaidSettings.clientId || '',
                    defaultFundingAccount: plaidSettings.defaultFundingAccount || ''
                  });
                }
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              onClick={handleSubmit}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            {plaidSettings && plaidSettings.originatorId && (
              <Button 
                variant="outline" 
                onClick={() => syncWithPlaid()}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync with Plaid
                  </>
                )}
              </Button>
            )}
            <Button 
              onClick={() => setIsEditing(true)}
            >
              Edit Settings
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}