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
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";

interface IMerchant {
  id: number;
  name: string;
  email: string;
  phone: string;
  contactName: string;
  address: string;
  active: boolean;
  createdAt: string;
}

interface IPlaidMerchant {
  id: number;
  merchantId: number;
  plaidCustomerId?: string;
  originatorId?: string;
  onboardingStatus: string;
  onboardingUrl?: string;
  questionnaireId?: string;
  createdAt: string;
  updatedAt?: string;
}

interface IBusinessDetails {
  legalName?: string;
  ein?: string;
  businessStructure?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  websiteUrl?: string;
  industryType?: string;
  yearEstablished?: number;
  annualRevenue?: number;
  monthlyRevenue?: number;
  employeeCount?: number;
}

const MerchantDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [merchant, setMerchant] = useState<IMerchant | null>(null);
  const [plaidMerchant, setPlaidMerchant] = useState<IPlaidMerchant | null>(null);
  const [businessDetails, setBusinessDetails] = useState<IBusinessDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingStatus, setSyncingStatus] = useState<boolean>(false);

  const fetchMerchantDetail = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/admin/merchants/${id}`);
      if (response.data.success) {
        setMerchant(response.data.merchant);
        setPlaidMerchant(response.data.plaidMerchant);
        setBusinessDetails(response.data.businessDetails);
      } else {
        setError("Failed to fetch merchant details");
      }
    } catch (err) {
      setError("Error fetching merchant details: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchantDetail();
  }, [id]);

  // Function to sync Plaid status
  const syncPlaidStatus = async () => {
    if (!plaidMerchant || !plaidMerchant.originatorId) {
      setError("No Plaid originator ID available for this merchant");
      return;
    }

    try {
      setSyncingStatus(true);
      const response = await axios.post(`/api/plaid/sync-merchant-status/${id}`);
      if (response.data.success) {
        // Refresh merchant details
        fetchMerchantDetail();
      } else {
        setError("Failed to sync Plaid status: " + response.data.message);
      }
    } catch (err) {
      setError("Error syncing Plaid status: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSyncingStatus(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading merchant details...</div>;
  
  if (error) return <div className="text-center py-8 text-red-600">{error}</div>;

  if (!merchant) return <div className="text-center py-8">Merchant not found</div>;

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900">Merchant Information</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Details and Plaid onboarding status</p>
        </div>
        <div className="flex space-x-3">
          <Link to="/admin/merchants" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            Back to Merchants
          </Link>
          {plaidMerchant && plaidMerchant.originatorId && (
            <button
              onClick={syncPlaidStatus}
              disabled={syncingStatus}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              {syncingStatus ? "Syncing..." : "Sync Plaid Status"}
            </button>
          )}
        </div>
      </div>
      
      <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
        <dl className="sm:divide-y sm:divide-gray-200">
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Merchant name</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{merchant.name}</dd>
          </div>
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Contact name</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{merchant.contactName}</dd>
          </div>
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Email address</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{merchant.email}</dd>
          </div>
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Phone number</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{merchant.phone}</dd>
          </div>
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Address</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{merchant.address || "Not provided"}</dd>
          </div>
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Account created</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {new Date(merchant.createdAt).toLocaleString()}
            </dd>
          </div>
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Account status</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${merchant.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {merchant.active ? "Active" : "Inactive"}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Plaid Information Section */}
      <div className="px-4 py-5 sm:px-6 border-t border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Plaid Onboarding Status</h3>
      </div>
      
      <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
        <dl className="sm:divide-y sm:divide-gray-200">
          {plaidMerchant ? (
            <>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Onboarding Status</dt>
                <dd className="mt-1 text-sm sm:mt-0 sm:col-span-2">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${plaidMerchant.onboardingStatus === 'completed' ? 'bg-green-100 text-green-800' : 
                      plaidMerchant.onboardingStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                      plaidMerchant.onboardingStatus === 'in_progress' ? 'bg-blue-100 text-blue-800' : 
                      'bg-red-100 text-red-800'}`}
                  >
                    {plaidMerchant.onboardingStatus}
                  </span>
                </dd>
              </div>
              {plaidMerchant.plaidCustomerId && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Plaid Customer ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{plaidMerchant.plaidCustomerId}</dd>
                </div>
              )}
              {plaidMerchant.originatorId && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Originator ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{plaidMerchant.originatorId}</dd>
                </div>
              )}
              {plaidMerchant.onboardingUrl && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Onboarding URL</dt>
                  <dd className="mt-1 text-sm text-blue-600 sm:mt-0 sm:col-span-2">
                    <a href={plaidMerchant.onboardingUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      Open onboarding questionnaire
                    </a>
                  </dd>
                </div>
              )}
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Created At</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {new Date(plaidMerchant.createdAt).toLocaleString()}
                </dd>
              </div>
              {plaidMerchant.updatedAt && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {new Date(plaidMerchant.updatedAt).toLocaleString()}
                  </dd>
                </div>
              )}
            </>
          ) : (
            <div className="py-4 sm:py-5 sm:px-6">
              <p className="text-sm text-gray-500">No Plaid onboarding data available for this merchant.</p>
            </div>
          )}
        </dl>
      </div>
      
      {/* Business Details Section (if available) */}
      {businessDetails && (
        <>
          <div className="px-4 py-5 sm:px-6 border-t border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Business Details</h3>
          </div>
          
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              {businessDetails.legalName && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Legal Name</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{businessDetails.legalName}</dd>
                </div>
              )}
              {businessDetails.ein && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">EIN</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{businessDetails.ein}</dd>
                </div>
              )}
              {/* Additional business details can be added here */}
            </dl>
          </div>
        </>
      )}
    </div>
  );
};

export default MerchantDetail;
