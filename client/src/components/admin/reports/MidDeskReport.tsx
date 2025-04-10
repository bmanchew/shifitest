import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface MidDeskReportProps {
  merchantId: number;
  midDeskBusinessId: string;
  businessId?: number;
  onRefresh?: () => void;
}

interface VerificationDetails {
  businessId: string;
  businessName: string;
  status: string;
  verificationStatus: string;
  lastUpdated: string;
  isVerified: boolean;
  details?: any;
}

const MidDeskReport: React.FC<MidDeskReportProps> = ({ merchantId, midDeskBusinessId, businessId, onRefresh }) => {
  const [verificationDetails, setVerificationDetails] = useState<VerificationDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initiatingVerification, setInitiatingVerification] = useState<boolean>(false);

  const fetchVerificationDetails = async () => {
    // Skip if no MidDesk business ID available
    if (!midDeskBusinessId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/admin/merchant-reports/${merchantId}/business-verification`);
      
      if (response.data.success) {
        setVerificationDetails(response.data);
      } else {
        setError(response.data.message || "Failed to fetch verification details");
      }
    } catch (err) {
      setError("Error fetching verification details: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const initiateVerification = async () => {
    try {
      setInitiatingVerification(true);
      setError(null);
      const response = await axios.post(`/api/admin/merchant-reports/${merchantId}/verify-business`);
      
      if (response.data.success) {
        // Refresh merchant details to get updated middeskBusinessId
        if (onRefresh) {
          onRefresh();
        }
        // Then fetch verification details
        fetchVerificationDetails();
      } else {
        setError("Failed to initiate verification: " + response.data.message);
      }
    } catch (err) {
      setError("Error initiating verification: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setInitiatingVerification(false);
    }
  };

  // Initialize component
  useEffect(() => {
    if (midDeskBusinessId) {
      fetchVerificationDetails();
    }
  }, [merchantId, midDeskBusinessId]);

  // Get status icon based on verification status
  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'verified':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  // Get status color based on verification status
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Format the object data for display
  const formatData = (data: any, indent = 0): JSX.Element => {
    if (data === null || data === undefined) {
      return <span className="text-gray-500 italic">null</span>;
    }

    if (typeof data === 'object' && !Array.isArray(data)) {
      return (
        <div className="pl-4">
          {Object.entries(data).map(([key, value], index) => (
            <div key={index}>
              <span className="font-medium">{key}:</span> {formatData(value, indent + 1)}
            </div>
          ))}
        </div>
      );
    }

    if (Array.isArray(data)) {
      return (
        <div className="pl-4">
          {data.map((item, index) => (
            <div key={index}>
              <span className="font-medium">[{index}]:</span> {formatData(item, indent + 1)}
            </div>
          ))}
        </div>
      );
    }

    // Handle primitive values
    if (typeof data === 'string' && (data.startsWith('http://') || data.startsWith('https://'))) {
      return <a href={data} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{data}</a>;
    }

    // Date-like strings
    if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data)) {
      try {
        return <span>{format(new Date(data), "PPpp")}</span>;
      } catch (e) {
        return <span>{data}</span>;
      }
    }

    return <span>{String(data)}</span>;
  };

  // If verification hasn't been initiated yet
  if (!midDeskBusinessId && !initiatingVerification) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Business Verification</CardTitle>
          <CardDescription>MidDesk business verification status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="mb-4">Business verification has not been initiated yet.</p>
            {error && <p className="text-red-500 mt-2">{error}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={initiateVerification}
            disabled={initiatingVerification}
          >
            {initiatingVerification ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Initiating Verification...
              </>
            ) : (
              "Initiate Business Verification"
            )}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Business Verification</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchVerificationDetails}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>MidDesk business verification status</CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[300px]" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center">{error}</div>
        ) : verificationDetails ? (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h4 className="text-sm font-medium mb-1">Business ID</h4>
                <p className="text-sm text-muted-foreground font-mono">{verificationDetails.businessId}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Status</h4>
                <div className="flex items-center">
                  {getStatusIcon(verificationDetails.verificationStatus)}
                  <Badge className={`ml-2 ${getStatusColor(verificationDetails.verificationStatus)}`}>
                    {verificationDetails.verificationStatus.toUpperCase().replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Business Name</h4>
                <p className="text-sm text-muted-foreground">{verificationDetails.businessName}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Last Updated</h4>
                <p className="text-sm text-muted-foreground">
                  {verificationDetails.lastUpdated ? format(new Date(verificationDetails.lastUpdated), "PPpp") : "N/A"}
                </p>
              </div>
            </div>

            {verificationDetails.details && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="details">
                  <AccordionTrigger>Detailed Verification Data</AccordionTrigger>
                  <AccordionContent>
                    <div className="bg-gray-50 p-4 rounded-md text-sm overflow-x-auto max-h-[400px] overflow-y-auto">
                      {formatData(verificationDetails.details)}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <p>Business ID: {midDeskBusinessId}</p>
            <p className="mt-2">Verification details not available.</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t">
        <Button 
          className="w-full" 
          onClick={fetchVerificationDetails}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh Verification Status"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default MidDeskReport;