import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Merchant } from "@shared/schema";
import MerchantPlaidSettings from "./MerchantPlaidSettings";

export default function MerchantDetail() {
  const [, params] = useParams();
  const merchantId = parseInt(params.id);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: merchant, isLoading } = useQuery<Merchant>({
    queryKey: [`/api/merchants/${merchantId}`],
    enabled: !!merchantId && !isNaN(merchantId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="py-4">
        <div className="mb-4">
          <Link href="/admin/merchants">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Merchants
            </Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Merchant Not Found</CardTitle>
            <CardDescription>
              The merchant you're looking for doesn't exist or you don't have permission to view it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Please verify the merchant ID or contact your administrator for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="mb-6">
        <Link href="/admin/merchants">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Merchants
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">{merchant.name}</h1>
        <p className="text-gray-500">{merchant.email}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plaid">Plaid Integration</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Merchant Details</CardTitle>
              <CardDescription>
                Complete information about this merchant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Contact Person</p>
                  <p>{merchant.contactName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p>{merchant.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p>{merchant.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Address</p>
                  <p>{merchant.address || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Account Status</p>
                  <p>{merchant.active ? "Active" : "Inactive"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p>{new Date(merchant.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plaid">
          <MerchantPlaidSettings merchantId={merchant.id} />
        </TabsContent>

        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <CardTitle>Contracts</CardTitle>
              <CardDescription>
                View all contracts associated with this merchant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Contract list will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Merchant verification and business documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Document list will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}