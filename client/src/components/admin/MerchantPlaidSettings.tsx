import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle } from "lucide-react";
import { PlaidMerchant } from "@shared/schema";

interface MerchantPlaidSettingsProps {
  merchantId: number;
}

export default function MerchantPlaidSettings({ merchantId }: MerchantPlaidSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    clientId: "",
    defaultFundingAccount: "",
  });

  // Get Plaid settings for the merchant
  const { 
    data: plaidSettings, 
    isLoading: isLoadingSettings,
    error 
  } = useQuery<PlaidMerchant>({
    queryKey: [`/api/merchants/${merchantId}/plaid-settings`],
    enabled: !!merchantId,
  });

  // Update form data when settings are loaded
  useEffect(() => {
    if (plaidSettings) {
      setFormData({
        clientId: plaidSettings.clientId || "",
        defaultFundingAccount: plaidSettings.defaultFundingAccount || "",
      });
    }
  }, [plaidSettings]);

  // Update Plaid settings mutation
  const updatePlaidSettingsMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest(`/api/merchants/${merchantId}/plaid-settings`, {
        method: "PATCH",
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Settings updated",
        description: "Merchant Plaid settings have been updated successfully.",
      });
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: [`/api/merchants/${merchantId}/plaid-settings`] });
    },
    onError: (error) => {
      console.error("Error updating Plaid settings:", error);
      toast({
        title: "Update failed",
        description: "Failed to update merchant Plaid settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Sync Plaid merchant mutation
  const syncPlaidMerchantMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/merchants/${merchantId}/plaid-sync`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Plaid sync complete",
        description: "Merchant has been synchronized with Plaid.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/merchants/${merchantId}/plaid-settings`] });
    },
    onError: (error) => {
      console.error("Error syncing with Plaid:", error);
      toast({
        title: "Sync failed",
        description: "Failed to synchronize merchant with Plaid. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePlaidSettingsMutation.mutate(formData);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoadingSettings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plaid Integration Settings</CardTitle>
          <CardDescription>Loading Plaid configuration for this merchant...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plaid Integration Settings</CardTitle>
          <CardDescription>Error loading Plaid settings</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">
            Failed to load Plaid settings for this merchant. Please try again.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/merchants/${merchantId}/plaid-settings`] })}>
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Plaid Integration Settings</CardTitle>
            <CardDescription>
              Configure Plaid settings for this merchant to enable payment processing
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncPlaidMerchantMutation.mutate()}
            disabled={syncPlaidMerchantMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncPlaidMerchantMutation.isPending ? 'animate-spin' : ''}`} />
            Sync with Plaid
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {plaidSettings ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm font-medium mb-1">Onboarding Status</p>
                <Badge className={getStatusBadgeColor(plaidSettings.onboardingStatus)}>
                  {plaidSettings.onboardingStatus.toUpperCase()}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Originator ID</p>
                <p className="text-sm">
                  {plaidSettings.originatorId || "Not assigned yet"}
                </p>
              </div>
            </div>

            {isEditMode ? (
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Plaid Client ID</Label>
                    <Input
                      id="clientId"
                      name="clientId"
                      value={formData.clientId}
                      onChange={handleChange}
                      placeholder="Enter Plaid Client ID"
                    />
                    <p className="text-xs text-gray-500">
                      The client ID provided by Plaid specifically for this merchant
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defaultFundingAccount">Default Funding Account</Label>
                    <Input
                      id="defaultFundingAccount"
                      name="defaultFundingAccount"
                      value={formData.defaultFundingAccount}
                      onChange={handleChange}
                      placeholder="Enter default funding account ID"
                    />
                    <p className="text-xs text-gray-500">
                      The default account ID to use for funding transfers
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditMode(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updatePlaidSettingsMutation.isPending}
                    >
                      {updatePlaidSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                    <div className="col-span-1">
                      <p className="text-sm font-medium">Plaid Client ID:</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm">
                        {plaidSettings.clientId || "Not configured"}
                      </p>
                    </div>

                    <div className="col-span-1">
                      <p className="text-sm font-medium">Default Funding Account:</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm">
                        {plaidSettings.defaultFundingAccount || "Not configured"}
                      </p>
                    </div>

                    <div className="col-span-1">
                      <p className="text-sm font-medium">Access Token:</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm">
                        {plaidSettings.accessToken ? "••••••••••••••••" : "Not configured"}
                      </p>
                    </div>

                    <div className="col-span-1">
                      <p className="text-sm font-medium">Account ID:</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm">
                        {plaidSettings.accountId || "Not configured"}
                      </p>
                    </div>

                    <div className="col-span-1">
                      <p className="text-sm font-medium">Questionnaire ID:</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm">
                        {plaidSettings.questionnaireId || "Not configured"}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={() => setIsEditMode(true)}
                    >
                      Edit Settings
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="py-4 text-center">
            <p className="text-gray-500 mb-4">No Plaid integration configured for this merchant yet.</p>
            <Button onClick={() => setIsEditMode(true)}>
              Configure Plaid Integration
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}