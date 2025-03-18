import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UnderwritingData } from "@shared/schema";

export default function MerchantUnderwritingView({ contractId }: { contractId: number }) {
  const { data, isLoading } = useQuery<UnderwritingData>({
    queryKey: ["underwriting", contractId],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/contract/${contractId}?role=merchant`);
      if (!res.ok) throw new Error("Failed to fetch underwriting data");
      return res.json();
    },
  });

  if (isLoading) return <div>Loading underwriting data...</div>;
  if (!data) return <div>No underwriting data available</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Status</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Credit Tier</dt>
            <dd className="font-medium">{data.creditTier}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Decision</dt>
            <dd className="font-medium capitalize">
              {data.creditTier === 'declined' ? 'Declined' : 'Approved'}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}