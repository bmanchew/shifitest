import AdminLayout from "@/components/layout/AdminLayout";
import BlockchainStatus from "@/components/admin/BlockchainStatus";
import TokenizedContractsList from "@/components/admin/TokenizedContractsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function Blockchain() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: secretsStatus } = useQuery<{ success: boolean; configured: boolean; missing: string[] }>({
    queryKey: ["/api/blockchain/secrets-status"],
    retry: 1,
  });

  const tokenizationMutation = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      try {
        const response = await apiRequest("/api/blockchain/tokenize-pending", "POST");
        return response;
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      toast({
        title: "Tokenization Process Started",
        description: "Pending contracts are now being tokenized.",
        variant: "default",
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/blockchain/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blockchain/contracts/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blockchain/contracts/processing"] });
    },
    onError: (error) => {
      toast({
        title: "Tokenization Error",
        description: error instanceof Error ? error.message : "Could not start tokenization process.",
        variant: "destructive",
      });
    },
  });

  const handleTokenizePending = () => {
    tokenizationMutation.mutate();
  };

  const missingSecrets = secretsStatus?.missing || [];
  const showMissingSecretsAlert = secretsStatus?.success && !secretsStatus.configured;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Blockchain Management</h1>
          
          <div className="space-x-2">
            {showMissingSecretsAlert && (
              <Badge variant="destructive" className="mr-2">
                Missing Configuration
              </Badge>
            )}
            <Button 
              onClick={handleTokenizePending} 
              disabled={isSubmitting || showMissingSecretsAlert}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Process Pending Tokenizations
            </Button>
          </div>
        </div>

        {showMissingSecretsAlert && (
          <Alert variant="destructive">
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Missing blockchain configuration secrets:</p>
                <ul className="list-disc pl-5">
                  {missingSecrets.map((secret) => (
                    <li key={secret}>{secret}</li>
                  ))}
                </ul>
                <p>Please add these environment variables to enable blockchain functionality.</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <BlockchainStatus />

        <Card>
          <CardHeader>
            <CardTitle>Smart Contract Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Smart contract templates define the behavior and parameters for tokenized contracts.
            </p>
            <Button variant="outline">View Templates</Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="tokenized">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="tokenized">Tokenized</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>
          <TabsContent value="tokenized" className="mt-4">
            <TokenizedContractsList status="tokenized" />
          </TabsContent>
          <TabsContent value="pending" className="mt-4">
            <TokenizedContractsList status="pending" />
          </TabsContent>
          <TabsContent value="processing" className="mt-4">
            <TokenizedContractsList status="processing" />
          </TabsContent>
          <TabsContent value="failed" className="mt-4">
            <TokenizedContractsList status="failed" />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}