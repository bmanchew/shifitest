import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart,
  CheckCircle,
  Clock,
  FileText,
  HelpCircle,
  History,
  Info,
  Landmark,
  Layers,
  LucideIcon,
  PercentCircle,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { InvestorLayout } from "./InvestorLayout";

// Dashboard stat card component
interface StatCardProps {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  footer?: React.ReactNode;
  loading?: boolean;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  footer,
  loading = false,
}: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-28 bg-muted animate-pulse rounded-md"></div>
            {description && (
              <div className="h-4 w-full bg-muted animate-pulse rounded-md"></div>
            )}
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <div className="flex items-center mt-1">
                <Badge
                  variant="outline"
                  className={
                    trend.value > 0
                      ? "text-green-600 bg-green-50"
                      : trend.value < 0
                      ? "text-red-600 bg-red-50"
                      : "text-blue-600 bg-blue-50"
                  }
                >
                  {trend.value > 0
                    ? `↑ ${trend.value}%`
                    : trend.value < 0
                    ? `↓ ${Math.abs(trend.value)}%`
                    : `${trend.value}%`}
                </Badge>
                <span className="text-xs text-muted-foreground ml-2">
                  {trend.label}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
      {footer && <CardFooter className="pt-1">{footer}</CardFooter>}
    </Card>
  );
}

// Action card component
interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  variant?: "default" | "outline";
}

function ActionCard({
  title,
  description,
  icon: Icon,
  href,
  variant = "default",
}: ActionCardProps) {
  return (
    <Card
      className={`overflow-hidden hover:border-primary/50 transition-colors ${
        variant === "outline" ? "bg-background" : "bg-muted/30"
      }`}
    >
      <Link href={href}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div
              className={`rounded-lg p-2 ${
                variant === "outline"
                  ? "bg-muted/50"
                  : "bg-background text-primary"
              }`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

// Recent activity item component
interface ActivityItemProps {
  icon: LucideIcon;
  title: string;
  description: string;
  date: string;
  status?: "success" | "pending" | "error";
}

function ActivityItem({
  icon: Icon,
  title,
  description,
  date,
  status,
}: ActivityItemProps) {
  return (
    <div className="flex items-start gap-4 py-3">
      <div
        className={`rounded-full p-2 ${
          status === "success"
            ? "bg-green-100 text-green-600"
            : status === "error"
            ? "bg-red-100 text-red-600"
            : status === "pending"
            ? "bg-amber-100 text-amber-600"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{title}</p>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// Investment summary card component
interface InvestmentSummaryProps {
  investment: any;
  loading?: boolean;
}

function InvestmentSummary({ investment, loading = false }: InvestmentSummaryProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="h-6 w-1/3 bg-muted animate-pulse rounded-md"></div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <div className="h-5 w-1/4 bg-muted animate-pulse rounded-md"></div>
            <div className="h-5 w-1/4 bg-muted animate-pulse rounded-md"></div>
          </div>
          <div className="h-2 w-full bg-muted animate-pulse rounded-md"></div>
          <div className="flex justify-between">
            <div className="h-5 w-1/4 bg-muted animate-pulse rounded-md"></div>
            <div className="h-5 w-1/4 bg-muted animate-pulse rounded-md"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate maturity date
  const maturityDate = new Date(investment.createdAt);
  maturityDate.setMonth(maturityDate.getMonth() + investment.termMonths);
  
  // Calculate progress
  const startDate = new Date(investment.createdAt);
  const now = new Date();
  const totalDuration = maturityDate.getTime() - startDate.getTime();
  const elapsedDuration = now.getTime() - startDate.getTime();
  const progress = Math.min(
    Math.max(0, Math.floor((elapsedDuration / totalDuration) * 100)),
    100
  );

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate expected return
  const expectedReturn = investment.amount * (1 + (investment.interestRate / 100) * (investment.termMonths / 12));
  const profit = expectedReturn - investment.amount;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base">{investment.offeringName}</CardTitle>
          <Badge
            variant={
              investment.status === "active"
                ? "default"
                : investment.status === "completed"
                ? "outline"
                : "secondary"
            }
          >
            {investment.status.charAt(0).toUpperCase() + investment.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Amount Invested</span>
          <span className="font-medium">{formatCurrency(investment.amount)}</span>
        </div>
        {investment.status === "active" && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Term Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1" />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expected Return</span>
              <span className="font-medium text-green-600">
                {formatCurrency(expectedReturn)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Maturity Date</span>
              <span className="font-medium">{formatDate(maturityDate)}</span>
            </div>
          </>
        )}
        {investment.status === "completed" && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Return</span>
              <span className="font-medium">{formatCurrency(expectedReturn)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Profit</span>
              <span className="font-medium text-green-600">{formatCurrency(profit)}</span>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="pt-1">
        <Button variant="outline" className="w-full" size="sm" asChild>
          <Link href={`/investor/investments/${investment.id}`}>
            View Details
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function InvestorDashboard() {
  // Fetch investor profile
  const profileQuery = useQuery({
    queryKey: ["/api/investor/profile"],
    retry: false,
  });

  // Fetch investment summary
  const investmentSummaryQuery = useQuery({
    queryKey: ["/api/investor/dashboard/summary"],
    retry: false,
  });

  // Fetch recent activity
  const recentActivityQuery = useQuery({
    queryKey: ["/api/investor/dashboard/activity"],
    retry: false,
  });

  // Fetch active investments
  const activeInvestmentsQuery = useQuery({
    queryKey: ["/api/investor/investments", { status: "active" }],
    retry: false,
  });

  // Fetch available offerings
  const offeringsQuery = useQuery({
    queryKey: ["/api/investor/offerings", { status: "available" }],
    retry: false,
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Check if profile needs attention
  const profileNeedsAttention = () => {
    if (!profileQuery.data?.profile) return true;
    
    const { kycStatus, bankAccountName, ndaSigned } = profileQuery.data.profile;
    return kycStatus !== "verified" || !bankAccountName || !ndaSigned;
  };

  // Get profile completion message
  const getProfileCompletionMessage = () => {
    if (!profileQuery.data?.profile) return "Complete your investor profile to start investing";
    
    const { kycStatus, bankAccountName, ndaSigned } = profileQuery.data.profile;
    
    if (!ndaSigned) return "Sign the NDA to access investment offerings";
    if (kycStatus !== "verified") {
      if (kycStatus === "pending") return "Your KYC verification is being reviewed";
      return "Complete KYC verification to start investing";
    }
    if (!bankAccountName) return "Connect your bank account to make investments";
    
    return null;
  };

  const summary = investmentSummaryQuery.data?.summary || {
    totalInvested: 0,
    totalReturn: 0,
    activeInvestments: 0,
    totalProfit: 0,
    averageInterestRate: 0,
  };

  const activity = recentActivityQuery.data?.activity || [];
  const activeInvestments = activeInvestmentsQuery.data?.investments || [];
  const offerings = offeringsQuery.data?.offerings || [];

  const profileCompletionMessage = getProfileCompletionMessage();
  const isLoading = profileQuery.isLoading || 
                    investmentSummaryQuery.isLoading || 
                    recentActivityQuery.isLoading || 
                    activeInvestmentsQuery.isLoading || 
                    offeringsQuery.isLoading;

  return (
    <InvestorLayout>
      {/* Welcome section with profile alert if needed */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome to Your Investor Dashboard
        </h1>
        <p className="text-muted-foreground">
          Track your investments, explore new opportunities, and manage your portfolio
        </p>

        {profileNeedsAttention() && profileCompletionMessage && (
          <Alert className="mt-4 bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Action Required</AlertTitle>
            <AlertDescription className="text-blue-700">
              {profileCompletionMessage}
              <Button className="mt-2" size="sm" asChild>
                <Link href="/investor/profile">Complete Profile</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Portfolio summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Invested"
          value={formatCurrency(summary.totalInvested)}
          icon={Wallet}
          loading={isLoading}
        />
        <StatCard
          title="Expected Return"
          value={formatCurrency(summary.totalReturn)}
          description={`Profit: ${formatCurrency(summary.totalProfit)}`}
          icon={PieChart}
          loading={isLoading}
        />
        <StatCard
          title="Active Investments"
          value={summary.activeInvestments.toString()}
          icon={Layers}
          loading={isLoading}
        />
        <StatCard
          title="Average Interest Rate"
          value={`${summary.averageInterestRate.toFixed(2)}%`}
          icon={PercentCircle}
          loading={isLoading}
        />
      </div>

      {/* Main content tabs */}
      <Tabs defaultValue="overview" className="mb-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="investments">My Investments</TabsTrigger>
          <TabsTrigger value="offerings">Available Offerings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick actions */}
            <div className="md:col-span-2 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ActionCard
                    title="Explore Offerings"
                    description="Discover new investment opportunities"
                    icon={Search}
                    href="/investor/offerings"
                  />
                  <ActionCard
                    title="View Investments"
                    description="Manage your active investments"
                    icon={Landmark}
                    href="/investor/investments"
                  />
                  <ActionCard
                    title="Data Room"
                    description="Access important documents and resources"
                    icon={FileText}
                    href="/investor/documents"
                  />
                  <ActionCard
                    title="Update Profile"
                    description="Manage your investor profile and preferences"
                    icon={Shield}
                    href="/investor/profile"
                    variant="outline"
                  />
                </div>
              </div>

              {/* Featured offerings */}
              {offerings.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Featured Offerings</h2>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/investor/offerings">
                        View All <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {offerings.slice(0, 2).map((offering) => (
                      <Card key={offering.id} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{offering.name}</CardTitle>
                          <CardDescription>{offering.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 pb-3">
                          <div className="flex justify-between">
                            <div className="flex items-center gap-1 text-sm">
                              <Percent className="h-4 w-4 text-primary" />
                              <span>{offering.interestRate}% APY</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-4 w-4 text-primary" />
                              <span>{offering.termMonths} months</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Funding Progress</span>
                              <span>
                                {Math.round((offering.totalRaised / offering.totalTarget) * 100)}%
                              </span>
                            </div>
                            <Progress
                              value={Math.round(
                                (offering.totalRaised / offering.totalTarget) * 100
                              )}
                              className="h-1"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Min: {formatCurrency(offering.minimumInvestment)}</span>
                              <span>Target: {formatCurrency(offering.totalTarget)}</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Button
                            asChild
                            className="w-full"
                            variant={profileNeedsAttention() ? "outline" : "default"}
                            disabled={profileNeedsAttention()}
                          >
                            <Link href={`/investor/offerings/${offering.id}`}>
                              {profileNeedsAttention() ? "Complete Profile to Invest" : "View Offering"}
                            </Link>
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Recent Activity</h2>
                <Button variant="ghost" size="sm" className="gap-1">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-6 space-y-6">
                      {[...Array(4)].map((_, index) => (
                        <div key={index} className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-full bg-muted animate-pulse"></div>
                          <div className="space-y-2 flex-1">
                            <div className="h-5 w-3/4 bg-muted animate-pulse rounded-md"></div>
                            <div className="h-4 w-full bg-muted animate-pulse rounded-md"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activity.length > 0 ? (
                    <div className="p-4">
                      {activity.map((item, index) => (
                        <React.Fragment key={index}>
                          <ActivityItem
                            icon={
                              item.type === "investment_made"
                                ? Wallet
                                : item.type === "payment_received"
                                ? CheckCircle
                                : item.type === "investment_matured"
                                ? Landmark
                                : item.type === "document_uploaded"
                                ? FileText
                                : item.type === "kyc_updated"
                                ? Shield
                                : History
                            }
                            title={item.title}
                            description={item.description}
                            date={item.date}
                            status={item.status}
                          />
                          {index < activity.length - 1 && <Separator />}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <Clock className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                      <h3 className="font-medium text-lg">No Recent Activity</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your investment activity will appear here
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t px-4 py-3">
                  <Button variant="ghost" size="sm" className="w-full" asChild>
                    <Link href="/investor/activity">
                      View All Activity
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Investments Tab */}
        <TabsContent value="investments" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">My Investments</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/investor/investments">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, index) => (
                <InvestmentSummary
                  key={index}
                  investment={{}}
                  loading={true}
                />
              ))}
            </div>
          ) : activeInvestments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeInvestments.slice(0, 6).map((investment) => (
                <InvestmentSummary
                  key={investment.id}
                  investment={investment}
                />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <Layers className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="font-medium text-lg">No Active Investments</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                You don't have any active investments yet
              </p>
              <Button asChild>
                <Link href="/investor/offerings">
                  Explore Investment Opportunities
                </Link>
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* Offerings Tab */}
        <TabsContent value="offerings" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Available Offerings</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/investor/offerings">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="h-6 w-1/3 bg-muted animate-pulse rounded-md"></div>
                    <div className="h-4 w-2/3 bg-muted animate-pulse rounded-md"></div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <div className="h-5 w-1/5 bg-muted animate-pulse rounded-md"></div>
                      <div className="h-5 w-1/5 bg-muted animate-pulse rounded-md"></div>
                    </div>
                    <div className="h-2 w-full bg-muted animate-pulse rounded-md"></div>
                  </CardContent>
                  <CardFooter>
                    <div className="h-9 w-full bg-muted animate-pulse rounded-md"></div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : offerings.length > 0 ? (
            <div className="space-y-4">
              {offerings.map((offering) => (
                <Card key={offering.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle>{offering.name}</CardTitle>
                    <CardDescription>{offering.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">Interest Rate</span>
                        <span className="font-medium">{offering.interestRate}% APY</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">Term Length</span>
                        <span className="font-medium">{offering.termMonths} months</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">Minimum Investment</span>
                        <span className="font-medium">{formatCurrency(offering.minimumInvestment)}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Funding Progress</span>
                        <span>
                          {Math.round((offering.totalRaised / offering.totalTarget) * 100)}%
                        </span>
                      </div>
                      <Progress
                        value={Math.round(
                          (offering.totalRaised / offering.totalTarget) * 100
                        )}
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(offering.totalRaised)} raised</span>
                        <span>Target: {formatCurrency(offering.totalTarget)}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      asChild
                      className="w-full md:w-auto"
                      variant={profileNeedsAttention() ? "outline" : "default"}
                      disabled={profileNeedsAttention()}
                    >
                      <Link href={`/investor/offerings/${offering.id}`}>
                        {profileNeedsAttention() ? "Complete Profile to Invest" : "View Offering"}
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="font-medium text-lg">No Offerings Available</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                There are currently no investment offerings available
              </p>
              <Button variant="outline" asChild>
                <Link href="/investor/profile">
                  Check Your Profile
                </Link>
              </Button>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Resources and help section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Resources & Help</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Investor Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Learn about our investment process, terms, and how to maximize your returns.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/investor/resources/guide">
                  View Guide
                </Link>
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">FAQs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Find answers to common questions about investing, payments, and account management.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/investor/resources/faqs">
                  View FAQs
                </Link>
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Support</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Need help? Contact our investor relations team for personalized assistance.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/investor/support">
                  Get Support
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </InvestorLayout>
  );
}