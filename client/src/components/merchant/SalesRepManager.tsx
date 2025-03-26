import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { Plus, RefreshCw, Edit, Save, Users, UserPlus, Phone, Mail, CreditCard, Percent, Target } from "lucide-react";

interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
}

interface SalesRep {
  id: number;
  userId: number;
  merchantId: number;
  active: boolean;
  title: string | null;
  commissionRate: number | null;
  commissionRateType: string | null;
  maxAllowedFinanceAmount: number | null;
  target: number | null;
  notes: string | null;
  user: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
}

const createSalesRepSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  title: z.string().min(1, "Job title is required"),
  commissionRate: z.coerce.number().min(0, "Commission rate must be at least 0"),
  commissionRateType: z.enum(["percentage", "fixed"]),
  maxAllowedFinanceAmount: z.coerce.number().min(0, "Max allowed finance amount must be at least 0").optional(),
  target: z.coerce.number().min(0, "Target amount must be at least 0").optional(),
  notes: z.string().optional()
});

type CreateSalesRepForm = z.infer<typeof createSalesRepSchema>;

export default function SalesRepManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSalesRep, setSelectedSalesRep] = useState<SalesRep | null>(null);

  const merchantId = user?.merchantId;

  const form = useForm<CreateSalesRepForm>({
    resolver: zodResolver(createSalesRepSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      title: "Sales Representative",
      commissionRate: 5,
      commissionRateType: "percentage",
      maxAllowedFinanceAmount: 10000,
      target: 100000,
      notes: ""
    }
  });

  const { data: salesReps, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/sales-reps", merchantId],
    queryFn: async () => {
      if (!merchantId) return { salesReps: [] };
      
      const response = await apiRequest(`/api/sales-reps?merchantId=${merchantId}`);
      return response;
    },
    enabled: !!merchantId
  });

  const createSalesRepMutation = useMutation({
    mutationFn: async (data: any) => {
      // First create the user
      const userResponse = await apiRequest("/api/users", {
        method: "POST",
        data: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          password: "TemporaryPassword123", // Should be changed on first login
          role: "sales_rep"
        }
      });

      if (!userResponse.success) {
        throw new Error(userResponse.message || "Failed to create user");
      }

      // Then create the sales rep
      return await apiRequest("/api/sales-reps", {
        method: "POST",
        data: {
          userId: userResponse.user.id,
          merchantId,
          title: data.title,
          commissionRate: data.commissionRate,
          commissionRateType: data.commissionRateType,
          maxAllowedFinanceAmount: data.maxAllowedFinanceAmount,
          target: data.target,
          notes: data.notes
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-reps"] });
      toast({
        title: "Sales Rep Created",
        description: "The sales representative has been successfully created.",
      });
      setCreateDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create sales representative",
        variant: "destructive"
      });
    }
  });

  const updateSalesRepMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/sales-reps/${data.id}`, {
        method: "PATCH",
        data: {
          active: data.active,
          title: data.title,
          commissionRate: data.commissionRate,
          commissionRateType: data.commissionRateType,
          maxAllowedFinanceAmount: data.maxAllowedFinanceAmount,
          target: data.target,
          notes: data.notes
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-reps"] });
      toast({
        title: "Sales Rep Updated",
        description: "The sales representative has been successfully updated.",
      });
      setEditDialogOpen(false);
      setSelectedSalesRep(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update sales representative",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: CreateSalesRepForm) => {
    createSalesRepMutation.mutate(data);
  };

  const onUpdateSalesRep = () => {
    if (selectedSalesRep) {
      updateSalesRepMutation.mutate(selectedSalesRep);
    }
  };

  const handleToggleActive = (salesRep: SalesRep, active: boolean) => {
    updateSalesRepMutation.mutate({
      id: salesRep.id,
      active
    });
  };

  if (!merchantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Representatives</CardTitle>
          <CardDescription>
            Merchant account not found. Please contact support.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Sales Representatives</CardTitle>
          <CardDescription>
            Manage your sales team and commission structure
          </CardDescription>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Rep
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Add New Sales Representative</DialogTitle>
                <DialogDescription>
                  Create an account for a new sales team member
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john.doe@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Sales Representative" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="commissionRateType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission Type</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select commission type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="fixed">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="commissionRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission Rate</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormDescription>
                            {form.watch("commissionRateType") === "percentage" 
                              ? "% of contract value" 
                              : "$ fixed amount per contract"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="target"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Target</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormDescription>
                            Monthly sales target in dollars
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="maxAllowedFinanceAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Financing Amount</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>
                          Maximum amount this rep can approve without additional review
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="submit" disabled={createSalesRepMutation.isPending}>
                      {createSalesRepMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Create Sales Rep
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="text-center py-4 text-red-500">
            Error loading sales representatives. Please try again.
          </div>
        ) : salesReps?.salesReps?.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No Sales Reps</h3>
            <p className="mt-1 text-sm text-gray-500">
              Add your first sales representative to your team
            </p>
            <div className="mt-6">
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Sales Rep
              </Button>
            </div>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesReps?.salesReps?.map((salesRep: SalesRep) => (
                  <TableRow key={salesRep.id}>
                    <TableCell>
                      <div className="font-medium">
                        {salesRep.user?.firstName} {salesRep.user?.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {salesRep.title || "Sales Representative"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <div className="flex items-center">
                          <Mail className="mr-1 h-3 w-3" />
                          {salesRep.user?.email}
                        </div>
                        {salesRep.user?.phone && (
                          <div className="flex items-center mt-1">
                            <Phone className="mr-1 h-3 w-3" />
                            {salesRep.user.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {salesRep.commissionRateType === "percentage" ? (
                          <>
                            <Percent className="mr-1 h-3 w-3" />
                            {salesRep.commissionRate || 0}%
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-1 h-3 w-3" />
                            ${salesRep.commissionRate || 0}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Target className="mr-1 h-3 w-3" />
                        ${(salesRep.target || 0).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={salesRep.active ? "success" : "secondary"}>
                        {salesRep.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Dialog open={editDialogOpen && selectedSalesRep?.id === salesRep.id} onOpenChange={(open) => {
                          setEditDialogOpen(open);
                          if (!open) setSelectedSalesRep(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedSalesRep(salesRep);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[525px]">
                            {selectedSalesRep && (
                              <>
                                <DialogHeader>
                                  <DialogTitle>Edit Sales Representative</DialogTitle>
                                  <DialogDescription>
                                    Update details for {selectedSalesRep.user?.firstName} {selectedSalesRep.user?.lastName}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="font-medium">Status</span>
                                      <span className="text-xs text-muted-foreground">Activate or deactivate this rep</span>
                                    </div>
                                    <Switch 
                                      checked={selectedSalesRep.active} 
                                      onCheckedChange={(checked) => {
                                        setSelectedSalesRep({
                                          ...selectedSalesRep,
                                          active: checked
                                        });
                                      }} 
                                    />
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-title">Job Title</Label>
                                      <Input 
                                        id="edit-title" 
                                        value={selectedSalesRep.title || ''} 
                                        onChange={(e) => {
                                          setSelectedSalesRep({
                                            ...selectedSalesRep,
                                            title: e.target.value
                                          });
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-commissionRateType">Commission Type</Label>
                                      <Select 
                                        value={selectedSalesRep.commissionRateType || 'percentage'} 
                                        onValueChange={(value) => {
                                          setSelectedSalesRep({
                                            ...selectedSalesRep,
                                            commissionRateType: value
                                          });
                                        }}
                                      >
                                        <SelectTrigger id="edit-commissionRateType">
                                          <SelectValue placeholder="Select commission type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="percentage">Percentage</SelectItem>
                                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-commissionRate">Commission Rate</Label>
                                      <Input 
                                        id="edit-commissionRate" 
                                        type="number" 
                                        value={selectedSalesRep.commissionRate || 0} 
                                        onChange={(e) => {
                                          setSelectedSalesRep({
                                            ...selectedSalesRep,
                                            commissionRate: parseFloat(e.target.value)
                                          });
                                        }}
                                      />
                                      <p className="text-sm text-muted-foreground">
                                        {selectedSalesRep.commissionRateType === "percentage" 
                                          ? "% of contract value" 
                                          : "$ fixed amount per contract"}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-target">Monthly Target</Label>
                                      <Input 
                                        id="edit-target" 
                                        type="number" 
                                        value={selectedSalesRep.target || 0} 
                                        onChange={(e) => {
                                          setSelectedSalesRep({
                                            ...selectedSalesRep,
                                            target: parseFloat(e.target.value)
                                          });
                                        }}
                                      />
                                      <p className="text-sm text-muted-foreground">
                                        Monthly sales target in dollars
                                      </p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="edit-maxAllowedFinanceAmount">Max Financing Amount</Label>
                                    <Input 
                                      id="edit-maxAllowedFinanceAmount" 
                                      type="number" 
                                      value={selectedSalesRep.maxAllowedFinanceAmount || 0} 
                                      onChange={(e) => {
                                        setSelectedSalesRep({
                                          ...selectedSalesRep,
                                          maxAllowedFinanceAmount: parseFloat(e.target.value)
                                        });
                                      }}
                                    />
                                    <p className="text-sm text-muted-foreground">
                                      Maximum amount this rep can approve without additional review
                                    </p>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button 
                                    onClick={onUpdateSalesRep}
                                    disabled={updateSalesRepMutation.isPending}
                                  >
                                    {updateSalesRepMutation.isPending ? (
                                      <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Updating...
                                      </>
                                    ) : (
                                      <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                      </>
                                    )}
                                  </Button>
                                </DialogFooter>
                              </>
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        <Switch 
                          checked={salesRep.active} 
                          onCheckedChange={(checked) => handleToggleActive(salesRep, checked)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}