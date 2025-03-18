
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import ApplicationStatus from './ApplicationStatus';
import UnderwritingViewFactory from '../underwriting/UnderwritingViewFactory';

interface ContractDetailsProps {
  contractId?: string;
}

const ContractDetails: React.FC<ContractDetailsProps> = ({ contractId }) => {
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchContractDetails = async () => {
      try {
        const response = await axios.get(`/api/contracts/${contractId}`);
        setContract(response.data.contract);
        setLoading(false);
      } catch (err) {
        setError('Error loading contract details');
        setLoading(false);
        console.error('Error fetching contract details:', err);
      }
    };

    if (contractId) {
      fetchContractDetails();
    }
  }, [contractId]);

  if (loading) {
    return <div className="p-4">Loading contract details...</div>;
  }

  if (error || !contract) {
    return <div className="p-4 text-red-500">{error || 'Contract not found'}</div>;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Contract #{contract.contractNumber}</h1>
        <div className="flex space-x-2">
          <Button variant="outline">Export</Button>
          {user?.role === 'admin' && (
            <Button variant="destructive">Cancel Contract</Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contract Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="font-medium">${contract.amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium capitalize">{contract.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Down Payment</p>
              <p className="font-medium">${contract.downPayment.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Financed Amount</p>
              <p className="font-medium">${contract.financedAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Term</p>
              <p className="font-medium">{contract.termMonths} months</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Monthly Payment</p>
              <p className="font-medium">${contract.monthlyPayment.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Interest Rate</p>
              <p className="font-medium">{contract.interestRate}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="font-medium">{new Date(contract.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ApplicationStatus contractId={parseInt(contractId as string)} />

      {/* Use the factory to display appropriate underwriting view based on user role */}
      <UnderwritingViewFactory 
        userRole={user?.role || 'customer'} 
        contractId={parseInt(contractId as string)} 
      />
    </div>
  );
};

export default ContractDetails;


        {/* Underwriting Information Section */}
        {contract && user && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Underwriting Information</h3>
            <UnderwritingViewFactory 
              userRole={user.role} 
              contractId={contract.id} 
            />
          </div>
        )}
