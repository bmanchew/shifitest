import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractApiErrorMessage } from '@/lib/errorHandling';
import { Loader2, Check, X, RefreshCw, Edit, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';

// Define types
interface PlaidMerchant {
  id: number;
  merchantId: number;
  merchantName: string;
  clientId: string | null;
  accessToken: string | null;
  onboardingStatus: string;
  createdAt: string;
  updatedAt: string | null;
}

interface EditCredentialsForm {
  merchantId: number;
  clientId: string;
  accessToken: string;
}

export function PlaidCredentialsManager() {
  // State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentMerchant, setCurrentMerchant] = useState<PlaidMerchant | null>(null);
  const [formData, setFormData] = useState<EditCredentialsForm>({
    merchantId: 0,
    clientId: '',
    accessToken: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all merchants with Plaid credentials
  const { 
    data: plaidMerchants = [], 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useQuery<PlaidMerchant[]>({
    queryKey: ['/api/admin/plaid/merchants'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/admin/plaid/merchants');
        return response.merchants || [];
      } catch (error) {
        const errorMessage = extractApiErrorMessage(error);
        setErrorMessage(errorMessage);
        throw error;
      }
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Error',
        description: `Failed to load Plaid merchant data: ${message}`,
        variant: 'destructive',
      });
    }
  });

  // Mutation to update Plaid credentials
  const { mutate: updateCredentials, isPending: isUpdating } = useMutation({
    mutationFn: async (data: EditCredentialsForm) => {
      return await apiRequest('PATCH', `/api/admin/plaid/merchants/${data.merchantId}`, {
        clientId: data.clientId,
        accessToken: data.accessToken,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Plaid credentials updated successfully.',
      });
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plaid/merchants'] });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error);
      toast({
        title: 'Error',
        description: `Failed to update Plaid credentials: ${message}`,
        variant: 'destructive',
      });
    }
  });

  // Mutation to sync with Plaid
  const { mutate: syncWithPlaid, isPending: isSyncing } = useMutation({
    mutationFn: async (merchantId: number) => {
      return await apiRequest('POST', `/api/admin/plaid/merchants/${merchantId}/generate-report`);
    },
    onSuccess: () => {
      toast({
        title: 'Sync Successful',
        description: 'Successfully synced with Plaid platform.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plaid/merchants'] });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error);
      toast({
        title: 'Sync Failed',
        description: `Error syncing with Plaid: ${message}`,
        variant: 'destructive',
      });
    }
  });

  // Handle opening the edit dialog
  const handleEditClick = (merchant: PlaidMerchant) => {
    setCurrentMerchant(merchant);
    setFormData({
      merchantId: merchant.merchantId,
      clientId: merchant.clientId || '',
      accessToken: merchant.accessToken || '',
    });
    setEditDialogOpen(true);
  };

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCredentials(formData);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  // Show masked access token
  const maskToken = (token: string | null) => {
    if (!token) return '—';
    return token.length > 8 
      ? `${token.substring(0, 4)}...${token.substring(token.length - 4)}`
      : '********';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plaid Merchant Credentials</CardTitle>
          <CardDescription>Manage Plaid credentials for all merchants</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Loading credentials...</span>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plaid Merchant Credentials</CardTitle>
          <CardDescription>Manage Plaid credentials for all merchants</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
            <h3 className="font-semibold mb-1">Error</h3>
            <p className="text-sm">{errorMessage || 'Failed to load Plaid credentials'}</p>
            <Button 
              onClick={() => refetch()} 
              className="mt-2 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plaid Merchant Credentials</CardTitle>
        <CardDescription>Manage Plaid credentials for all merchants with Plaid integrations</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption>A list of merchants with their Plaid credentials.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Merchant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Client ID</TableHead>
              <TableHead>Access Token</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plaidMerchants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                  No Plaid merchant credentials found.
                </TableCell>
              </TableRow>
            ) : (
              plaidMerchants.map((merchant) => (
                <TableRow key={merchant.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/merchants/${merchant.merchantId}`}>
                      {merchant.merchantName || `Merchant #${merchant.merchantId}`}
                    </Link>
                  </TableCell>
                  <TableCell>{getStatusBadge(merchant.onboardingStatus)}</TableCell>
                  <TableCell>{merchant.clientId || '—'}</TableCell>
                  <TableCell>{maskToken(merchant.accessToken)}</TableCell>
                  <TableCell>{new Date(merchant.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {merchant.updatedAt 
                      ? new Date(merchant.updatedAt).toLocaleDateString() 
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(merchant)}
                      >
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncWithPlaid(merchant.merchantId)}
                        disabled={isSyncing}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} /> 
                        Sync
                      </Button>
                      <Link href={`/admin/merchants/${merchant.merchantId}`}>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4 mr-1" /> View
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => refetch()}>
          Refresh List
        </Button>
        {/* Future: we could add a button to add credentials for a merchant that doesn't have them yet */}
      </CardFooter>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Plaid Credentials</DialogTitle>
            <DialogDescription>
              Update the Plaid API credentials for {currentMerchant?.merchantName || 'this merchant'}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="clientId">Plaid Client ID</Label>
                <Input
                  id="clientId"
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleChange}
                  disabled={isUpdating}
                  placeholder="Client ID from Plaid Dashboard"
                />
                <p className="text-sm text-muted-foreground">
                  This is the unique client identifier assigned by Plaid for this merchant.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accessToken">Plaid Access Token</Label>
                <Input
                  id="accessToken"
                  name="accessToken"
                  value={formData.accessToken}
                  onChange={handleChange}
                  disabled={isUpdating}
                  placeholder="Access token for Plaid API"
                />
                <p className="text-sm text-muted-foreground">
                  The access token allows secure API calls to Plaid on behalf of the merchant.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default PlaidCredentialsManager;