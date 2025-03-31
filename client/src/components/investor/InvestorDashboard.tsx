import { useState } from "react";
import { Link } from "wouter";
import { InvestorLayout } from "./InvestorLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { Circle, PieChart, ArrowUpRight, FilePlus, DollarSign, ChevronRight, Clock, FileCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export default function InvestorDashboard() {
  const { data: investmentsData, isLoading: isInvestmentsLoading } = useQuery({
    queryKey: ['/api/investor/investments'],
    retry: false,
  });

  const { data: offeringsData, isLoading: isOfferingsLoading } = useQuery({
    queryKey: ['/api/investor/offerings'],
    retry: false,
  });

  const cardLoadingState = (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </CardContent>
    </Card>
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <InvestorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investor Dashboard</h1>
          <p className="text-muted-foreground">
            Track your investment portfolio and discover new opportunities
          </p>
        </div>

        <Separator />

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Total Invested */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isInvestmentsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  formatCurrency(
                    investmentsData?.investments?.reduce(
                      (total: number, investment: any) => total + investment.amount,
                      0
                    ) || 0
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Across {isInvestmentsLoading ? '...' : investmentsData?.investments?.length || 0} investments
              </p>
              <div className="mt-4">
                <Progress
                  value={70}
                  className="h-2"
                />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <div>Target: $50,000</div>
                  <div>{isInvestmentsLoading ? '...' : '70%'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expected Returns */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Expected Returns</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isInvestmentsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  formatCurrency(
                    investmentsData?.investments?.reduce(
                      (total: number, investment: any) => total + investment.expectedReturn,
                      0
                    ) || 0
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Projected based on current rates
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-md border p-2">
                  <div className="text-xs font-medium">15% APY</div>
                  <div className="text-sm">
                    {isInvestmentsLoading ? (
                      <Skeleton className="h-5 w-16" />
                    ) : (
                      formatCurrency(
                        investmentsData?.investments
                          ?.filter((i: any) => i.offering?.offeringType === 'fixed_15_percent')
                          .reduce((total: number, i: any) => total + i.amount, 0) || 0
                      )
                    )}
                  </div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-xs font-medium">18% APY</div>
                  <div className="text-sm">
                    {isInvestmentsLoading ? (
                      <Skeleton className="h-5 w-16" />
                    ) : (
                      formatCurrency(
                        investmentsData?.investments
                          ?.filter((i: any) => i.offering?.offeringType === 'fixed_18_percent')
                          .reduce((total: number, i: any) => total + i.amount, 0) || 0
                      )
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KYC Status */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Verification Status</CardTitle>
                <FileCheck className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center space-y-3 pt-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="text-center">
                  <div className="font-medium">KYC Verification Required</div>
                  <p className="text-xs text-muted-foreground">
                    Complete your verification to access all investment options
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/investor/profile">
                    <a className="flex items-center">
                      Start Verification
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </a>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Investments */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Recent Investments</CardTitle>
              <CardDescription>
                Your most recent contract investments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isInvestmentsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : investmentsData?.investments?.length > 0 ? (
                <div className="space-y-4">
                  {investmentsData.investments.slice(0, 5).map((investment: any) => (
                    <div key={investment.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-1">
                        <div className="font-medium">{investment.offering?.name || 'Unnamed Offering'}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{formatCurrency(investment.amount)}</span>
                          <Circle className="h-1.5 w-1.5 fill-current" />
                          <span className="text-sm text-muted-foreground">
                            {new Date(investment.investmentDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/investor/investments/${investment.id}`}>
                          <a>Details</a>
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-[180px] flex-col items-center justify-center rounded-md border border-dashed">
                  <PieChart className="h-10 w-10 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No investments yet</h3>
                  <p className="mb-4 mt-2 text-sm text-muted-foreground text-center max-w-xs">
                    You haven't made any investments. Browse our offerings to get started.
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/investor/offerings">
                      <a>Browse Offerings</a>
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Offerings */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Featured Offerings</CardTitle>
              <CardDescription>
                Investment opportunities currently available
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isOfferingsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : offeringsData?.offerings?.length > 0 ? (
                <div className="space-y-4">
                  {offeringsData.offerings.slice(0, 3).map((offering: any) => (
                    <div key={offering.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-1">
                        <div className="font-medium">{offering.name}</div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {offering.offeringType === 'fixed_15_percent' ? '15% APY - 2yr' : '18% APY - 4yr'}
                          </span>
                          <Circle className="h-1.5 w-1.5 fill-current" />
                          <span className="text-sm text-muted-foreground">Min: {formatCurrency(offering.minInvestment)}</span>
                        </div>
                      </div>
                      <Button asChild size="sm">
                        <Link href={`/investor/offerings/${offering.id}`}>
                          <a>Invest</a>
                        </Link>
                      </Button>
                    </div>
                  ))}

                  <div className="pt-2 flex justify-center">
                    <Button asChild variant="outline">
                      <Link href="/investor/offerings">
                        <a className="flex items-center">
                          View All Offerings
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </a>
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-[180px] flex-col items-center justify-center rounded-md border border-dashed">
                  <FilePlus className="h-10 w-10 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No offerings available</h3>
                  <p className="mb-4 mt-2 text-sm text-muted-foreground text-center">
                    There are no investment opportunities available at the moment.
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/investor/documents">
                      <a>Browse Documents</a>
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </InvestorLayout>
  );
}