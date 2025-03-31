import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CalendarIcon,
  ChevronDownIcon,
  FilterIcon,
  InfoIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { InvestorLayout } from "./InvestorLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Types
interface Offering {
  id: number;
  name: string;
  description: string;
  status: "available" | "fully_funded" | "completed" | "upcoming";
  offeringType: "fixed_term_15_2yr" | "fixed_term_18_4yr";
  interestRate: number;
  termMonths: number;
  minimumInvestment: number;
  totalTarget: number;
  totalRaised: number;
  riskLevel: "low" | "moderate" | "high";
  expectedYield: number;
  contractCount: number;
  averageContractSize: number;
  createdAt: string;
  startDate: string;
  endDate: string | null;
  fundingDeadline: string;
}

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Offering card component
function OfferingCard({ offering }: { offering: Offering }) {
  const progress = Math.min(
    Math.round((offering.totalRaised / offering.totalTarget) * 100),
    100
  );

  const getStatusBadge = (status: Offering['status']) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Available</Badge>;
      case 'fully_funded':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Fully Funded</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      case 'upcoming':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">Upcoming</Badge>;
      default:
        return null;
    }
  };

  const getRiskBadge = (risk: Offering['riskLevel']) => {
    switch (risk) {
      case 'low':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Low Risk</Badge>;
      case 'moderate':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Moderate Risk</Badge>;
      case 'high':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">High Risk</Badge>;
      default:
        return null;
    }
  };

  const getOfferingTypeName = (type: Offering['offeringType']) => {
    switch (type) {
      case 'fixed_term_15_2yr':
        return "Fixed 15% - 2 Year Term";
      case 'fixed_term_18_4yr':
        return "Fixed 18% - 4 Year Term";
      default:
        return "Custom Offering";
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <div>
            <CardTitle className="text-xl">{offering.name}</CardTitle>
            <CardDescription className="mt-1">{offering.description}</CardDescription>
          </div>
          <div>{getStatusBadge(offering.status)}</div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {getRiskBadge(offering.riskLevel)}
          <Badge variant="outline">{getOfferingTypeName(offering.offeringType)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Interest Rate</p>
            <p className="text-xl font-semibold">{offering.interestRate}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Term Length</p>
            <p className="text-xl font-semibold">{offering.termMonths} months</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Minimum Investment</p>
            <p className="text-xl font-semibold">{formatCurrency(offering.minimumInvestment)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expected Yield</p>
            <p className="text-xl font-semibold">{offering.expectedYield}%</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Funding Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatCurrency(offering.totalRaised)} raised</span>
            <span>Target: {formatCurrency(offering.totalTarget)}</span>
          </div>
        </div>

        <Accordion type="single" collapsible className="mt-4">
          <AccordionItem value="details">
            <AccordionTrigger className="text-sm font-medium">More Details</AccordionTrigger>
            <AccordionContent>
              <dl className="grid grid-cols-1 gap-y-2 text-sm">
                <div className="grid grid-cols-2">
                  <dt className="text-muted-foreground">Contracts</dt>
                  <dd>{offering.contractCount}</dd>
                </div>
                <div className="grid grid-cols-2">
                  <dt className="text-muted-foreground">Avg. Contract Size</dt>
                  <dd>{formatCurrency(offering.averageContractSize)}</dd>
                </div>
                <div className="grid grid-cols-2">
                  <dt className="text-muted-foreground">Start Date</dt>
                  <dd>{formatDate(offering.startDate)}</dd>
                </div>
                <div className="grid grid-cols-2">
                  <dt className="text-muted-foreground">Funding Deadline</dt>
                  <dd>{formatDate(offering.fundingDeadline)}</dd>
                </div>
                {offering.endDate && (
                  <div className="grid grid-cols-2">
                    <dt className="text-muted-foreground">End Date</dt>
                    <dd>{formatDate(offering.endDate)}</dd>
                  </div>
                )}
              </dl>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button
          asChild
          className="w-full"
          disabled={offering.status !== 'available'}
        >
          <Link href={`/investor/offerings/${offering.id}`}>
            {offering.status === 'available'
              ? "View & Invest"
              : offering.status === 'upcoming'
              ? "Coming Soon"
              : offering.status === 'fully_funded'
              ? "Fully Funded"
              : "Completed"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// Filters component
function OfferingFilters({
  filters,
  setFilters,
  onClose,
}: {
  filters: {
    status: string;
    type: string;
    risk: string;
    term: string;
    minInterestRate: string;
  };
  setFilters: React.Dispatch<
    React.SetStateAction<{
      status: string;
      type: string;
      risk: string;
      term: string;
      minInterestRate: string;
    }>
  >;
  onClose?: () => void;
}) {
  const [tempFilters, setTempFilters] = useState(filters);

  const handleReset = () => {
    setTempFilters({
      status: "all",
      type: "all",
      risk: "all",
      term: "all",
      minInterestRate: "0",
    });
  };

  const handleApply = () => {
    setFilters(tempFilters);
    if (onClose) onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium" htmlFor="status-filter">
          Status
        </label>
        <Select
          value={tempFilters.status}
          onValueChange={(value) =>
            setTempFilters({ ...tempFilters, status: value })
          }
        >
          <SelectTrigger id="status-filter" className="w-full">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="fully_funded">Fully Funded</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="type-filter">
          Offering Type
        </label>
        <Select
          value={tempFilters.type}
          onValueChange={(value) =>
            setTempFilters({ ...tempFilters, type: value })
          }
        >
          <SelectTrigger id="type-filter" className="w-full">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="fixed_term_15_2yr">Fixed 15% - 2 Year</SelectItem>
            <SelectItem value="fixed_term_18_4yr">Fixed 18% - 4 Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="risk-filter">
          Risk Level
        </label>
        <Select
          value={tempFilters.risk}
          onValueChange={(value) =>
            setTempFilters({ ...tempFilters, risk: value })
          }
        >
          <SelectTrigger id="risk-filter" className="w-full">
            <SelectValue placeholder="Select risk level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="low">Low Risk</SelectItem>
            <SelectItem value="moderate">Moderate Risk</SelectItem>
            <SelectItem value="high">High Risk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="term-filter">
          Term Length
        </label>
        <Select
          value={tempFilters.term}
          onValueChange={(value) =>
            setTempFilters({ ...tempFilters, term: value })
          }
        >
          <SelectTrigger id="term-filter" className="w-full">
            <SelectValue placeholder="Select term length" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="short">Short Term (≤ 24 months)</SelectItem>
            <SelectItem value="medium">Medium Term (25-36 months)</SelectItem>
            <SelectItem value="long">Long Term (≥ 37 months)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="rate-filter">
          Minimum Interest Rate
        </label>
        <Select
          value={tempFilters.minInterestRate}
          onValueChange={(value) =>
            setTempFilters({ ...tempFilters, minInterestRate: value })
          }
        >
          <SelectTrigger id="rate-filter" className="w-full">
            <SelectValue placeholder="Select minimum rate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any</SelectItem>
            <SelectItem value="10">10%+</SelectItem>
            <SelectItem value="15">15%+</SelectItem>
            <SelectItem value="18">18%+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button onClick={handleApply}>Apply Filters</Button>
      </div>
    </div>
  );
}

// Mobile Filters Sheet
function MobileFiltersSheet({
  filters,
  setFilters,
}: {
  filters: {
    status: string;
    type: string;
    risk: string;
    term: string;
    minInterestRate: string;
  };
  setFilters: React.Dispatch<
    React.SetStateAction<{
      status: string;
      type: string;
      risk: string;
      term: string;
      minInterestRate: string;
    }>
  >;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <FilterIcon className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Narrow down investment offerings by your preferences.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <OfferingFilters
            filters={filters}
            setFilters={setFilters}
            onClose={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Main InvestorOfferings component
export default function InvestorOfferings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("interestRate");
  const [filters, setFilters] = useState({
    status: "all",
    type: "all",
    risk: "all",
    term: "all",
    minInterestRate: "0",
  });

  // Fetch offerings
  const offeringsQuery = useQuery({
    queryKey: ["/api/investor/offerings", filters],
    retry: false,
  });

  // Loading state
  const isLoading = offeringsQuery.isLoading;
  
  // If data is available, filter and sort it, otherwise use empty array
  const offerings = offeringsQuery.data?.offerings || [];
  
  // Apply filters and search
  const filteredOfferings = offerings.filter((offering: Offering) => {
    // Apply search
    if (
      searchQuery &&
      !offering.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !offering.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Apply status filter
    if (filters.status !== "all" && offering.status !== filters.status) {
      return false;
    }

    // Apply type filter
    if (filters.type !== "all" && offering.offeringType !== filters.type) {
      return false;
    }

    // Apply risk filter
    if (filters.risk !== "all" && offering.riskLevel !== filters.risk) {
      return false;
    }

    // Apply term filter
    if (filters.term !== "all") {
      if (
        filters.term === "short" &&
        offering.termMonths > 24
      ) {
        return false;
      }
      if (
        filters.term === "medium" &&
        (offering.termMonths <= 24 || offering.termMonths > 36)
      ) {
        return false;
      }
      if (
        filters.term === "long" &&
        offering.termMonths < 37
      ) {
        return false;
      }
    }

    // Apply minimum interest rate filter
    if (
      parseInt(filters.minInterestRate) > 0 &&
      offering.interestRate < parseInt(filters.minInterestRate)
    ) {
      return false;
    }

    return true;
  });

  // Sort offerings
  const sortedOfferings = [...filteredOfferings].sort((a: Offering, b: Offering) => {
    switch (sortBy) {
      case "interestRate":
        return b.interestRate - a.interestRate;
      case "termLength":
        return a.termMonths - b.termMonths;
      case "minimumInvestment":
        return a.minimumInvestment - b.minimumInvestment;
      case "totalRaised":
        return b.totalRaised - a.totalRaised;
      case "riskLevel":
        const riskLevels = { low: 1, moderate: 2, high: 3 };
        return riskLevels[a.riskLevel] - riskLevels[b.riskLevel];
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      default:
        return 0;
    }
  });

  // Calculate active filters count
  const activeFiltersCount = Object.values(filters).filter(
    (value) => value !== "all" && value !== "0"
  ).length;

  return (
    <InvestorLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Investment Offerings
        </h1>
        <p className="text-muted-foreground">
          Browse and invest in available offerings or track upcoming opportunities.
        </p>
      </div>

      {/* Tabs for quick filtering */}
      <Tabs defaultValue="all" className="mb-6">
        <TabsList>
          <TabsTrigger 
            value="all" 
            onClick={() => setFilters(f => ({...f, status: "all"}))}
          >
            All Offerings
          </TabsTrigger>
          <TabsTrigger 
            value="available" 
            onClick={() => setFilters(f => ({...f, status: "available"}))}
          >
            Available
          </TabsTrigger>
          <TabsTrigger 
            value="upcoming" 
            onClick={() => setFilters(f => ({...f, status: "upcoming"}))}
          >
            Upcoming
          </TabsTrigger>
          <TabsTrigger 
            value="completed" 
            onClick={() => setFilters(f => ({...f, status: "completed"}))}
          >
            Completed
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search offerings..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {/* Mobile filters */}
          <MobileFiltersSheet filters={filters} setFilters={setFilters} />
          
          {/* Desktop filters dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="hidden lg:flex">
                <FilterIcon className="h-4 w-4 mr-2" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
              <OfferingFilters filters={filters} setFilters={setFilters} />
            </PopoverContent>
          </Popover>
          
          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontalIcon className="h-4 w-4 mr-2" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy("interestRate")}>
                Interest Rate (High to Low)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("termLength")}>
                Term Length (Short to Long)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("minimumInvestment")}>
                Minimum Investment (Low to High)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("totalRaised")}>
                Total Raised (High to Low)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("riskLevel")}>
                Risk Level (Low to High)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("newest")}>
                Newest First
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Display loading state */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-[600px]">
              <CardHeader>
                <div className="h-8 w-2/3 bg-muted animate-pulse rounded-md mb-2"></div>
                <div className="h-4 w-full bg-muted animate-pulse rounded-md"></div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {[...Array(4)].map((_, j) => (
                    <div key={j}>
                      <div className="h-4 w-1/2 bg-muted animate-pulse rounded-md mb-1"></div>
                      <div className="h-6 w-1/3 bg-muted animate-pulse rounded-md"></div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="h-2 w-full bg-muted animate-pulse rounded-md"></div>
                  <div className="h-2 w-full bg-muted animate-pulse rounded-md"></div>
                </div>
              </CardContent>
              <CardFooter className="border-t mt-auto pt-4">
                <div className="h-10 w-full bg-muted animate-pulse rounded-md"></div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : sortedOfferings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedOfferings.map((offering: Offering) => (
            <OfferingCard key={offering.id} offering={offering} />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center">
            <InfoIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No offerings found</h3>
            <p className="text-muted-foreground mb-6">
              No investment offerings match your current filters.
            </p>
            <Button onClick={() => {
              setSearchQuery("");
              setFilters({
                status: "all",
                type: "all",
                risk: "all",
                term: "all",
                minInterestRate: "0",
              });
            }}>
              Reset Filters
            </Button>
          </div>
        </Card>
      )}

      {/* Info section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Investment Information</CardTitle>
          <CardDescription>
            Learn about our investment offerings and how they work
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="what-are-offerings">
              <AccordionTrigger>
                What are investment offerings?
              </AccordionTrigger>
              <AccordionContent>
                <p>
                  Investment offerings are opportunities to invest in our platform's portfolio of merchant financing contracts. 
                  Each offering represents a collection of contracts with similar terms and risk profiles, 
                  bundled together to provide investors with consistent returns and reduced risk through diversification.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="how-to-invest">
              <AccordionTrigger>How do I invest?</AccordionTrigger>
              <AccordionContent>
                <p>
                  To invest in an offering, first complete your investor profile including KYC verification 
                  and connecting your bank account. Then browse the available offerings, select one that 
                  matches your investment goals, and click "View & Invest" to proceed with your investment.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="risk-levels">
              <AccordionTrigger>How are risk levels determined?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Risk levels are determined based on multiple factors, including the creditworthiness of merchants, 
                  contract term lengths, historical performance of similar contracts, and industry diversification. 
                  Low risk offerings typically contain contracts with established merchants with strong payment histories, 
                  while higher risk offerings may offer higher returns but with less established merchants.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="returns">
              <AccordionTrigger>How are returns calculated?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Returns are primarily based on the fixed interest rate of the offering. The interest rate represents 
                  the annualized return on your investment. For example, a $10,000 investment in a 15% offering for 2 years 
                  would yield approximately $3,000 in returns over the term ($10,000 × 15% × 2 years), for a total of $13,000.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
        <CardFooter className="border-t pt-4 flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/investor/resources/investing-guide">
              Investing Guide
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/investor/resources/faqs">
              FAQs
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </InvestorLayout>
  );
}