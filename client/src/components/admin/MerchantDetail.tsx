import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MerchantPlaidSettings } from './MerchantPlaidSettings';
import { Loader2, AlertCircle, Building, Phone, Mail, Home, User } from 'lucide-react';

interface MerchantDetailProps {
  merchantId: number;
}

interface Merchant {
  id: number;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string | null;
  active: boolean;
  createdAt: string;
  userId: number | null;
}

export function MerchantDetail({ merchantId }: MerchantDetailProps) {
  const { toast } = useToast();

  // Fetch merchant details
  const { 
    data: merchant, 
    isLoading, 
    isError 
  } = useQuery({
    queryKey: ['/api/merchants', merchantId],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/merchants/${merchantId}`);
        return response as unknown as Merchant;
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load merchant details',
          variant: 'destructive',
        });
        throw error;
      }
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-lg">Loading merchant details...</span>
      </div>
    );
  }

  if (isError || !merchant) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-semibold">Error Loading Merchant</h2>
        <p className="text-gray-500">Could not load merchant details. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{merchant.name}</h1>
          <p className="text-gray-500 mt-1">Merchant ID: {merchant.id}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Primary merchant contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="font-medium">Contact Person</p>
                  <p className="text-gray-600">{merchant.contactName}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-gray-600">{merchant.email}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-gray-600">{merchant.phone}</p>
                </div>
              </div>
              
              {merchant.address && (
                <div className="flex items-start gap-3">
                  <Home className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Address</p>
                    <p className="text-gray-600">{merchant.address}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="font-medium">Account Status</p>
                  <p className={`font-semibold ${merchant.active ? 'text-green-600' : 'text-red-600'}`}>
                    {merchant.active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Additional information about this merchant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">Created On</p>
                <p className="text-gray-600">
                  {new Date(merchant.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              
              {merchant.userId && (
                <div>
                  <p className="font-medium">User Account ID</p>
                  <p className="text-gray-600">{merchant.userId}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator className="my-6" />

        <Tabs defaultValue="plaid" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="plaid">Plaid Integration</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>
          
          <TabsContent value="plaid" className="space-y-4">
            <MerchantPlaidSettings merchantId={merchant.id} />
          </TabsContent>
          
          <TabsContent value="contracts">
            <Card>
              <CardHeader>
                <CardTitle>Contracts</CardTitle>
                <CardDescription>Financing contracts for this merchant</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Contract list will be displayed here</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Business documents and verification files</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Document management will be displayed here</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>Recent activity related to this merchant</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Activity log will be displayed here</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}