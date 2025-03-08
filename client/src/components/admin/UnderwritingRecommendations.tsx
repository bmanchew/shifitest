
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

export default function UnderwritingRecommendations() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/admin/reports/underwriting-recommendations"],
    queryFn: async () => {
      const response = await fetch("/api/admin/reports/underwriting-recommendations");
      if (!response.ok) {
        throw new Error("Failed to fetch underwriting recommendations");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Underwriting Recommendations</CardTitle>
          <CardDescription>Loading recommendations...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Underwriting Recommendations</CardTitle>
          <CardDescription>Error loading recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-destructive">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>Failed to load AI recommendations. Please try again later.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const recommendations = data?.data;
  if (!recommendations) return null;

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>AI Underwriting Recommendations</CardTitle>
        <CardDescription>AI-driven suggestions to optimize your underwriting model</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3">Credit Score Thresholds</h3>
            <div className="bg-muted/50 p-4 rounded-lg mb-2">
              <div className="flex justify-between mb-2">
                <span className="font-medium">Current:</span>
                <div className="space-x-2">
                  <Badge variant="outline">Tier 1: {recommendations.creditScoreThresholds.current.tier1}+</Badge>
                  <Badge variant="outline">Tier 2: {recommendations.creditScoreThresholds.current.tier2}+</Badge>
                  <Badge variant="outline">Tier 3: {recommendations.creditScoreThresholds.current.tier3}+</Badge>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Recommended:</span>
                <div className="space-x-2">
                  <Badge 
                    variant={recommendations.creditScoreThresholds.current.tier1 !== recommendations.creditScoreThresholds.recommended.tier1 ? "default" : "outline"}
                  >
                    Tier 1: {recommendations.creditScoreThresholds.recommended.tier1}+
                  </Badge>
                  <Badge 
                    variant={recommendations.creditScoreThresholds.current.tier2 !== recommendations.creditScoreThresholds.recommended.tier2 ? "default" : "outline"}
                  >
                    Tier 2: {recommendations.creditScoreThresholds.recommended.tier2}+
                  </Badge>
                  <Badge 
                    variant={recommendations.creditScoreThresholds.current.tier3 !== recommendations.creditScoreThresholds.recommended.tier3 ? "default" : "outline"}
                  >
                    Tier 3: {recommendations.creditScoreThresholds.recommended.tier3}+
                  </Badge>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{recommendations.creditScoreThresholds.explanation}</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3">DTI Ratio Thresholds</h3>
            <div className="bg-muted/50 p-4 rounded-lg mb-2">
              <div className="flex justify-between mb-2">
                <span className="font-medium">Current:</span>
                <div className="space-x-2">
                  <Badge variant="outline">Tier 1: {recommendations.dtiRatioThresholds.current.tier1 * 100}%</Badge>
                  <Badge variant="outline">Tier 2: {recommendations.dtiRatioThresholds.current.tier2 * 100}%</Badge>
                  <Badge variant="outline">Tier 3: {recommendations.dtiRatioThresholds.current.tier3 * 100}%</Badge>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Recommended:</span>
                <div className="space-x-2">
                  <Badge 
                    variant={recommendations.dtiRatioThresholds.current.tier1 !== recommendations.dtiRatioThresholds.recommended.tier1 ? "default" : "outline"}
                  >
                    Tier 1: {recommendations.dtiRatioThresholds.recommended.tier1 * 100}%
                  </Badge>
                  <Badge 
                    variant={recommendations.dtiRatioThresholds.current.tier2 !== recommendations.dtiRatioThresholds.recommended.tier2 ? "default" : "outline"}
                  >
                    Tier 2: {recommendations.dtiRatioThresholds.recommended.tier2 * 100}%
                  </Badge>
                  <Badge 
                    variant={recommendations.dtiRatioThresholds.current.tier3 !== recommendations.dtiRatioThresholds.recommended.tier3 ? "default" : "outline"}
                  >
                    Tier 3: {recommendations.dtiRatioThresholds.recommended.tier3 * 100}%
                  </Badge>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{recommendations.dtiRatioThresholds.explanation}</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3">Employment History Requirements</h3>
            <div className="bg-muted/50 p-4 rounded-lg mb-2">
              <div className="flex justify-between mb-2">
                <span className="font-medium">Current:</span>
                <div className="space-x-2">
                  <Badge variant="outline">Tier 1: {recommendations.employmentHistory.current.tier1} months</Badge>
                  <Badge variant="outline">Tier 2: {recommendations.employmentHistory.current.tier2} months</Badge>
                  <Badge variant="outline">Tier 3: {recommendations.employmentHistory.current.tier3} months</Badge>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Recommended:</span>
                <div className="space-x-2">
                  <Badge 
                    variant={recommendations.employmentHistory.current.tier1 !== recommendations.employmentHistory.recommended.tier1 ? "default" : "outline"}
                  >
                    Tier 1: {recommendations.employmentHistory.recommended.tier1} months
                  </Badge>
                  <Badge 
                    variant={recommendations.employmentHistory.current.tier2 !== recommendations.employmentHistory.recommended.tier2 ? "default" : "outline"}
                  >
                    Tier 2: {recommendations.employmentHistory.recommended.tier2} months
                  </Badge>
                  <Badge 
                    variant={recommendations.employmentHistory.current.tier3 !== recommendations.employmentHistory.recommended.tier3 ? "default" : "outline"}
                  >
                    Tier 3: {recommendations.employmentHistory.recommended.tier3} months
                  </Badge>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{recommendations.employmentHistory.explanation}</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3">Suggested Additional Factors</h3>
            <div className="space-y-3">
              {recommendations.additionalFactors.map((factor, index) => (
                <div key={index} className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-medium">{factor.factor}</h4>
                    <Badge>{factor.implementationDifficulty}</Badge>
                  </div>
                  <p className="text-sm">{factor.recommendation}</p>
                </div>
              ))}
            </div>
          </section>
          
          <section>
            <h3 className="text-lg font-semibold mb-3">Emerging Risks</h3>
            <div className="space-y-3">
              {recommendations.emergingRisks.map((risk, index) => (
                <div key={index} className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium text-amber-600 mb-1">{risk.risk}</h4>
                  <p className="text-sm mb-2">{risk.description}</p>
                  <div className="flex items-center">
                    <span className="text-xs font-medium mr-2">Suggested Mitigation:</span>
                    <span className="text-xs">{risk.mitigation}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
