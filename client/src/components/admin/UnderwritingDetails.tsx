
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { Skeleton } from '../ui/skeleton';
import axios from 'axios';

interface UnderwritingDetailsProps {
  contractId: number;
}

const UnderwritingDetails: React.FC<UnderwritingDetailsProps> = ({ contractId }) => {
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
          <CardTitle>Underwriting Assessment</CardTitle>
          <CardDescription>Loading underwriting details...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !underwritingData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Underwriting Assessment</CardTitle>
          <CardDescription>Underwriting details not available</CardDescription>
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

  const getProgressColor = (points: number, max: number) => {
    const percentage = (points / max) * 100;
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-blue-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Underwriting Assessment</span>
          <Badge className={getTierBadgeColor(underwritingData.creditTier)}>
            {formatTierName(underwritingData.creditTier)}
          </Badge>
        </CardTitle>
        <CardDescription>
          Credit Score: {underwritingData.creditScore} | Total Points: {underwritingData.totalPoints}/30
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Overall Score</h3>
            <Progress 
              value={(underwritingData.totalPoints / 30) * 100} 
              className={getProgressColor(underwritingData.totalPoints, 30)}
            />
            <p className="text-sm text-gray-500 mt-1">
              {underwritingData.totalPoints} out of 30 possible points
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium">Annual Income</h4>
              <p className="text-lg">${underwritingData.annualIncome.toLocaleString()}</p>
              <div className="flex items-center mt-1">
                <Progress 
                  value={(underwritingData.annualIncomePoints / 5) * 100}
                  className={getProgressColor(underwritingData.annualIncomePoints, 5)}
                />
                <span className="ml-2 text-sm">{underwritingData.annualIncomePoints}/5</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium">Employment History</h4>
              <p className="text-lg">{underwritingData.employmentHistoryMonths} months</p>
              <div className="flex items-center mt-1">
                <Progress 
                  value={(underwritingData.employmentHistoryPoints / 5) * 100}
                  className={getProgressColor(underwritingData.employmentHistoryPoints, 5)}
                />
                <span className="ml-2 text-sm">{underwritingData.employmentHistoryPoints}/5</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium">Credit Score</h4>
              <p className="text-lg">{underwritingData.creditScore}</p>
              <div className="flex items-center mt-1">
                <Progress 
                  value={(underwritingData.creditScorePoints / 5) * 100}
                  className={getProgressColor(underwritingData.creditScorePoints, 5)}
                />
                <span className="ml-2 text-sm">{underwritingData.creditScorePoints}/5</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium">DTI Ratio</h4>
              <p className="text-lg">{(underwritingData.dtiRatio * 100).toFixed(1)}%</p>
              <div className="flex items-center mt-1">
                <Progress 
                  value={(underwritingData.dtiRatioPoints / 5) * 100}
                  className={getProgressColor(underwritingData.dtiRatioPoints, 5)}
                />
                <span className="ml-2 text-sm">{underwritingData.dtiRatioPoints}/5</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium">Housing Status</h4>
              <p className="text-lg capitalize">{underwritingData.housingStatus} ({underwritingData.housingPaymentHistory} months)</p>
              <div className="flex items-center mt-1">
                <Progress 
                  value={(underwritingData.housingStatusPoints / 5) * 100}
                  className={getProgressColor(underwritingData.housingStatusPoints, 5)}
                />
                <span className="ml-2 text-sm">{underwritingData.housingStatusPoints}/5</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium">Delinquency History</h4>
              <p className="text-lg">
                {underwritingData.delinquencyPoints === 5 ? 'None' : 'Present'}
              </p>
              <div className="flex items-center mt-1">
                <Progress 
                  value={(underwritingData.delinquencyPoints / 5) * 100}
                  className={getProgressColor(underwritingData.delinquencyPoints, 5)}
                />
                <span className="ml-2 text-sm">{underwritingData.delinquencyPoints}/5</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="text-sm text-gray-500">
            <p>Assessment completed on {new Date(underwritingData.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UnderwritingDetails;
