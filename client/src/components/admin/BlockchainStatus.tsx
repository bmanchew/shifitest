import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Check, HelpCircle } from "lucide-react";

interface BlockchainStatusData {
  initialized: boolean;
  connected: boolean;
  networkId: number | null;
  networkName: string | null;
  contractAddress: string | null;
  error: string | null;
}

export default function BlockchainStatus() {
  const { data, isLoading, error } = useQuery<BlockchainStatusData>({
    queryKey: ["/api/blockchain/status"],
    retry: 1,
  });

  let statusDisplay = null;
  let statusContent = null;

  if (isLoading) {
    statusDisplay = (
      <Skeleton className="h-8 w-28" />
    );
    
    statusContent = (
      <div className="space-y-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    );
  } else if (error) {
    statusDisplay = (
      <Badge variant="destructive" className="text-sm">
        <AlertCircle className="h-4 w-4 mr-1" /> Error
      </Badge>
    );
    
    statusContent = (
      <div className="text-destructive">
        <p>Failed to fetch blockchain status. Please try again later.</p>
      </div>
    );
  } else if (!data) {
    statusDisplay = (
      <Badge variant="outline" className="text-sm">
        <HelpCircle className="h-4 w-4 mr-1" /> Unknown
      </Badge>
    );
    
    statusContent = (
      <div className="text-muted-foreground">
        <p>No blockchain status data available.</p>
      </div>
    );
  } else {
    const { initialized, connected, networkId, networkName, contractAddress, error: statusError } = data;
    
    if (initialized && connected) {
      statusDisplay = (
        <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-200 text-sm">
          <Check className="h-4 w-4 mr-1" /> Connected
        </Badge>
      );
    } else if (initialized && !connected) {
      statusDisplay = (
        <Badge variant="warning" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 text-sm">
          <AlertCircle className="h-4 w-4 mr-1" /> Disconnected
        </Badge>
      );
    } else {
      statusDisplay = (
        <Badge variant="destructive" className="text-sm">
          <AlertCircle className="h-4 w-4 mr-1" /> Not Initialized
        </Badge>
      );
    }
    
    statusContent = (
      <div className="space-y-4">
        {statusError && (
          <div className="text-destructive">
            <p><strong>Error:</strong> {statusError}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Initialization Status</p>
            <p>{initialized ? "Initialized" : "Not Initialized"}</p>
          </div>
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">Connection Status</p>
            <p>{connected ? "Connected" : "Disconnected"}</p>
          </div>
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">Network</p>
            <p>{networkName || "Unknown"}{networkId ? ` (ID: ${networkId})` : ""}</p>
          </div>
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">Smart Contract</p>
            <p className="truncate" title={contractAddress || undefined}>
              {contractAddress 
                ? `${contractAddress.substring(0, 6)}...${contractAddress.substring(contractAddress.length - 4)}` 
                : "Not Connected"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl">Blockchain Status</CardTitle>
        {statusDisplay}
      </CardHeader>
      <CardContent>
        {statusContent}
      </CardContent>
    </Card>
  );
}