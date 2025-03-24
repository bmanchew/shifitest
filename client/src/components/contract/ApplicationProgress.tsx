import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

interface ApplicationProgressProps {
  contractId: number;
}

interface ProgressStep {
  id: number;
  contractId: number;
  step: string;
  completed: boolean;
  data: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export function ApplicationProgress({ contractId }: ApplicationProgressProps) {
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplicationProgress = async () => {
      try {
        const response = await fetch(`/api/application-progress?contractId=${contractId}`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch application progress');
        }
        
        const data = await response.json();
        setProgressSteps(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching application progress:', err);
        setError('Error loading application progress');
        setLoading(false);
      }
    };

    fetchApplicationProgress();
  }, [contractId]);

  // Function to format step name for display
  const formatStepName = (step: string) => {
    switch (step) {
      case 'terms':
        return 'Terms Acceptance';
      case 'kyc':
        return 'Identity Verification';
      case 'bank':
        return 'Bank Account Setup';
      case 'bank_pending':
        return 'Bank Account Pending';
      case 'payment':
        return 'Payment Processing';
      case 'signing':
        return 'Contract Signing';
      case 'completed':
        return 'Application Completed';
      default:
        return step.charAt(0).toUpperCase() + step.slice(1);
    }
  };

  // Calculate the overall progress
  const calculateProgress = () => {
    if (progressSteps.length === 0) return 0;
    const completedSteps = progressSteps.filter(step => step.completed).length;
    return Math.round((completedSteps / progressSteps.length) * 100);
  };

  // Order steps in logical application flow
  const orderedSteps = [
    'terms',
    'kyc',
    'bank',
    'bank_pending',
    'payment',
    'signing',
    'completed'
  ];

  // Sort the steps based on the ordered list
  const sortedSteps = [...progressSteps].sort((a, b) => {
    return orderedSteps.indexOf(a.step) - orderedSteps.indexOf(b.step);
  });

  if (loading) {
    return <div className="py-4">Loading application progress...</div>;
  }

  if (error) {
    return (
      <div className="py-4 text-red-500">
        <AlertCircle className="inline-block mr-2" size={20} />
        {error}
      </div>
    );
  }

  if (progressSteps.length === 0) {
    return <div className="py-4">No application progress information available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Application Progress</span>
          <span className="text-sm text-gray-500">{calculateProgress()}% Complete</span>
        </div>
        <Progress value={calculateProgress()} className="h-2" />
      </div>

      <div className="space-y-4">
        {sortedSteps.map((step) => (
          <div 
            key={step.id} 
            className={`flex items-start p-4 border rounded-lg ${
              step.completed ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="mr-4 mt-0.5">
              {step.completed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Clock className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex justify-between">
                <h3 className="text-sm font-medium text-gray-900">{formatStepName(step.step)}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  step.completed 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {step.completed ? 'Completed' : 'Pending'}
                </span>
              </div>
              {step.data && step.completed && (
                <div className="mt-1 text-sm text-gray-500">
                  {step.step === 'signing' && JSON.parse(step.data).documentUrl && (
                    <p>
                      Contract signed and document available
                    </p>
                  )}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {step.completed 
                  ? `Completed on ${new Date(step.updatedAt || '').toLocaleDateString()}`
                  : 'Awaiting completion'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}