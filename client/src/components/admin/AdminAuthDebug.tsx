import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Debug panel for admin authentication issues
 * This component provides information about the current authentication state
 * and the ability to perform authentication-related actions for debugging.
 */
const AdminAuthDebug: React.FC = () => {
  const { user, login, logout, isLoading } = useAuth();
  // Derive isAuthenticated from user
  const isAuthenticated = !!user;
  const [tokenStatus, setTokenStatus] = useState<any>(null);
  const [tokenStatusLoading, setTokenStatusLoading] = useState(false);
  const [merchantsLoading, setMerchantsLoading] = useState(false);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [merchantError, setMerchantError] = useState<string | null>(null);

  // Fetch token status from the debug endpoint
  const checkTokenStatus = async () => {
    setTokenStatusLoading(true);
    try {
      // Pass method, url and optional parameters
      const response = await apiRequest<any>(
        "GET", 
        '/api/debug/token-status', 
        undefined, 
        undefined
      );
      setTokenStatus(response);
    } catch (error) {
      console.error('Error checking token status:', error);
      setTokenStatus({ 
        success: false, 
        message: error instanceof Error ? error.message : String(error),
        error: true 
      });
    } finally {
      setTokenStatusLoading(false);
    }
  };

  // Attempt to fetch merchants
  const fetchMerchants = async () => {
    setMerchantsLoading(true);
    setMerchantError(null);
    try {
      // Define response type and pass all required parameters
      interface MerchantsResponse {
        merchants: any[];
      }
      
      const response = await apiRequest<MerchantsResponse>(
        "GET", 
        '/api/admin/merchants',
        undefined,
        undefined
      );
      
      if (response && response.merchants) {
        setMerchants(response.merchants);
      } else {
        setMerchants([]);
        setMerchantError('No merchants returned in response');
      }
    } catch (error) {
      console.error('Error fetching merchants:', error);
      setMerchantError(error instanceof Error ? error.message : String(error));
      setMerchants([]);
    } finally {
      setMerchantsLoading(false);
    }
  };

  // Check token status on component mount
  useEffect(() => {
    checkTokenStatus();
  }, []);

  // Format date from timestamp
  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Authentication Debug Panel</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-2">Authentication State</h2>
          <div className="mb-4">
            <p><strong>Is Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
            <p><strong>Is Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
            <p><strong>User ID:</strong> {user?.id || 'Not signed in'}</p>
            <p><strong>User Email:</strong> {user?.email || 'Not signed in'}</p>
            <p><strong>User Role:</strong> {user?.role || 'Not signed in'}</p>
          </div>
          <div className="flex space-x-2">
            <Button onClick={() => logout()} variant="destructive" disabled={!isAuthenticated}>
              Log Out
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-2">JWT Token Status</h2>
          <div className="mb-4">
            {tokenStatusLoading ? (
              <p>Loading token status...</p>
            ) : tokenStatus ? (
              <div>
                <p><strong>Status:</strong> {tokenStatus.success ? 'Valid' : 'Invalid'}</p>
                <p><strong>Message:</strong> {tokenStatus.message}</p>
                {tokenStatus.details && (
                  <>
                    <p><strong>Token Found:</strong> {tokenStatus.details.tokenFound ? 'Yes' : 'No'}</p>
                    {tokenStatus.details.tokenFound && (
                      <>
                        <p><strong>Token Valid:</strong> {tokenStatus.details.tokenValid ? 'Yes' : 'No'}</p>
                        {tokenStatus.details.decoded && (
                          <>
                            <p><strong>User ID:</strong> {tokenStatus.details.decoded.userId}</p>
                            <p><strong>Role:</strong> {tokenStatus.details.decoded.role}</p>
                            <p><strong>Issue Time:</strong> {formatDate(tokenStatus.details.decoded.iat)}</p>
                            <p><strong>Expiration:</strong> {formatDate(tokenStatus.details.decoded.exp)}</p>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p>No token status data available</p>
            )}
          </div>
          <Button onClick={checkTokenStatus} disabled={tokenStatusLoading}>
            Refresh Token Status
          </Button>
        </Card>
      </div>
      
      <Card className="p-4 mb-8">
        <h2 className="text-xl font-semibold mb-2">Merchant Data Test</h2>
        <div className="mb-4">
          {merchantsLoading ? (
            <p>Loading merchants...</p>
          ) : merchantError ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p><strong>Error:</strong> {merchantError}</p>
            </div>
          ) : merchants.length > 0 ? (
            <div>
              <p><strong>Merchants Found:</strong> {merchants.length}</p>
              <ul className="list-disc pl-5 mt-2">
                {merchants.slice(0, 5).map((merchant: any) => (
                  <li key={merchant.id}>
                    {merchant.name} ({merchant.email})
                  </li>
                ))}
                {merchants.length > 5 && <li>... and {merchants.length - 5} more</li>}
              </ul>
            </div>
          ) : (
            <p>No merchants found</p>
          )}
        </div>
        <Button onClick={fetchMerchants} disabled={merchantsLoading}>
          Test Fetch Merchants
        </Button>
      </Card>
    </div>
  );
};

export default AdminAuthDebug;