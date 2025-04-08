import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import PlaidAssetReport from './reports/PlaidAssetReport';
import MidDeskReport from './reports/MidDeskReport';
import DueDiligenceReport from './reports/DueDiligenceReport';
import { MerchantPlaidSettings } from './MerchantPlaidSettings';

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

interface PlaidMerchant {
  id: number;
  merchantId: number;
  plaidCustomerId: string | null;
  originatorId: string | null;
  onboardingStatus: string;
  onboardingUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface BusinessDetails {
  id: number;
  merchantId: number;
  legalName: string | null;
  ein: string | null;
  businessType: string | null;
  industry: string | null;
  yearFounded: number | null;
  annualRevenue: number | null;
  createdAt: string;
  updatedAt: string | null;
  middeskBusinessId?: string | null;
  verificationStatus?: 'not_started' | 'pending' | 'verified' | 'failed' | null;
  verificationData?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
}

function MerchantDetail({ merchantId }: MerchantDetailProps) {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [plaidMerchant, setPlaidMerchant] = useState<PlaidMerchant | null>(null);
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingStatus, setSyncingStatus] = useState<boolean>(false);
  const [verifyingBusiness, setVerifyingBusiness] = useState<boolean>(false);
  const [isEditingBusiness, setIsEditingBusiness] = useState<boolean>(false);
  const [editedBusinessDetails, setEditedBusinessDetails] = useState<BusinessDetails | null>(null);
  const [savingBusinessDetails, setSavingBusinessDetails] = useState<boolean>(false);
  const [runningMidDeskReport, setRunningMidDeskReport] = useState<boolean>(false);
  const { toast } = useToast();

  const fetchMerchantDetail = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/admin/merchants/${merchantId}`);
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
  }, [merchantId]);

  // Function to edit business details
  const handleEditBusinessDetails = () => {
    if (businessDetails) {
      setEditedBusinessDetails({...businessDetails});
      setIsEditingBusiness(true);
    } else {
      toast({
        title: "Error",
        description: "No business details found for this merchant",
        variant: "destructive"
      });
    }
  };
  
  // Function to save business details
  const saveBusinessDetails = async () => {
    if (!editedBusinessDetails) return;
    
    try {
      setSavingBusinessDetails(true);
      
      const response = await axios.put(`/api/admin/merchant-reports/${merchantId}/business-details`, editedBusinessDetails);
      
      if (response.data.success) {
        setBusinessDetails(response.data.businessDetails);
        setIsEditingBusiness(false);
        toast({
          title: "Success",
          description: "Business details updated successfully"
        });
        
        // Refresh merchant details to get updated data
        fetchMerchantDetail();
      } else {
        toast({
          title: "Error",
          description: response.data.message || "Failed to update business details",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Error updating business details: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    } finally {
      setSavingBusinessDetails(false);
    }
  };
  
  // Function to run MidDesk report
  const runMidDeskReport = async () => {
    try {
      setRunningMidDeskReport(true);
      
      const response = await axios.post(`/api/admin/merchant-reports/${merchantId}/run-middesk-report`);
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Additional MidDesk report requested successfully"
        });
        
        // Refresh merchant details to get updated data
        fetchMerchantDetail();
      } else {
        toast({
          title: "Error",
          description: response.data.message || "Failed to run MidDesk report",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Error running MidDesk report: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    } finally {
      setRunningMidDeskReport(false);
    }
  };
  
  // Function to sync Plaid status
  const syncPlaidStatus = async () => {
    if (!plaidMerchant || !plaidMerchant.originatorId) {
      setError("No Plaid originator ID available for this merchant");
      return;
    }

    try {
      setSyncingStatus(true);
      const response = await axios.post(`/api/plaid/sync-merchant-status/${merchantId}`);
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
  
  // Function to initiate business verification
  const initiateBusinessVerification = async () => {
    if (!businessDetails) {
      setError("No business details available for verification");
      return;
    }
    
    if (businessDetails.verificationStatus === 'verified') {
      setError("Business is already verified");
      return;
    }
    
    if (businessDetails.verificationStatus === 'pending') {
      setError("Business verification is already in progress");
      return;
    }
    
    try {
      setVerifyingBusiness(true);
      setError(null);
      
      const response = await axios.post(`/api/admin/merchants/${merchantId}/verify-business`, {
        businessId: businessDetails.id
      });
      
      if (response.data.success) {
        toast({
          title: "Verification initiated",
          description: "Business verification has been initiated successfully",
          variant: "default",
        });
        // Refresh merchant details
        fetchMerchantDetail();
      } else {
        setError("Failed to initiate business verification: " + response.data.message);
      }
    } catch (err) {
      setError("Error initiating business verification: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setVerifyingBusiness(false);
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
      
      {/* Plaid Credentials Section */}
      <div className="mt-6 mb-6">
        <div className="px-4 py-5 sm:px-6 border-t border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Plaid API Credentials</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Manage Plaid API credentials for this merchant</p>
        </div>
        <MerchantPlaidSettings merchantId={merchantId} />
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
              {businessDetails.businessType && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Business Type</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{businessDetails.businessType}</dd>
                </div>
              )}
              {businessDetails.industry && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Industry</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{businessDetails.industry}</dd>
                </div>
              )}
              {businessDetails.yearFounded && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Year Founded</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{businessDetails.yearFounded}</dd>
                </div>
              )}
              {businessDetails.annualRevenue && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Annual Revenue</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    ${businessDetails.annualRevenue.toLocaleString()}
                  </dd>
                </div>
              )}
              {businessDetails.websiteUrl && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Website</dt>
                  <dd className="mt-1 text-sm text-blue-600 sm:mt-0 sm:col-span-2">
                    <a href={businessDetails.websiteUrl.startsWith('http') ? businessDetails.websiteUrl : `https://${businessDetails.websiteUrl}`} 
                       target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {businessDetails.websiteUrl}
                    </a>
                  </dd>
                </div>
              )}
              {(businessDetails.addressLine1 || businessDetails.city || businessDetails.state) && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Business Address</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {businessDetails.addressLine1 && <div>{businessDetails.addressLine1}</div>}
                    {businessDetails.addressLine2 && <div>{businessDetails.addressLine2}</div>}
                    {(businessDetails.city || businessDetails.state || businessDetails.zipCode) && (
                      <div>
                        {businessDetails.city && `${businessDetails.city}`}
                        {businessDetails.city && businessDetails.state && ', '}
                        {businessDetails.state && `${businessDetails.state}`}
                        {(businessDetails.city || businessDetails.state) && businessDetails.zipCode && ' '}
                        {businessDetails.zipCode && businessDetails.zipCode}
                      </div>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>
          
          {/* KYC Verification Section */}
          <div className="px-4 py-5 sm:px-6 border-t border-gray-200 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Business Verification Status</h3>
            <div className="space-x-3">
              {(!businessDetails.verificationStatus || 
                businessDetails.verificationStatus === 'not_started' || 
                businessDetails.verificationStatus === 'failed') && (
                <button
                  onClick={initiateBusinessVerification}
                  disabled={verifyingBusiness}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {verifyingBusiness ? "Verifying..." : "Verify Business"}
                </button>
              )}
              
              {businessDetails.middeskBusinessId && businessDetails.verificationStatus === 'verified' && (
                <button
                  onClick={runMidDeskReport}
                  disabled={runningMidDeskReport}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {runningMidDeskReport ? "Requesting..." : "Run Additional Report"}
                </button>
              )}
              
              {businessDetails.legalName && businessDetails.ein && (
                <button
                  onClick={handleEditBusinessDetails}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Edit Business Details
                </button>
              )}
            </div>
          </div>
          
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Verification Status</dt>
                <dd className="mt-1 text-sm sm:mt-0 sm:col-span-2">
                  {businessDetails.verificationStatus ? (
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${businessDetails.verificationStatus === 'verified' ? 'bg-green-100 text-green-800' : 
                        businessDetails.verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                        businessDetails.verificationStatus === 'failed' ? 'bg-red-100 text-red-800' : 
                        'bg-gray-100 text-gray-800'}`}
                    >
                      {businessDetails.verificationStatus.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      NOT STARTED
                    </span>
                  )}
                </dd>
              </div>
              
              {businessDetails.middeskBusinessId && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">MidDesk Business ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {businessDetails.middeskBusinessId}
                  </dd>
                </div>
              )}
              
              {businessDetails.verificationData && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Verification Details</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <pre className="whitespace-pre-wrap bg-gray-50 p-2 rounded text-xs overflow-auto max-h-40">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(businessDetails.verificationData), null, 2);
                        } catch (error) {
                          return businessDetails.verificationData;
                        }
                      })()}
                    </pre>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </>
      )}
      
      {/* Business Verification Report */}
      {businessDetails && businessDetails.middeskBusinessId && (
        <div className="mt-8 mb-8">
          <div className="px-4 py-5 sm:px-6 border-t border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Business Verification Report</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Detailed business verification from MidDesk</p>
          </div>
          <MidDeskReport 
            merchantId={merchantId} 
            businessDetails={businessDetails}
            onRefresh={fetchMerchantDetail}
          />
        </div>
      )}
      
      {/* Plaid Asset Report */}
      {/* Financial Asset Reports Section */}
      <div className="mt-8 mb-8">
        <div className="px-4 py-5 sm:px-6 border-t border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Financial Asset Reports</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Plaid asset reports for this merchant</p>
        </div>
        <PlaidAssetReport merchantId={merchantId} />
      </div>

      {/* Due Diligence Report Section */}
      <div className="mt-8 mb-8">
        <DueDiligenceReport merchantId={merchantId} triggerRefresh={fetchMerchantDetail} />
      </div>
      
      {/* Business Details Edit Dialog */}
      {isEditingBusiness && editedBusinessDetails && (
        <Dialog open={isEditingBusiness} onOpenChange={(open) => !open && setIsEditingBusiness(false)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Business Details</DialogTitle>
              <DialogDescription>
                Make changes to the business information below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="legalName" className="text-right">Legal Name</Label>
                <Input
                  id="legalName"
                  value={editedBusinessDetails.legalName || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    legalName: e.target.value
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ein" className="text-right">EIN</Label>
                <Input
                  id="ein"
                  value={editedBusinessDetails.ein || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    ein: e.target.value
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="businessType" className="text-right">Business Type</Label>
                <Input
                  id="businessType"
                  value={editedBusinessDetails.businessType || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    businessType: e.target.value
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="industry" className="text-right">Industry</Label>
                <Input
                  id="industry"
                  value={editedBusinessDetails.industry || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    industry: e.target.value
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="yearFounded" className="text-right">Year Founded</Label>
                <Input
                  id="yearFounded"
                  type="number"
                  value={editedBusinessDetails.yearFounded || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    yearFounded: e.target.value ? parseInt(e.target.value) : null
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="annualRevenue" className="text-right">Annual Revenue</Label>
                <Input
                  id="annualRevenue"
                  type="number"
                  value={editedBusinessDetails.annualRevenue || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    annualRevenue: e.target.value ? parseFloat(e.target.value) : null
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="addressLine1" className="text-right">Address Line 1</Label>
                <Input
                  id="addressLine1"
                  value={editedBusinessDetails.addressLine1 || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    addressLine1: e.target.value
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="addressLine2" className="text-right">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  value={editedBusinessDetails.addressLine2 || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    addressLine2: e.target.value
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="city" className="text-right">City</Label>
                <Input
                  id="city"
                  value={editedBusinessDetails.city || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    city: e.target.value
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="state" className="text-right">State</Label>
                <Input
                  id="state"
                  value={editedBusinessDetails.state || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    state: e.target.value
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="zipCode" className="text-right">Zip Code</Label>
                <Input
                  id="zipCode"
                  value={editedBusinessDetails.zipCode || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    zipCode: e.target.value
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">Business Phone</Label>
                <Input
                  id="phone"
                  value={editedBusinessDetails.phone || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    phone: e.target.value
                  })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="websiteUrl" className="text-right">Website URL</Label>
                <Input
                  id="websiteUrl"
                  value={editedBusinessDetails.websiteUrl || ''}
                  onChange={(e) => setEditedBusinessDetails({
                    ...editedBusinessDetails,
                    websiteUrl: e.target.value
                  })}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditingBusiness(false)}>
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={saveBusinessDetails} 
                disabled={savingBusinessDetails}
              >
                {savingBusinessDetails ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default MerchantDetail;