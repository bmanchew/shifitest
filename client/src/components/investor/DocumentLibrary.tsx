import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Download,
  Eye,
  FileArchive,
  FileCheck,
  FileHeart,
  FileIcon,
  FileLock2,
  FileSearch,
  FileText,
  FileWarning,
  Filter,
  Lock,
  LockKeyhole,
  Search,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { InvestorLayout } from "./InvestorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";

// Document types
type DocumentCategory =
  | "offering_memorandum"
  | "financial"
  | "legal"
  | "investment"
  | "reporting"
  | "educational"
  | "investor_updates";

type Document = {
  id: number;
  title: string;
  description: string;
  category: DocumentCategory;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  requiresNda: boolean;
  isPublic: boolean;
  offeringId: number | null;
  tags: string[];
  // Access control fields
  canAccess: boolean;
  reasonCannotAccess?: string;
};

type NdaStatus = {
  signed: boolean;
  signedAt: string | null;
  canSign: boolean;
};

// Category configurations
const CATEGORIES: Record<
  DocumentCategory,
  { label: string; icon: React.ReactNode }
> = {
  offering_memorandum: {
    label: "Offering Memorandum",
    icon: <FileHeart className="h-6 w-6" />,
  },
  financial: {
    label: "Financial Documents",
    icon: <FileCheck className="h-6 w-6" />,
  },
  legal: {
    label: "Legal Documents",
    icon: <FileWarning className="h-6 w-6" />,
  },
  investment: {
    label: "Investment Documents",
    icon: <FileArchive className="h-6 w-6" />,
  },
  reporting: {
    label: "Reporting",
    icon: <FileSearch className="h-6 w-6" />,
  },
  educational: {
    label: "Educational",
    icon: <FileText className="h-6 w-6" />,
  },
  investor_updates: {
    label: "Investor Updates",
    icon: <FileText className="h-6 w-6" />,
  },
};

// File type helpers
const getFileIcon = (fileType: string) => {
  if (fileType.includes("pdf")) return <FileText className="h-5 w-5" />;
  if (fileType.includes("word") || fileType.includes("docx"))
    return <FileText className="h-5 w-5" />;
  if (fileType.includes("excel") || fileType.includes("xlsx"))
    return <FileText className="h-5 w-5" />;
  if (fileType.includes("image"))
    return <FileText className="h-5 w-5" />;
  return <FileIcon className="h-5 w-5" />;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Document viewer component
function DocumentViewer({
  document,
  onClose,
}: {
  document: Document;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h3 className="text-lg font-semibold">{document.title}</h3>
          <p className="text-sm text-muted-foreground">
            {document.description || "No description"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(`/api/documents/${document.id}/download`, "_blank")}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download document</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <span className="sr-only">Close</span>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 h-[70vh]">
        {document.fileType.includes("pdf") ? (
          <iframe
            src={`/api/documents/${document.id}/view`}
            className="w-full h-full border rounded-md"
            title={document.title}
          />
        ) : document.fileType.includes("image") ? (
          <div className="flex items-center justify-center h-full">
            <img
              src={`/api/documents/${document.id}/view`}
              alt={document.title}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <FileIcon className="h-24 w-24 text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">
                Preview not available for this file type
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Please download the file to view its contents
              </p>
              <Button
                variant="default"
                size="sm"
                className="mt-4"
                onClick={() => window.open(`/api/documents/${document.id}/download`, "_blank")}
              >
                <Download className="h-4 w-4 mr-2" /> Download File
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// NDA signing component
function NdaSigningDialog({
  open,
  onOpenChange,
  onSign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSign: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Non-Disclosure Agreement</DialogTitle>
          <DialogDescription>
            Please read and agree to the terms of this Non-Disclosure Agreement
            to access confidential documents.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto border rounded-md p-4 text-sm">
          <h3 className="font-semibold mb-2">CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT</h3>
          <p className="mb-4">
            This Confidentiality and Non-Disclosure Agreement (the "Agreement") is entered into
            by and between the undersigned investor ("Recipient") and ShiFi Financial ("Company").
          </p>
          
          <h4 className="font-semibold mt-4 mb-2">1. Purpose</h4>
          <p className="mb-4">
            The purpose of this Agreement is to protect the confidential and proprietary information
            that may be disclosed to the Recipient for the purpose of evaluating potential investment
            opportunities in the Company's offerings ("Purpose").
          </p>
          
          <h4 className="font-semibold mt-4 mb-2">2. Confidential Information</h4>
          <p className="mb-4">
            "Confidential Information" means all non-public information disclosed by the Company to the
            Recipient, including but not limited to financial information, business plans, investment
            memoranda, contract details, merchant information, proprietary methodologies, and any other
            information that should reasonably be recognized as confidential information of the Company.
          </p>
          
          <h4 className="font-semibold mt-4 mb-2">3. Recipient's Obligations</h4>
          <p className="mb-4">
            The Recipient agrees to:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>
              Hold all Confidential Information in strict confidence and not disclose it to any third party;
            </li>
            <li>
              Use the Confidential Information solely for the Purpose and not for any other purpose;
            </li>
            <li>
              Take all reasonable precautions to protect the confidentiality of the Confidential Information;
            </li>
            <li>
              Not copy, reproduce, or distribute any Confidential Information without prior written consent;
            </li>
            <li>
              Return or destroy all Confidential Information upon request of the Company.
            </li>
          </ul>
          
          <h4 className="font-semibold mt-4 mb-2">4. Term and Termination</h4>
          <p className="mb-4">
            This Agreement shall remain in effect for a period of two (2) years from the date of execution.
            The confidentiality obligations shall survive the termination of this Agreement.
          </p>
          
          <h4 className="font-semibold mt-4 mb-2">5. Governing Law</h4>
          <p className="mb-4">
            This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.
          </p>
          
          <h4 className="font-semibold mt-4 mb-2">6. Electronic Signature</h4>
          <p className="mb-4">
            By checking the box below and clicking "I Agree", the Recipient acknowledges that they have read,
            understand, and agree to be bound by the terms of this Agreement. This electronic signature shall
            have the same legal effect as a handwritten signature.
          </p>
        </div>
        <div className="flex items-center space-x-2 mt-4">
          <Checkbox id="terms" checked={agreed} onCheckedChange={(checked) => setAgreed(!!checked)} />
          <label
            htmlFor="terms"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            I have read and agree to the terms of the Non-Disclosure Agreement
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSign} disabled={!agreed}>
            I Agree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Document card component
function DocumentCard({ document }: { document: Document }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const queryClient = useQueryClient();

  // NDA signing mutation
  const signNdaMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/investor/documents/sign-nda", "POST");
    },
    onSuccess: () => {
      toast.success("NDA signed successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/investor/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/investor/profile"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to sign NDA: ${error.message || "Unknown error"}`);
    },
  });
  
  const [ndaDialogOpen, setNdaDialogOpen] = useState(false);

  const handleSignNda = () => {
    signNdaMutation.mutate();
    setNdaDialogOpen(false);
  };

  return (
    <>
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start mb-1">
            <CardTitle className="text-lg">{document.title}</CardTitle>
            {document.requiresNda && (
              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                <LockKeyhole className="h-3 w-3 mr-1" /> NDA Required
              </Badge>
            )}
          </div>
          <CardDescription className="line-clamp-2">
            {document.description || "No description provided"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <div className="grid grid-cols-2 gap-y-2 text-sm mb-4">
            <div className="text-muted-foreground">Category</div>
            <div>{CATEGORIES[document.category]?.label || document.category}</div>
            
            <div className="text-muted-foreground">File Type</div>
            <div className="flex items-center gap-1">
              {getFileIcon(document.fileType)}
              <span>{document.fileType.split("/")[1]?.toUpperCase() || 'Unknown'}</span>
            </div>
            
            <div className="text-muted-foreground">Size</div>
            <div>{formatFileSize(document.fileSize)}</div>
            
            <div className="text-muted-foreground">Uploaded</div>
            <div>{formatDate(document.uploadedAt)}</div>
          </div>
          
          {document.tags && document.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {document.tags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t pt-3">
          {document.canAccess ? (
            <div className="w-full grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setViewerOpen(true)}
              >
                <Eye className="h-4 w-4 mr-2" /> View
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(`/api/documents/${document.id}/download`, "_blank")}
              >
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
            </div>
          ) : (
            <div className="w-full">
              <Button 
                className="w-full"
                size="sm"
                onClick={() => {
                  if (document.requiresNda) {
                    setNdaDialogOpen(true);
                  } else {
                    toast.error(document.reasonCannotAccess || "You don't have access to this document. Please complete your profile verification.");
                  }
                }}
              >
                <Lock className="h-4 w-4 mr-2" /> 
                {document.requiresNda ? "Sign NDA to Access" : "Verification Required"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {document.reasonCannotAccess || "Complete verification to access this document"}
              </p>
            </div>
          )}
        </CardFooter>
      </Card>
      
      {/* Document viewer dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DocumentViewer document={document} onClose={() => setViewerOpen(false)} />
        </DialogContent>
      </Dialog>
      
      {/* NDA Signing Dialog */}
      <NdaSigningDialog 
        open={ndaDialogOpen} 
        onOpenChange={setNdaDialogOpen} 
        onSign={handleSignNda} 
      />
    </>
  );
}

// Document Library Filters
function DocumentFilters({
  filters,
  setFilters,
  onClose,
}: {
  filters: {
    category: string;
    searchQuery: string;
    onlyAccessible: boolean;
  };
  setFilters: React.Dispatch<
    React.SetStateAction<{
      category: string;
      searchQuery: string;
      onlyAccessible: boolean;
    }>
  >;
  onClose?: () => void;
}) {
  const [tempFilters, setTempFilters] = useState(filters);

  const handleReset = () => {
    setTempFilters({
      category: "all",
      searchQuery: "",
      onlyAccessible: false,
    });
  };

  const handleApply = () => {
    setFilters(tempFilters);
    if (onClose) onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block" htmlFor="category-filter">
          Document Category
        </label>
        <Select
          value={tempFilters.category}
          onValueChange={(value) =>
            setTempFilters({ ...tempFilters, category: value })
          }
        >
          <SelectTrigger id="category-filter" className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORIES).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block" htmlFor="search-filter">
          Search Documents
        </label>
        <Input
          id="search-filter"
          placeholder="Search by title or description"
          value={tempFilters.searchQuery}
          onChange={(e) =>
            setTempFilters({ ...tempFilters, searchQuery: e.target.value })
          }
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="accessible-filter"
          checked={tempFilters.onlyAccessible}
          onCheckedChange={(checked) =>
            setTempFilters({
              ...tempFilters,
              onlyAccessible: !!checked,
            })
          }
        />
        <label
          htmlFor="accessible-filter"
          className="text-sm font-medium leading-none"
        >
          Show only accessible documents
        </label>
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
    category: string;
    searchQuery: string;
    onlyAccessible: boolean;
  };
  setFilters: React.Dispatch<
    React.SetStateAction<{
      category: string;
      searchQuery: string;
      onlyAccessible: boolean;
    }>
  >;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Document Filters</SheetTitle>
          <SheetDescription>
            Filter the documents by category and access level.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <DocumentFilters
            filters={filters}
            setFilters={setFilters}
            onClose={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Main component
export default function DocumentLibrary() {
  const [filters, setFilters] = useState({
    category: "all",
    searchQuery: "",
    onlyAccessible: false,
  });

  // Fetch documents
  const documentsQuery = useQuery({
    queryKey: ["/api/investor/documents", filters],
    retry: false,
  });

  // Fetch NDA status
  const ndaStatusQuery = useQuery({
    queryKey: ["/api/investor/nda-status"],
    retry: false,
  });

  // Loading states
  const isLoading = documentsQuery.isLoading || ndaStatusQuery.isLoading;
  
  // Extract data
  const documents = documentsQuery.data?.documents || [];
  const ndaStatus = ndaStatusQuery.data?.ndaStatus || { 
    signed: false, 
    signedAt: null,
    canSign: false,
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc: Document) => {
    // Apply category filter
    if (filters.category !== "all" && doc.category !== filters.category) {
      return false;
    }
    
    // Apply search query
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      const titleMatch = doc.title.toLowerCase().includes(searchLower);
      const descMatch = doc.description?.toLowerCase().includes(searchLower);
      if (!titleMatch && !descMatch) {
        return false;
      }
    }
    
    // Apply accessibility filter
    if (filters.onlyAccessible && !doc.canAccess) {
      return false;
    }
    
    return true;
  });

  // Group documents by category
  const documentsByCategory = filteredDocuments.reduce((acc: Record<string, Document[]>, doc: Document) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {});

  // Query client for mutations
  const queryClient = useQueryClient();
  
  // NDA signing mutation
  const signNdaMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/investor/documents/sign-nda", "POST");
    },
    onSuccess: () => {
      toast.success("NDA signed successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/investor/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/investor/profile"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to sign NDA: ${error.message || "Unknown error"}`);
    },
  });

  const [ndaDialogOpen, setNdaDialogOpen] = useState(false);

  const handleSignNda = () => {
    signNdaMutation.mutate();
    setNdaDialogOpen(false);
  };

  return (
    <InvestorLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Investor Data Room
        </h1>
        <p className="text-muted-foreground">
          Access important documents, offering memoranda, and educational resources.
        </p>
      </div>

      {/* NDA Status Card */}
      {!ndaStatus.signed && ndaStatus.canSign && (
        <Card className="mb-6 bg-amber-50 border-amber-200">
          <CardHeader className="pb-3">
            <div className="flex items-center">
              <LockKeyhole className="h-5 w-5 mr-2 text-amber-600" />
              <CardTitle className="text-lg text-amber-800">NDA Required</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-amber-800">
              Some documents require a signed Non-Disclosure Agreement (NDA) to access.
              Sign the NDA now to get full access to all investment documents.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="default" onClick={() => setNdaDialogOpen(true)}>
              Sign NDA Now
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* NDA Status Card (Already Signed) */}
      {ndaStatus.signed && (
        <Card className="mb-6 bg-emerald-50 border-emerald-200">
          <CardHeader className="pb-3">
            <div className="flex items-center">
              <Shield className="h-5 w-5 mr-2 text-emerald-600" />
              <CardTitle className="text-lg text-emerald-800">NDA In Place</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-emerald-800">
              You have signed the Non-Disclosure Agreement on {formatDate(ndaStatus.signedAt!)}. 
              You have full access to all protected documents.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-9"
            value={filters.searchQuery}
            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          {/* Mobile filters */}
          <MobileFiltersSheet filters={filters} setFilters={setFilters} />
          
          {/* Desktop filters */}
          <div className="hidden lg:block">
            <Select
              value={filters.category}
              onValueChange={(value) => setFilters({ ...filters, category: value })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORIES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="hidden sm:flex items-center space-x-2">
            <Checkbox
              id="accessible-filter-top"
              checked={filters.onlyAccessible}
              onCheckedChange={(checked) =>
                setFilters({
                  ...filters,
                  onlyAccessible: !!checked,
                })
              }
            />
            <label
              htmlFor="accessible-filter-top"
              className="text-sm font-medium leading-none whitespace-nowrap"
            >
              Accessible only
            </label>
          </div>
        </div>
      </div>

      {/* Document list by categories */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-[300px]">
              <CardHeader>
                <div className="h-6 w-2/3 bg-muted animate-pulse rounded-md mb-2"></div>
                <div className="h-4 w-full bg-muted animate-pulse rounded-md"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="flex justify-between">
                      <div className="h-4 w-1/3 bg-muted animate-pulse rounded-md"></div>
                      <div className="h-4 w-1/3 bg-muted animate-pulse rounded-md"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="border-t mt-auto">
                <div className="h-8 w-full bg-muted animate-pulse rounded-md"></div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center">
            <FileSearch className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Documents Found</h3>
            <p className="text-muted-foreground mb-6">
              {filters.searchQuery || filters.category !== "all" || filters.onlyAccessible
                ? "No documents match your current filters."
                : "There are currently no documents available in the data room."}
            </p>
            {(filters.searchQuery || filters.category !== "all" || filters.onlyAccessible) && (
              <Button onClick={() => setFilters({ category: "all", searchQuery: "", onlyAccessible: false })}>
                Clear Filters
              </Button>
            )}
          </div>
        </Card>
      ) : filters.category !== "all" ? (
        // Single category view
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc: Document) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      ) : (
        // All categories view
        <div className="space-y-10">
          {Object.entries(documentsByCategory).map(([category, docs]) => (
            <div key={category}>
              <div className="flex items-center mb-4">
                <div className="flex items-center gap-2">
                  {CATEGORIES[category as DocumentCategory]?.icon || <FileText className="h-6 w-6" />}
                  <h2 className="text-xl font-semibold">
                    {CATEGORIES[category as DocumentCategory]?.label || category}
                  </h2>
                </div>
                <Separator className="ml-4 flex-grow" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {docs.map((doc: Document) => (
                  <DocumentCard key={doc.id} document={doc} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NDA Signing Dialog */}
      <NdaSigningDialog 
        open={ndaDialogOpen} 
        onOpenChange={setNdaDialogOpen} 
        onSign={handleSignNda} 
      />
    </InvestorLayout>
  );
}

// X icon for document viewer close button
function X(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}