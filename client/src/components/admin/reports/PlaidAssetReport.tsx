import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface PlaidAssetReportProps {
  merchantId: number;
}

interface AssetReport {
  id: number;
  contractId: number;
  userId: number | null;
  assetReportId: string;
  assetReportToken: string;
  status: string;
  daysRequested: number;
  analysisData: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface AssetReportDetails {
  report: {
    asset_report_id: string;
    client_report_id: string | null;
    date_generated: string;
    days_requested: number;
    items: Array<{
      institution_name: string;
      institution_id: string;
      accounts: Array<{
        account_id: string;
        name: string;
        official_name: string | null;
        type: string;
        subtype: string | null;
        balances: {
          available: number | null;
          current: number;
          limit: number | null;
          iso_currency_code: string;
        };
        historical_balances: Array<{
          date: string;
          current: number;
        }>;
      }>
    }>
  }
}

const PlaidAssetReport: React.FC<PlaidAssetReportProps> = ({ merchantId }) => {
  const [assetReports, setAssetReports] = useState<AssetReport[]>([]);
  const [selectedReportDetails, setSelectedReportDetails] = useState<AssetReportDetails | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Fetch asset reports for this merchant
  const fetchAssetReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/admin/merchant-reports/${merchantId}/asset-reports`);
      
      if (response.data.success) {
        setAssetReports(response.data.assetReports || []);
        
        // Auto-select the first report if available
        if (response.data.assetReports && response.data.assetReports.length > 0) {
          const latestReport = response.data.assetReports[0];
          setSelectedReportId(latestReport.assetReportId);
          fetchReportDetails(latestReport.assetReportId);
        }
      } else {
        setError(response.data.message || "Failed to fetch asset reports");
      }
    } catch (err) {
      setError("Error fetching asset reports: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Fetch details for a specific asset report
  const fetchReportDetails = async (reportId: string) => {
    try {
      setDetailsLoading(true);
      const response = await axios.get(`/api/admin/merchant-reports/asset-report/${reportId}`);
      
      if (response.data.success) {
        setSelectedReportDetails(response.data.assetReport);
      } else {
        setError("Failed to fetch report details: " + response.data.message);
      }
    } catch (err) {
      setError("Error fetching report details: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDetailsLoading(false);
    }
  };

  // Refresh the list of asset reports
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchAssetReports();
    } finally {
      setRefreshing(false);
    }
  };

  // Select a report to view details
  const handleSelectReport = (reportId: string) => {
    setSelectedReportId(reportId);
    fetchReportDetails(reportId);
  };

  // Initialize component
  useEffect(() => {
    fetchAssetReports();
  }, [merchantId]);

  // No reports available
  if (!loading && assetReports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Plaid Asset Reports</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>Financial data from connected accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            {error ? (
              <div className="text-red-500">{error}</div>
            ) : (
              <p>No asset reports available for this merchant</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={() => window.open(`/admin/merchant-reports/${merchantId}/create-asset-report`, '_blank')}
          >
            Create New Asset Report
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Plaid Asset Reports</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>Financial data from connected accounts</CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[300px]" />
          </div>
        ) : (
          <Tabs defaultValue={selectedReportId || ""} className="w-full">
            <TabsList className="w-full justify-start px-6 pt-2 overflow-x-auto">
              {assetReports.map(report => (
                <TabsTrigger 
                  key={report.assetReportId} 
                  value={report.assetReportId}
                  onClick={() => handleSelectReport(report.assetReportId)}
                  className="whitespace-nowrap"
                >
                  {format(new Date(report.createdAt), "MMM d, yyyy")}
                  {report.status !== 'ready' && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                      {report.status}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {assetReports.map(report => (
              <TabsContent key={report.assetReportId} value={report.assetReportId} className="border-t mt-0 pt-0">
                {detailsLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[80%]" />
                    <Skeleton className="h-4 w-[90%]" />
                    <Skeleton className="h-40 w-full" />
                  </div>
                ) : error ? (
                  <div className="p-6 text-red-500">{error}</div>
                ) : selectedReportDetails ? (
                  <div className="p-6">
                    <div className="mb-4 grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium mb-1">Report ID</h4>
                        <p className="text-sm text-muted-foreground">{selectedReportDetails.report.asset_report_id}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Generated</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(selectedReportDetails.report.date_generated), "PPpp")}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Days of History</h4>
                        <p className="text-sm text-muted-foreground">{selectedReportDetails.report.days_requested} days</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Financial Institutions</h4>
                        <p className="text-sm text-muted-foreground">{selectedReportDetails.report.items.length} connected</p>
                      </div>
                    </div>

                    <h3 className="text-base font-medium mb-3 mt-6">Accounts Summary</h3>
                    <div className="rounded-md border">
                      <div className="grid grid-cols-5 gap-2 bg-muted p-3 font-medium text-xs">
                        <div>Institution</div>
                        <div>Account</div>
                        <div>Type</div>
                        <div className="text-right">Current Balance</div>
                        <div className="text-right">Available Balance</div>
                      </div>
                      <ScrollArea className="h-[300px]">
                        {selectedReportDetails.report.items.map((item, itemIndex) => (
                          <React.Fragment key={itemIndex}>
                            {item.accounts.map((account, accountIndex) => (
                              <div 
                                key={`${itemIndex}-${accountIndex}`} 
                                className="grid grid-cols-5 gap-2 p-3 text-xs border-t"
                              >
                                <div>{item.institution_name}</div>
                                <div>{account.name}</div>
                                <div className="capitalize">{account.type}{account.subtype ? ` - ${account.subtype}` : ''}</div>
                                <div className="text-right">
                                  {new Intl.NumberFormat('en-US', { 
                                    style: 'currency', 
                                    currency: account.balances.iso_currency_code 
                                  }).format(account.balances.current / 100)}
                                </div>
                                <div className="text-right">
                                  {account.balances.available !== null 
                                    ? new Intl.NumberFormat('en-US', { 
                                        style: 'currency', 
                                        currency: account.balances.iso_currency_code 
                                      }).format(account.balances.available / 100)
                                    : 'N/A'}
                                </div>
                              </div>
                            ))}
                          </React.Fragment>
                        ))}
                      </ScrollArea>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    {report.status === 'ready' 
                      ? 'Select a report to view details' 
                      : `This report is ${report.status}. Details will be available when ready.`}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>

      <CardFooter className="border-t">
        <Button 
          className="w-full" 
          onClick={() => window.open(`/admin/merchant-reports/${merchantId}/create-asset-report`, '_blank')}
        >
          Create New Asset Report
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PlaidAssetReport;