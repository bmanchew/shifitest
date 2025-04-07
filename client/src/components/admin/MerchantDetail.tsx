import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';

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
}

export function MerchantDetail({ merchantId }: MerchantDetailProps) {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [plaidMerchant, setPlaidMerchant] = useState<PlaidMerchant | null>(null);
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingStatus, setSyncingStatus] = useState<boolean>(false);

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
            </dl>
          </div>
        </>
      )}
    </div>
  );
}

export default MerchantDetail;