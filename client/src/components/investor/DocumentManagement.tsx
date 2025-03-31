import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileIcon, 
  FileTextIcon, 
  LockIcon, 
  CheckIcon, 
  DownloadIcon, 
  PlusIcon, 
  Loader2, 
  FileUpIcon, 
  User2Icon,
  CalendarIcon,
  Search
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';

// Schema for the NDA signing form
const ndaFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  title: z.string().min(1, "Title is required"),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms to continue"
  })
});

type NdaFormValues = z.infer<typeof ndaFormSchema>;

// Schema for uploading documents (admin only)
const uploadDocumentSchema = z.object({
  fileName: z.string().min(1, "Filename is required"),
  documentType: z.string().min(1, "Document type is required"),
  description: z.string().min(1, "Description is required"),
  fileUrl: z.string().url("Please enter a valid URL"),
  isPublic: z.boolean().default(false),
  requiresNda: z.boolean().default(true),
  category: z.string().min(1, "Category is required")
});

type UploadDocumentValues = z.infer<typeof uploadDocumentSchema>;

interface DocumentManagementProps {
  adminMode?: boolean;
}

export default function DocumentManagement({ adminMode = false }: DocumentManagementProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isNdaSigned, setIsNdaSigned] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [isSubmittingNda, setIsSubmittingNda] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);

  // NDA Form
  const ndaForm = useForm<NdaFormValues>({
    resolver: zodResolver(ndaFormSchema),
    defaultValues: {
      fullName: '',
      title: '',
      agreeToTerms: false
    }
  });

  // Upload document form (admin)
  const uploadForm = useForm<UploadDocumentValues>({
    resolver: zodResolver(uploadDocumentSchema),
    defaultValues: {
      fileName: '',
      documentType: 'contract',
      description: '',
      fileUrl: '',
      isPublic: false,
      requiresNda: true,
      category: 'offering'
    }
  });

  // Get profile to check NDA status
  const profileQuery = useQuery({
    queryKey: ['/api/investor/profile'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/investor/profile');
      return response.profile;
    },
    enabled: !adminMode
  });

  // Fetch documents
  const documentsQuery = useQuery({
    queryKey: ['/api/investor/documents'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/investor/documents');
      return response.documents;
    }
  });

  // Mutation for signing NDA
  const signNdaMutation = useMutation({
    mutationFn: async (data: NdaFormValues) => {
      return await apiRequest('POST', '/api/investor/documents/sign-nda', {
        fullName: data.fullName,
        title: data.title
      });
    },
    onSuccess: () => {
      setIsNdaSigned(true);
      queryClient.invalidateQueries({ queryKey: ['/api/investor/profile'] });
      
      toast({
        title: 'NDA Signed Successfully',
        description: 'You now have access to confidential documents.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error Signing NDA',
        description: error instanceof Error ? error.message : 'Failed to sign NDA. Please try again.',
        variant: 'destructive',
      });
    }
  });

  // Mutation for uploading documents (admin only)
  const uploadDocumentMutation = useMutation({
    mutationFn: async (data: UploadDocumentValues) => {
      return await apiRequest('POST', '/api/investor/documents', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investor/documents'] });
      setIsDocumentDialogOpen(false);
      uploadForm.reset();
      
      toast({
        title: 'Document Uploaded',
        description: 'Document has been successfully added to the data room.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload document. Please try again.',
        variant: 'destructive',
      });
    }
  });

  // Submit NDA signing form
  const onSubmitNda = (data: NdaFormValues) => {
    setIsSubmittingNda(true);
    signNdaMutation.mutate(data);
  };

  // Submit document upload form (admin only)
  const onSubmitUpload = (data: UploadDocumentValues) => {
    uploadDocumentMutation.mutate(data);
  };

  // Get document by ID
  const getDocumentById = (id: number) => {
    if (!documentsQuery.data) return null;
    return documentsQuery.data.find((doc: any) => doc.id === id);
  };

  // Download document
  const handleDownload = async (documentId: number) => {
    try {
      const response = await apiRequest('GET', `/api/investor/documents/${documentId}`);
      if (response.downloadUrl) {
        window.open(response.downloadUrl, '_blank');
      } else {
        toast({
          title: 'Download Failed',
          description: 'Failed to generate download link.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download document. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Filter documents based on search query
  const filteredDocuments = documentsQuery.data
    ? documentsQuery.data.filter((doc: any) => 
        doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Check if NDA needs to be signed
  const needsNdaSigning = !adminMode && 
    profileQuery.data && 
    !profileQuery.data.documentVerificationCompleted && 
    !isNdaSigned;

  if (documentsQuery.isLoading || (!adminMode && profileQuery.isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (documentsQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <h2 className="text-2xl font-bold text-destructive mb-4">Error Loading Documents</h2>
        <p className="text-muted-foreground mb-6">We couldn't load the documents. Please try again.</p>
        <Button onClick={() => documentsQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  if (needsNdaSigning) {
    return (
      <div className="container mx-auto max-w-xl py-8 px-4">
        <Card className="border-2 border-primary/10 shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <LockIcon className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">Non-Disclosure Agreement Required</CardTitle>
            <CardDescription>
              To access confidential documents, you must sign an NDA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...ndaForm}>
              <form onSubmit={ndaForm.handleSubmit(onSubmitNda)} className="space-y-6">
                <FormField
                  control={ndaForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Legal Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={ndaForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title/Position</FormLabel>
                      <FormControl>
                        <Input placeholder="Investor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="p-4 bg-muted/50 rounded-lg border space-y-2 text-sm">
                  <p>
                    <strong>Non-Disclosure Agreement (NDA) Summary:</strong>
                  </p>
                  <p>
                    This NDA is between you and ShiFi Investments. By signing, you agree to keep all confidential information 
                    accessed through the data room private and secure.
                  </p>
                  <p>
                    Confidential information includes financial data, investment strategies, business models, contract details, 
                    and any other non-public information.
                  </p>
                  <p>
                    You agree not to disclose this information to any third parties without written permission from ShiFi Investments.
                  </p>
                  <p>
                    <a 
                      href="#" 
                      className="text-primary hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        toast({
                          title: "Full NDA Document",
                          description: "The full NDA document would open in a new window in a production environment.",
                        });
                      }}
                    >
                      Click here to read the full NDA document
                    </a>
                  </p>
                </div>
                
                <FormField
                  control={ndaForm.control}
                  name="agreeToTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <Label htmlFor="agree-terms">
                            I agree to the terms of the Non-Disclosure Agreement
                          </Label>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmittingNda}
                >
                  {isSubmittingNda ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Sign NDA and Access Documents
                      <FileTextIcon className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Investment Data Room</h1>
          <p className="text-muted-foreground mt-1">
            Access confidential documents related to your investments
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search documents..."
              className="pl-9 w-full sm:w-[300px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {adminMode && (
            <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Add Document
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle>Add New Document</DialogTitle>
                  <DialogDescription>
                    Upload a new document to the investor data room.
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...uploadForm}>
                  <form onSubmit={uploadForm.handleSubmit(onSubmitUpload)} className="space-y-4">
                    <FormField
                      control={uploadForm.control}
                      name="fileName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Q1 2023 Performance Report" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={uploadForm.control}
                        name="documentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Type</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="contract">Contract</SelectItem>
                                <SelectItem value="financial">Financial Report</SelectItem>
                                <SelectItem value="legal">Legal Document</SelectItem>
                                <SelectItem value="presentation">Presentation</SelectItem>
                                <SelectItem value="prospectus">Prospectus</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={uploadForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="offering">Investment Offering</SelectItem>
                                <SelectItem value="legal">Legal</SelectItem>
                                <SelectItem value="financial">Financial</SelectItem>
                                <SelectItem value="regulatory">Regulatory</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={uploadForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Brief description of the document content" 
                              className="resize-none"
                              rows={3}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={uploadForm.control}
                      name="fileUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>File URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/document.pdf" {...field} />
                          </FormControl>
                          <FormDescription>
                            Enter a URL where the document is stored
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex space-x-4">
                      <FormField
                        control={uploadForm.control}
                        name="isPublic"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-0.5">
                              <FormLabel>Public Document</FormLabel>
                              <FormDescription>
                                Make accessible to all investors
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={uploadForm.control}
                        name="requiresNda"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-0.5">
                              <FormLabel>Requires NDA</FormLabel>
                              <FormDescription>
                                Investor must sign NDA to access
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDocumentDialogOpen(false)} type="button">
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={uploadDocumentMutation.isPending}
                      >
                        {uploadDocumentMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <FileUpIcon className="mr-2 h-4 w-4" />
                            Upload Document
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Documents</TabsTrigger>
          <TabsTrigger value="offerings">Offering Documents</TabsTrigger>
          <TabsTrigger value="financial">Financial Reports</TabsTrigger>
          <TabsTrigger value="legal">Legal Documents</TabsTrigger>
        </TabsList>
        
        {['all', 'offerings', 'financial', 'legal'].map(tab => (
          <TabsContent key={tab} value={tab} className="pt-2">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="hidden md:table-cell">Category</TableHead>
                      <TableHead className="hidden md:table-cell">Added On</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <FileIcon className="h-10 w-10 text-muted-foreground/50 mb-2" />
                            <p className="text-muted-foreground">No documents found.</p>
                            {searchQuery && (
                              <Button 
                                variant="link" 
                                onClick={() => setSearchQuery('')}
                                className="mt-2"
                              >
                                Clear search
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDocuments
                        .filter((doc: any) => tab === 'all' || doc.category === tab)
                        .map((document: any) => (
                          <TableRow key={document.id}>
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <FileTextIcon className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{document.fileName}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-[300px]">
                                    {document.description}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {document.documentType}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge variant="outline">
                                {document.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center">
                                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                {new Date(document.createdAt).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              {document.requiresNda ? (
                                <Badge variant={document.isPublic ? "secondary" : "outline"}>
                                  {document.isPublic ? "Public - NDA" : "Confidential"}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Public</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(document.id)}
                              >
                                <DownloadIcon className="h-4 w-4" />
                                <span className="sr-only">Download</span>
                              </Button>
                              {adminMode && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    toast({
                                      title: "Edit Document",
                                      description: "Edit document functionality would be implemented in production.",
                                    });
                                  }}
                                >
                                  <User2Icon className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}