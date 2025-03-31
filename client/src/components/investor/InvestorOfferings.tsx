import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Filter,
  PieChart,
  Search,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";

interface InvestmentOffering {
  id: number;
  name: string;
  description: string;
  type: "fixed_term_15_2yr" | "fixed_term_18_4yr";
  interestRate: number;
  termMonths: number;
  minimumInvestment: number;
  totalRaised: number;
  totalTarget: number;
  isActive: boolean;
  deferredInterestMonths?: number;
}

export default function InvestorOfferings() {
  const [_, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);

  // Fetch investor profile to check KYC status
  const profileQuery = useQuery({
    queryKey: ["/api/investor/profile"],
    retry: false,
  });

  // Fetch all offerings
  const offeringsQuery = useQuery({
    queryKey: ["/api/investor/offerings"],
    retry: false,
  });

  // Check if KYC is verified
  const isKycVerified = profileQuery.data?.profile?.kycStatus === "verified";

  // Filter offerings based on search query and filter
  const filteredOfferings = offeringsQuery.data?.offerings
    ? offeringsQuery.data.offerings.filter((offering: InvestmentOffering) => {
        const matchesSearch =
          searchQuery === "" ||
          offering.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          offering.description.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesFilter =
          filterType === null ||
          offering.type === filterType;

        return matchesSearch && matchesFilter;
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Investment Offerings</h1>
        <div className="flex items-center mt-4 sm:mt-0">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search offerings..."
              className="w-full pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="ml-2 flex items-center space-x-2">
            <Button
              variant={filterType === null ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilterType(null)}
            >
              All
            </Button>
            <Button
              variant={filterType === "fixed_term_15_2yr" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilterType("fixed_term_15_2yr")}
            >
              15%
            </Button>
            <Button
              variant={filterType === "fixed_term_18_4yr" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilterType("fixed_term_18_4yr")}
            >
              18%
            </Button>
          </div>
        </div>
      </div>

      {/* KYC Status Alert */}
      {!isKycVerified && (
        <Alert className="bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">KYC Verification Required</AlertTitle>
          <AlertDescription className="text-red-700">
            Complete your profile and KYC verification to invest in these offerings.
            <Button asChild variant="outline" className="mt-2 bg-white">
              <Link href="/investor/profile">Complete Verification</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {offeringsQuery.isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-4 w-3/4 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : offeringsQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load investment offerings. Please try again later.
          </AlertDescription>
        </Alert>
      ) : filteredOfferings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PieChart className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Investment Offerings Found</h3>
          <p className="text-muted-foreground mt-2 max-w-md">
            {searchQuery
              ? `No offerings match "${searchQuery}"`
              : "There are currently no active investment offerings available."}
          </p>
          {searchQuery && (
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setSearchQuery("")}
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredOfferings.map((offering: InvestmentOffering) => (
            <OfferingCard 
              key={offering.id} 
              offering={offering} 
              isKycVerified={isKycVerified}
            />
          ))}
        </div>
      )}

      {/* Information section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Investment Information</CardTitle>
          <CardDescription>
            Learn more about our investment offerings and how they work
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-medium">15% Fixed Return (2 Year Term)</h3>
              <p className="text-sm text-muted-foreground">
                Our 2-year offering provides a competitive 15% annual percentage yield with quarterly interest payments. 
                Minimum investment of $5,000 with principal returned at maturity.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">18% Fixed Return (4 Year Term)</h3>
              <p className="text-sm text-muted-foreground">
                Our 4-year offering offers an enhanced 18% annual percentage yield with quarterly interest payments. 
                Higher minimum investment of $10,000 with principal returned at maturity.
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="font-medium">How Your Investment Works</h3>
            <p className="text-sm text-muted-foreground">
              Your investment is secured by tokenized merchant contracts on the blockchain. 
              Each investment represents fractional ownership in a portfolio of merchant financing. 
              Interest payments are made quarterly, and your principal is returned at the end of the term.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/investor/documents">
              View Documentation
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

interface OfferingCardProps {
  offering: InvestmentOffering;
  isKycVerified: boolean;
}

function OfferingCard({ offering, isKycVerified }: OfferingCardProps) {
  // Calculate funding progress
  const progressPercentage = Math.min(
    Math.round((offering.totalRaised / offering.totalTarget) * 100),
    100
  );

  // Format offering type display
  const getOfferingTypeDisplay = (type: string) => {
    switch (type) {
      case "fixed_term_15_2yr":
        return "15% Fixed Return - 24 Months";
      case "fixed_term_18_4yr":
        return "18% Fixed Return - 48 Months";
      default:
        return type;
    }
  };

  // Format term time
  const formatTermTime = (months: number) => {
    const years = months / 12;
    return years === 1 ? "1 year" : `${years} years`;
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-1">
          <CardTitle>{offering.name}</CardTitle>
          <Badge variant={offering.type === "fixed_term_15_2yr" ? "secondary" : "default"}>
            {offering.interestRate}% APY
          </Badge>
        </div>
        <CardDescription className="line-clamp-2">{offering.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Type</div>
            <div className="font-medium">{getOfferingTypeDisplay(offering.type)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Minimum</div>
            <div className="font-medium">${offering.minimumInvestment.toLocaleString()}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Term</div>
            <div className="font-medium flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              <span>{formatTermTime(offering.termMonths)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Interest</div>
            <div className="font-medium">{offering.interestRate}% APY</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Funding Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>${offering.totalRaised.toLocaleString()} raised</span>
            <span>${offering.totalTarget.toLocaleString()} target</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 pt-3">
        <Button 
          className="w-full" 
          asChild
          disabled={!isKycVerified}
        >
          <Link href={`/investor/offerings/${offering.id}`}>
            View Details <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}