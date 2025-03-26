import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";

interface TokenizedContractData {
  id: number;
  contractNumber: string;
  tokenId: string | null;
  tokenizationStatus: "pending" | "processing" | "tokenized" | "failed";
  smartContractAddress: string | null;
  blockchainTransactionHash: string | null;
  blockNumber: number | null;
  tokenizationTimestamp: string | null;
  tokenizationError: string | null;
  merchantName?: string;
  customerName?: string;
  amount: number;
}

interface TokenizedContractsListProps {
  status: "pending" | "processing" | "tokenized" | "failed";
}

export default function TokenizedContractsList({ status }: TokenizedContractsListProps) {
  const { data, isLoading, error } = useQuery<TokenizedContractData[]>({
    queryKey: [`/api/blockchain/contracts/${status}`],
    retry: 1,
  });

  const renderExplorerLink = (transactionHash: string | null) => {
    if (!transactionHash) return null;
    
    // This would normally use the explorer URL for the specific network
    // e.g., for Ethereum: `https://etherscan.io/tx/${transactionHash}`
    // For demonstration only - substitute with actual explorer link
    const explorerUrl = `https://etherscan.io/tx/${transactionHash}`;
    
    return (
      <Button variant="ghost" size="sm" className="p-0 h-auto" asChild>
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "tokenized":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Tokenized</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Processing</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return `${formatDistanceToNow(date, { addSuffix: true })}`;
  };

  const shortenAddress = (address: string | null) => {
    if (!address) return "N/A";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-20" />
          </CardTitle>
          <CardDescription><Skeleton className="h-4 w-full" /></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col space-y-2">
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load {status} contracts. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="capitalize">{status} Contracts</CardTitle>
          <CardDescription>
            {status === "tokenized" 
              ? "Contracts that have been successfully tokenized on the blockchain"
              : status === "pending"
              ? "Contracts waiting to be tokenized"
              : status === "processing"
              ? "Contracts currently being processed for tokenization"
              : "Contracts that failed during the tokenization process"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            No {status} contracts found.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span className="capitalize">{status} Contracts</span>
          <Badge variant="outline">{data.length}</Badge>
        </CardTitle>
        <CardDescription>
          {status === "tokenized" 
            ? "Contracts that have been successfully tokenized on the blockchain"
            : status === "pending"
            ? "Contracts waiting to be tokenized"
            : status === "processing"
            ? "Contracts currently being processed for tokenization"
            : "Contracts that failed during the tokenization process"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract #</TableHead>
                <TableHead>Amount</TableHead>
                {status === "tokenized" && <TableHead>Token ID</TableHead>}
                {(status === "tokenized" || status === "processing") && <TableHead>Transaction</TableHead>}
                {status === "failed" && <TableHead>Error</TableHead>}
                {(status === "tokenized" || status === "processing") && <TableHead>Time</TableHead>}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                  <TableCell>{formatAmount(contract.amount)}</TableCell>
                  
                  {status === "tokenized" && (
                    <TableCell className="font-mono text-xs">
                      {contract.tokenId || "N/A"}
                    </TableCell>
                  )}
                  
                  {(status === "tokenized" || status === "processing") && (
                    <TableCell className="font-mono text-xs">
                      {contract.blockchainTransactionHash 
                        ? (
                          <div className="flex items-center space-x-1">
                            <span title={contract.blockchainTransactionHash}>
                              {shortenAddress(contract.blockchainTransactionHash)}
                            </span>
                            {renderExplorerLink(contract.blockchainTransactionHash)}
                          </div>
                        )
                        : "N/A"}
                    </TableCell>
                  )}
                  
                  {status === "failed" && (
                    <TableCell className="text-xs text-destructive max-w-[300px] truncate" title={contract.tokenizationError || undefined}>
                      {contract.tokenizationError || "Unknown error"}
                    </TableCell>
                  )}
                  
                  {(status === "tokenized" || status === "processing") && (
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(contract.tokenizationTimestamp)}
                    </TableCell>
                  )}
                  
                  <TableCell>{getStatusBadge(contract.tokenizationStatus)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}