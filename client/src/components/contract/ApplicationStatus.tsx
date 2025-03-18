import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface StatusStep {
  id: string;
  name: string;
  status: 'completed' | 'pending' | 'failed';
  completedAt?: string;
}

interface ApplicationStatusProps {
  contractId: number;
}

const ApplicationStatus: React.FC<ApplicationStatusProps> = ({ contractId }) => {
  const [steps, setSteps] = useState<StatusStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchApplicationStatus = async () => {
      try {
        const response = await axios.get(`/api/contracts/${contractId}/status`);
        setSteps(response.data.steps || []);
        setLoading(false);
      } catch (err) {
        setError('Error loading application status');
        setLoading(false);
        console.error('Error fetching application status:', err);
      }
    };
    
    fetchApplicationStatus();
  }, [contractId]);
  
  if (loading) {
    return <div className="p-4">Loading application status...</div>;
  }
  
  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }
  
  // If no steps fetched, use default steps for demo
  const displaySteps = steps.length > 0 ? steps : [
    { id: '1', name: 'Application Submitted', status: 'completed', completedAt: new Date().toISOString() },
    { id: '2', name: 'Identity Verification', status: 'completed', completedAt: new Date().toISOString() },
    { id: '3', name: 'Underwriting Review', status: 'pending' },
    { id: '4', name: 'Contract Signing', status: 'pending' },
    { id: '5', name: 'Bank Account Verification', status: 'pending' },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displaySteps.map((step) => (
            <div key={step.id} className="flex items-start">
              <div className="mr-3 mt-0.5">
                {step.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                {step.status === 'pending' && <Clock className="h-5 w-5 text-yellow-500" />}
                {step.status === 'failed' && <AlertCircle className="h-5 w-5 text-red-500" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">{step.name}</h3>
                  <Badge 
                    variant={
                      step.status === 'completed' ? 'default' : 
                      step.status === 'pending' ? 'outline' : 'destructive'
                    }
                  >
                    {step.status}
                  </Badge>
                </div>
                {step.completedAt && (
                  <p className="text-sm text-gray-500">
                    Completed: {new Date(step.completedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ApplicationStatus;