import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  BarChart3, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  BadgeCheck, 
  Search, 
  Filter, 
  Mail, 
  Loader2,
  MoreHorizontal,
  Eye,
  ShieldCheck,
  ShieldClose,
  AlertCircle
} from 'lucide-react';
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
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';
import DocumentManagement from './DocumentManagement';

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvestorId, setSelectedInvestorId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('investors');
  const [verificationDialog, setVerificationDialog] = useState<{
    isOpen: boolean;
    investorId: number | null;
    currentStatus: string;
    investorName: string;
  }>({
    isOpen: false,
    investorId: null,
    currentStatus: '',
    investorName: ''
  });

  // Fetch all investors
  const investorsQuery = useQuery({
    queryKey: ['/api/admin/investors'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/investors');
      return response.investors;
    }
  });

  // Fetch investment statistics
  const statsQuery = useQuery({
    queryKey: ['/api/admin/investment-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/investment-stats');
      return response.stats;
    }
  });

  // Mutation for updating investor verification status
  const updateVerificationMutation = useMutation({
    mutationFn: async ({ investorId, status, message }: { investorId: number; status: string; message: string }) => {
      return await apiRequest('POST', '/api/investor/kyc/verify', {
        investorId,
        status,
        message
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/investors'] });
      setVerificationDialog({
        isOpen: false,
        investorId: null,
        currentStatus: '',
        investorName: ''
      });
      
      toast({
        title: 'Status Updated',
        description: 'Investor verification status has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update verification status. Please try again.',
        variant: 'destructive',
      });
    }
  });

  // Handle opening the verification dialog
  const openVerificationDialog = (investor: any) => {
    setVerificationDialog({
      isOpen: true,
      investorId: investor.id,
      currentStatus: investor.verificationStatus,
      investorName: investor.legalName
    });
  };

  // Handle verification status update
  const handleVerificationUpdate = (status: string) => {
    if (!verificationDialog.investorId) return;
    
    updateVerificationMutation.mutate({
      investorId: verificationDialog.investorId,
      status,
      message: 'Status updated by admin'
    });
  };

  // Filter investors based on search query and status filter
  const filteredInvestors = investorsQuery.data
    ? investorsQuery.data.filter((investor: any) => {
        const matchesSearch = 
          investor.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          investor.email?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || investor.verificationStatus === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
    : [];

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-100 text-green-800">Verified</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'requires_additional_info':
        return <Badge className="bg-blue-100 text-blue-800">Needs Info</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  if (investorsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (investorsQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <h2 className="text-2xl font-bold text-destructive mb-4">Error Loading Admin Dashboard</h2>
        <p className="text-muted-foreground mb-6">We couldn't load the investor data. Please try again.</p>
        <Button onClick={() => investorsQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  // Mock statistics (should come from API in production)
  const stats = statsQuery.data || {
    totalInvestors: filteredInvestors.length,
    verifiedInvestors: filteredInvestors.filter((i: any) => i.verificationStatus === 'verified').length,
    pendingVerification: filteredInvestors.filter((i: any) => i.verificationStatus === 'pending').length,
    totalInvested: 2350000,
    averageInvestment: 125000
  };

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Investor Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage investors, verify KYC, and monitor investments
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Investors</p>
                <p className="text-3xl font-bold">{stats.totalInvestors}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Verified Investors</p>
                <p className="text-3xl font-bold">{stats.verifiedInvestors}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Verification</p>
                <p className="text-3xl font-bold">{stats.pendingVerification}</p>
              </div>
              <div className="p-2 bg-yellow-100 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Invested</p>
                <p className="text-3xl font-bold">${(stats.totalInvested).toLocaleString()}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="investors">Investors</TabsTrigger>
          <TabsTrigger value="investments">Investments</TabsTrigger>
          <TabsTrigger value="documents">Document Management</TabsTrigger>
          <TabsTrigger value="offerings">Offerings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="investors">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search investors..."
                    className="pl-9 w-full sm:w-[300px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <div className="flex items-center">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Filter by status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending Verification</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="requires_additional_info">Needs More Info</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investor</TableHead>
                    <TableHead className="hidden md:table-cell">Date Registered</TableHead>
                    <TableHead>Verification Status</TableHead>
                    <TableHead className="hidden md:table-cell">KYC Completed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvestors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Users className="h-10 w-10 text-muted-foreground/50 mb-2" />
                          <p className="text-muted-foreground">No investors found matching your criteria.</p>
                          {(searchQuery || statusFilter !== 'all') && (
                            <Button 
                              variant="link" 
                              onClick={() => {
                                setSearchQuery('');
                                setStatusFilter('all');
                              }}
                              className="mt-2"
                            >
                              Clear filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvestors.map((investor: any) => (
                      <TableRow key={investor.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{investor.legalName}</span>
                            <span className="text-sm text-muted-foreground">{investor.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {new Date(investor.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(investor.verificationStatus)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {investor.kycCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem 
                                onClick={() => setLocation(`/admin/investors/${investor.id}`)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openVerificationDialog(investor)}
                              >
                                <BadgeCheck className="mr-2 h-4 w-4" />
                                Update Verification
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  toast({
                                    title: "Email Investor",
                                    description: "Email functionality would be implemented in production.",
                                  });
                                }}
                              >
                                <Mail className="mr-2 h-4 w-4" />
                                Send Email
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="investments">
          <Card className="border-2 border-dashed border-muted/50 bg-muted/20">
            <CardHeader>
              <CardTitle>Investments Management</CardTitle>
              <CardDescription>
                View and manage all investor investments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Investment Management</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-2 mb-4">
                  This section would display all investments across your platform, with reporting, 
                  tracking, and management functionality.
                </p>
                <Button
                  onClick={() => {
                    toast({
                      title: "Section Under Development",
                      description: "This section would be fully implemented in production.",
                    });
                  }}
                >
                  View Investments
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="documents">
          <DocumentManagement adminMode={true} />
        </TabsContent>
        
        <TabsContent value="offerings">
          <Card className="border-2 border-dashed border-muted/50 bg-muted/20">
            <CardHeader>
              <CardTitle>Investment Offerings</CardTitle>
              <CardDescription>
                Create and manage investment offerings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <DollarSign className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Offering Management</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-2 mb-4">
                  This section would allow you to create, edit, and manage investment offerings 
                  available to your investors, including setting terms and available amounts.
                </p>
                <Button
                  onClick={() => {
                    toast({
                      title: "Section Under Development",
                      description: "This section would be fully implemented in production.",
                    });
                  }}
                >
                  Manage Offerings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Dialog 
        open={verificationDialog.isOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setVerificationDialog(prev => ({ ...prev, isOpen: false }));
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Verification Status</DialogTitle>
            <DialogDescription>
              Update the verification status for {verificationDialog.investorName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="mb-4">
              <Label className="text-sm font-medium">Current Status</Label>
              <div className="mt-1">{getStatusBadge(verificationDialog.currentStatus)}</div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Set New Status</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => handleVerificationUpdate('verified')}
                >
                  <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />
                  Approve Verification
                </Button>
                
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => handleVerificationUpdate('rejected')}
                >
                  <ShieldClose className="mr-2 h-4 w-4 text-red-600" />
                  Reject Verification
                </Button>
                
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => handleVerificationUpdate('requires_additional_info')}
                >
                  <AlertCircle className="mr-2 h-4 w-4 text-blue-600" />
                  Request More Information
                </Button>
                
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => handleVerificationUpdate('pending')}
                >
                  <Clock className="mr-2 h-4 w-4 text-yellow-600" />
                  Set to Pending
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setVerificationDialog(prev => ({ ...prev, isOpen: false }))}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}