import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';

interface UnderwritingViewFactoryProps {
  userRole: string;
  contractId: number;
}

const UnderwritingViewFactory: React.FC<UnderwritingViewFactoryProps> = ({ userRole, contractId }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/underwriting', contractId],
    enabled: !!contractId
  });
  
  if (isLoading) {
    return <div className="p-4">Loading underwriting data...</div>;
  }
  
  if (error) {
    return <div className="p-4 text-red-500">Error loading underwriting data</div>;
  }
  
  // Different views based on user role
  switch(userRole) {
    case 'admin':
      return <AdminUnderwritingView data={data} contractId={contractId} />;
    case 'merchant':
      return <MerchantUnderwritingView data={data} contractId={contractId} />;
    default:
      return <CustomerUnderwritingView data={data} contractId={contractId} />;
  }
};

// Admin can see all underwriting data and take actions
const AdminUnderwritingView: React.FC<{ data: any, contractId: number }> = ({ data, contractId }) => {
  // Demo data if no data is available
  const underwritingData = data || {
    creditScore: 720,
    incomeVerification: {
      status: 'verified',
      monthlyIncome: 5000,
      employmentStatus: 'full_time',
    },
    riskAssessment: {
      overallRisk: 'low',
      factors: [
        { name: 'Credit History', rating: 'good' },
        { name: 'Debt-to-Income Ratio', rating: 'excellent' },
        { name: 'Employment Stability', rating: 'good' }
      ]
    },
    decisionStatus: 'pending'
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Underwriting Information (Admin View)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Credit Information</h3>
            <p>Credit Score: {underwritingData.creditScore}</p>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="font-semibold mb-2">Income Verification</h3>
            <p>Status: <span className="capitalize">{underwritingData.incomeVerification.status}</span></p>
            <p>Monthly Income: ${underwritingData.incomeVerification.monthlyIncome}</p>
            <p>Employment: <span className="capitalize">{underwritingData.incomeVerification.employmentStatus.replace('_', ' ')}</span></p>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="font-semibold mb-2">Risk Assessment</h3>
            <p>Overall Risk: <span className="capitalize">{underwritingData.riskAssessment.overallRisk}</span></p>
            <ul className="list-disc pl-5 mt-2">
              {underwritingData.riskAssessment.factors.map((factor: any, idx: number) => (
                <li key={idx}>
                  {factor.name}: <span className="capitalize">{factor.rating}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <Separator />
          
          <div className="pt-2">
            <h3 className="font-semibold mb-2">Decision</h3>
            <p className="mb-4">Current Status: <span className="capitalize">{underwritingData.decisionStatus}</span></p>
            
            <div className="flex space-x-2">
              <Button variant="default">Approve</Button>
              <Button variant="destructive">Decline</Button>
              <Button variant="outline">Request More Information</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Merchant sees limited underwriting info
const MerchantUnderwritingView: React.FC<{ data: any, contractId: number }> = ({ data, contractId }) => {
  const underwritingData = data || { 
    decisionStatus: 'pending',
    estimatedDecisionDate: new Date(Date.now() + 86400000).toISOString()
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Status</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Decision Status: <span className="capitalize font-medium">{underwritingData.decisionStatus}</span></p>
        {underwritingData.estimatedDecisionDate && (
          <p className="mt-2">
            Estimated Decision: {new Date(underwritingData.estimatedDecisionDate).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// Customer sees very limited info
const CustomerUnderwritingView: React.FC<{ data: any, contractId: number }> = ({ data, contractId }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Your application is being reviewed by our team. We'll notify you once a decision has been made.</p>
        <p className="mt-2 text-sm text-gray-500">This typically takes 1-2 business days.</p>
      </CardContent>
    </Card>
  );
};

export default UnderwritingViewFactory;