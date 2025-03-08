
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface MerchantUnderwritingViewProps {
  contractId: number;
}

const MerchantUnderwritingView: React.FC<MerchantUnderwritingViewProps> = ({ contractId }) => {
  const [loading, setLoading] = useState(true);
  const [underwritingData, setUnderwritingData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/underwriting/contract/${contractId}`);
        if (response.data.data && response.data.data.length > 0) {
          setUnderwritingData(response.data.data[0]);
        }
        setLoading(false);
      } catch (err) {
        setError('Error loading underwriting data');
        setLoading(false);
        console.error('Error fetching underwriting data:', err);
      }
    };

    if (contractId) {
      fetchData();
    }
  }, [contractId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Tier</CardTitle>
          <CardDescription>Loading credit tier information...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (error || !underwritingData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Tier</CardTitle>
          <CardDescription>Information not available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">
            {error || 'No underwriting data has been processed for this contract.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'tier1':
        return 'bg-green-100 text-green-800';
      case 'tier2':
        return 'bg-blue-100 text-blue-800';
      case 'tier3':
        return 'bg-yellow-100 text-yellow-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTierName = (tier: string) => {
    switch (tier) {
      case 'tier1':
        return 'Tier 1';
      case 'tier2':
        return 'Tier 2';
      case 'tier3':
        return 'Tier 3';
      case 'declined':
        return 'Declined';
      default:
        return tier;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Tier</CardTitle>
        <CardDescription>Customer's credit assessment result</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center">
          <Badge className={`text-lg py-2 px-3 ${getTierBadgeColor(underwritingData.creditTier)}`}>
            {formatTierName(underwritingData.creditTier)}
          </Badge>
          <p className="ml-4 text-sm text-gray-500">
            Assessment completed on {new Date(underwritingData.createdAt).toLocaleDateString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MerchantUnderwritingView;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface MerchantUnderwritingViewProps {
  contractId: number;
}

const MerchantUnderwritingView: React.FC<MerchantUnderwritingViewProps> = ({ contractId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [underwritingData, setUnderwritingData] = useState<any>(null);

  useEffect(() => {
    const fetchUnderwritingData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/underwriting/contract/${contractId}?role=merchant`);
        if (response.data.success && response.data.data.length > 0) {
          setUnderwritingData(response.data.data[0]);
        } else {
          setError('No underwriting data available');
        }
      } catch (err) {
        setError('Error loading underwriting data');
        console.error('Error fetching underwriting data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUnderwritingData();
  }, [contractId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>Loading underwriting information...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !underwritingData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Assessment</CardTitle>
          <CardDescription>Credit information not available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">
            {error || 'No credit assessment has been completed for this contract.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'tier1':
        return 'bg-green-100 text-green-800';
      case 'tier2':
        return 'bg-blue-100 text-blue-800';
      case 'tier3':
        return 'bg-yellow-100 text-yellow-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTierName = (tier: string) => {
    switch (tier) {
      case 'tier1':
        return 'Tier 1';
      case 'tier2':
        return 'Tier 2';
      case 'tier3':
        return 'Tier 3';
      case 'declined':
        return 'Declined';
      default:
        return tier;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Credit Assessment</span>
          <Badge className={getTierBadgeColor(underwritingData.creditTier)}>
            {formatTierName(underwritingData.creditTier)}
          </Badge>
        </CardTitle>
        <CardDescription>
          Application has been evaluated and approved for financing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          This contract has been approved for the {formatTierName(underwritingData.creditTier)} credit program.
          The assessment was completed on {new Date(underwritingData.createdAt).toLocaleDateString()}.
        </p>
      </CardContent>
    </Card>
  );
};

export default MerchantUnderwritingView;
