import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CircleHelp, Download, ReceiptText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface PlaidTransfer {
  id: number;
  transferId: string;
  accountId: string;
  amount: number;
  status: string;
  type: string;
  networkType: string | null;
  failureReason: string | null;
  description: string;
  createdAt: string;
  merchantId: number;
  contractId: number | null;
}

interface FundingBatch {
  date: string;
  transfers: PlaidTransfer[];
  totalAmount: number;
}

interface FundingMetrics {
  totalFunding: number;
  pendingFunding: number;
  recentFunding: number;
  failedFunding: number;
}

export default function MerchantFunding() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["/api/merchant-funding/funding"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/merchant-funding/funding", {
          credentials: "include",
        });
        if (!res.ok) {
          console.error(`Failed to fetch funding data: ${res.status}`);
          const errorText = await res.text();
          throw new Error(`Failed to fetch funding data: ${errorText}`);
        }
        return res.json();
      } catch (error) {
        console.error("Error fetching funding data:", error);
        throw error;
      }
    },
    retry: 1,
  });

  if (isLoading) {
    return <FundingLoadingSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-bold mb-4">Unable to load funding data</h2>
        <p className="text-muted-foreground mb-6">
          {error instanceof Error ? error.message : "An unknown error occurred."}
        </p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // Group transfers by date
  const transfersByDate: Record<string, PlaidTransfer[]> = {};
  const transfers: PlaidTransfer[] = data?.transfers || [];

  transfers.forEach((transfer) => {
    // Use date part only for grouping
    const dateOnly = transfer.createdAt.split("T")[0];
    if (!transfersByDate[dateOnly]) {
      transfersByDate[dateOnly] = [];
    }
    transfersByDate[dateOnly].push(transfer);
  });

  // Create funding batches
  const fundingBatches: FundingBatch[] = Object.keys(transfersByDate)
    .sort((a, b) => (a < b ? 1 : -1)) // Sort dates descending
    .map((date) => {
      const batchTransfers = transfersByDate[date];
      const totalAmount = batchTransfers.reduce(
        (sum, t) => sum + (t.type === "credit" ? t.amount : 0),
        0
      );
      return {
        date,
        transfers: batchTransfers,
        totalAmount,
      };
    });

  // Calculate metrics
  const metrics = calculateFundingMetrics(transfers);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Funding</h2>
          <p className="text-muted-foreground">
            Track and manage funding transactions to your business
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <FundingMetricsCards metrics={metrics} />

      <div className="space-y-6">
        <h3 className="text-xl font-semibold">Funding History</h3>
        {fundingBatches.length === 0 ? (
          <Card>
            <CardContent className="py-10">
              <div className="text-center">
                <ReceiptText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No funding data</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  No funding transactions have been processed yet
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          renderFundingBatches(fundingBatches)
        )}
      </div>
    </div>
  );
}

// Helper function to calculate funding metrics
const calculateFundingMetrics = (transfers: PlaidTransfer[]): FundingMetrics => {
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Filter for credit transfers only (money being sent to merchant)
  const creditTransfers = transfers.filter((t) => t.type === "credit");

  // Calculate total funding (all credit transfers)
  const totalFunding = creditTransfers.reduce((sum, t) => sum + t.amount, 0);

  // Pending funding (transfers with status "pending")
  const pendingFunding = creditTransfers
    .filter((t) => t.status === "pending")
    .reduce((sum, t) => sum + t.amount, 0);

  // Recent funding (last 30 days)
  const recentFunding = creditTransfers
    .filter((t) => {
      const transferDate = new Date(t.createdAt);
      return transferDate >= thirtyDaysAgo;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  // Failed funding
  const failedFunding = creditTransfers
    .filter((t) => t.status === "failed" || t.status === "returned")
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    totalFunding,
    pendingFunding,
    recentFunding,
    failedFunding,
  };
};

function renderFundingBatches(batches: FundingBatch[]) {
  return batches.map((batch) => (
    <Card key={batch.date} className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">
            {format(parseISO(batch.date), "MMMM d, yyyy")}
          </CardTitle>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Funding</p>
            <p className="text-lg font-bold">
              {formatCurrency(batch.totalAmount)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfer ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batch.transfers.map((transfer) => (
              <TableRow key={transfer.transferId}>
                <TableCell className="font-mono text-xs">
                  {transfer.transferId.substring(0, 8)}...
                </TableCell>
                <TableCell>
                  <Badge
                    variant={transfer.type === "credit" ? "default" : "outline"}
                  >
                    {transfer.type === "credit" ? "Deposit" : "Withdrawal"}
                  </Badge>
                </TableCell>
                <TableCell
                  className={
                    transfer.type === "credit"
                      ? "font-medium text-emerald-600"
                      : "font-medium text-red-600"
                  }
                >
                  {transfer.type === "credit" ? "+" : "-"}
                  {formatCurrency(transfer.amount)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={transfer.status} />
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {transfer.description || "No description"}
                </TableCell>
                <TableCell className="text-right">
                  {format(parseISO(transfer.createdAt), "h:mm a")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex justify-end pt-0">
        <Button variant="ghost" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Download Receipts
        </Button>
      </CardFooter>
    </Card>
  ));
}

function StatusBadge({ status }: { status: string }) {
  let variant:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success" = "outline";

  let label = status.charAt(0).toUpperCase() + status.slice(1);
  let tooltip = "";

  switch (status.toLowerCase()) {
    case "pending":
      variant = "secondary";
      tooltip = "Transfer has been initiated but not completed yet";
      break;
    case "posted":
    case "completed":
    case "success":
      variant = "success";
      label = "Completed";
      tooltip = "Transfer has been successfully completed";
      break;
    case "cancelled":
      variant = "outline";
      tooltip = "Transfer was cancelled before processing";
      break;
    case "failed":
    case "returned":
      variant = "destructive";
      tooltip = "Transfer failed or was returned";
      break;
    default:
      variant = "outline";
      tooltip = "Current status of the transfer";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center space-x-1">
            <Badge variant={variant}>{label}</Badge>
            <CircleHelp className="h-3 w-3 text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="w-60">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FundingMetricsCards({ metrics }: { metrics: FundingMetrics }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Total Funding</CardTitle>
          <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(metrics.totalFunding)}
          </div>
          <p className="text-xs text-muted-foreground">
            Lifetime funding received
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Recent Funding</CardTitle>
          <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(metrics.recentFunding)}
          </div>
          <p className="text-xs text-muted-foreground">Last 30 days</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(metrics.pendingFunding)}
          </div>
          <p className="text-xs text-muted-foreground">Awaiting processing</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">Failed</CardTitle>
          <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(metrics.failedFunding)}
          </div>
          <p className="text-xs text-muted-foreground">Failed transfers</p>
        </CardContent>
      </Card>
    </div>
  );
}

function FundingLoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Funding</h2>
          <p className="text-muted-foreground">
            Track and manage funding transactions to your business
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array(4)
          .fill(null)
          .map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-36 mb-1" />
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Funding History</h3>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array(5)
                .fill(null)
                .map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CreditCardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}