import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Download, FileText, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

// Document type definition based on schema
interface Document {
  id: number;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  requiresNda: boolean;
  isPublic: boolean;
  uploadedBy: number;
  createdAt: string;
  updatedAt: string;
}

export default function DocumentLibrary() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  // Fetch investor profile to check NDA status
  const profileQuery = useQuery({
    queryKey: ["/api/investor/profile"],
    retry: false,
  });

  // Fetch documents
  const documentsQuery = useQuery({
    queryKey: ["/api/investor/documents"],
    retry: false,
  });

  // Check if NDA is signed
  const isNdaSigned = profileQuery.data?.profile?.ndaSigned || false;
  const isKycVerified = profileQuery.data?.profile?.kycStatus === "verified";

  // Get all unique categories
  const categories = documentsQuery.data?.documents
    ? Array.from(
        new Set(documentsQuery.data.documents.map((doc: Document) => doc.category))
      )
    : [];

  // Filter documents by search query and category
  const filteredDocuments = documentsQuery.data?.documents
    ? documentsQuery.data.documents.filter((doc: Document) => {
        const matchesSearch =
          searchQuery === "" ||
          doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = activeCategory === "all" || doc.category === activeCategory;

        return matchesSearch && matchesCategory;
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Data Room</h1>
      </div>

      {/* NDA Status Alert */}
      {isKycVerified && !isNdaSigned && (
        <Alert className="bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">NDA Required for Full Access</AlertTitle>
          <AlertDescription className="text-blue-700">
            Some documents require a signed NDA. You currently have access to public documents only.
            <Button asChild variant="outline" className="mt-2 bg-white">
              <Link href="/investor/profile">Sign NDA</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!isKycVerified && (
        <Alert className="bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">KYC Verification Required</AlertTitle>
          <AlertDescription className="text-red-700">
            Complete KYC verification to access the data room.
            <Button asChild variant="outline" className="mt-2 bg-white">
              <Link href="/investor/profile">Complete Verification</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Document Library</CardTitle>
          <CardDescription>
            Access financial reports, legal documents, and offering materials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="mb-6 flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search documents..."
                className="w-full pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              <span>Filters</span>
            </Button>
          </div>

          {/* Categories Tabs */}
          <Tabs defaultValue="all" value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="mb-4 w-full overflow-auto">
              <TabsTrigger value="all">All Documents</TabsTrigger>
              {categories.map((category) => (
                <TabsTrigger key={category} value={category} className="capitalize">
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Documents */}
            <TabsContent value={activeCategory} className="mt-0">
              {documentsQuery.isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : documentsQuery.isError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Failed to load documents. Please try again later.
                  </AlertDescription>
                </Alert>
              ) : filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Documents Found</h3>
                  <p className="text-muted-foreground mt-2">
                    {searchQuery
                      ? `No documents match "${searchQuery}"`
                      : "No documents are available in this category"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 divide-y">
                  {filteredDocuments.map((document: Document) => (
                    <DocumentItem
                      key={document.id}
                      document={document}
                      isNdaSigned={isNdaSigned}
                      isKycVerified={isKycVerified}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

interface DocumentItemProps {
  document: Document;
  isNdaSigned: boolean;
  isKycVerified: boolean;
}

function DocumentItem({ document, isNdaSigned, isKycVerified }: DocumentItemProps) {
  const canAccessDocument = 
    isKycVerified && (document.isPublic || !document.requiresNda || isNdaSigned);
  
  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  // Determine document icon based on file type
  const getDocumentTypeIcon = (fileType: string) => {
    if (fileType === "pdf") {
      return <FileText className="h-10 w-10 text-red-500" />;
    } else if (fileType === "docx" || fileType === "doc") {
      return <FileText className="h-10 w-10 text-blue-500" />;
    } else if (fileType === "xlsx" || fileType === "xls") {
      return <FileText className="h-10 w-10 text-green-500" />;
    } else {
      return <FileText className="h-10 w-10 text-gray-500" />;
    }
  };

  return (
    <div className="flex items-start space-x-4 pt-4">
      <div className="flex-shrink-0">{getDocumentTypeIcon(document.fileType)}</div>
      <div className="flex-grow space-y-1">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium">{document.title}</h4>
            <p className="text-sm text-muted-foreground">{document.description}</p>
          </div>
          <div className="flex-shrink-0">
            {document.requiresNda && (
              <Badge variant={isNdaSigned ? "outline" : "secondary"}>
                {isNdaSigned ? "NDA Signed" : "NDA Required"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <span className="capitalize">{document.category}</span>
          <span>•</span>
          <span>{formatFileSize(document.fileSize)}</span>
          <span>•</span>
          <span>
            {new Date(document.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
      <div className="flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          disabled={!canAccessDocument}
          onClick={() => window.open(document.fileUrl, "_blank")}
          className="flex items-center space-x-1"
        >
          <Download className="h-4 w-4" />
          <span>{canAccessDocument ? "Download" : "Restricted"}</span>
        </Button>
      </div>
    </div>
  );
}