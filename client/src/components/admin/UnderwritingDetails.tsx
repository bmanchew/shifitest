import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UnderwritingData } from "@shared/schema";

export default function UnderwritingDetails({ contractId }: { contractId: number }) {
  const { data, isLoading } = useQuery<UnderwritingData>({
    queryKey: ["underwriting", contractId],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/contract/${contractId}?role=admin`);
      if (!res.ok) throw new Error("Failed to fetch underwriting data");
      return res.json();
    },
  });

  if (isLoading) return <div>Loading underwriting data...</div>;
  if (!data) return <div>No underwriting data available</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Credit Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Credit Tier</dt>
              <dd className="font-medium">{data.creditTier}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Credit Score</dt>
              <dd className="font-medium">{data.creditScore}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">DTI Ratio</dt>
              <dd className="font-medium">{data.dtiRatio}%</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Annual Income</dt>
              <dd className="font-medium">${data.annualIncome?.toLocaleString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employment & Housing</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Employment History</dt>
              <dd className="font-medium">{data.employmentHistoryMonths} months</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Housing Status</dt>
              <dd className="font-medium capitalize">{data.housingStatus}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Housing Payment History</dt>
              <dd className="font-medium">{data.housingPaymentHistory} months</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Total Points</dt>
              <dd className="font-medium">{data.totalPoints}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Delinquency History</dt>
              <dd className="font-medium">{data.delinquencyHistory || 'None'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}