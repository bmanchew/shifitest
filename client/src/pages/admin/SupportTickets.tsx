import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useSearchParams } from "@/hooks/use-search-params";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateTime, getStatusColor } from "@/lib/utils";
import {
  Check,
  Clock,
  Edit,
  Filter,
  MessageCircle,
  MoreHorizontal,
  PlusCircle,
  RefreshCw,
  UserCircle,
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import AdminLayout from "@/components/layout/AdminLayout";
import { Link } from "wouter";

// Define ticket status options
const statusOptions = [
  { label: "New", value: "new" },
  { label: "In Progress", value: "in_progress" },
  { label: "Pending Merchant", value: "pending_merchant" },
  { label: "Pending Customer", value: "pending_customer" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

// Define ticket priority options
const priorityOptions = [
  { label: "Low", value: "low" },
  { label: "Normal", value: "normal" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

// Define ticket category options
const categoryOptions = [
  { label: "Accounting", value: "accounting" },
  { label: "Customer Issue", value: "customer_issue" },
  { label: "Technical Issue", value: "technical_issue" },
  { label: "Other", value: "other" },
];

// Define the schema for updating a ticket
const updateTicketSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.number().optional().nullable(),
  notes: z.string().optional(),
});

// Define the schema for creating a ticket
const createTicketSchema = z.object({
  merchantId: z.number(),
  contractId: z.number().optional().nullable(),
  topic: z.string().min(1, { message: "Topic is required" }),
  category: z.string().min(1, { message: "Category is required" }),
  description: z.string().min(1, { message: "Description is required" }),
  priority: z.string().min(1, { message: "Priority is required" }),
  assignedTo: z.number().optional().nullable(),
});

export default function AdminSupportTickets() {
  const { params, updateParams } = useSearchParams<{
    status?: string;
    category?: string;
    priority?: string;
    assignedTo?: string;
  }>();
  
  const { toast } = useToast();
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isNewTicketDialogOpen, setIsNewTicketDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  
  // Query to fetch admin users for assignment
  const { data: admins } = useQuery({
    queryKey: ["/api/users/admins"],
    queryFn: async () => {
      const response = await fetch("/api/users/admins");
      if (!response.ok) {
        throw new Error("Failed to fetch admin users");
      }
      return response.json();
    },
  });
  
  // Query to fetch support tickets with optional filters
  const { data: tickets = [], isLoading: isLoadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ["/api/support-tickets", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.status) queryParams.append("status", params.status);
      if (params.category) queryParams.append("category", params.category);
      if (params.priority) queryParams.append("priority", params.priority);
      if (params.assignedTo) queryParams.append("assignedTo", params.assignedTo);
      
      const url = `/api/support-tickets${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch support tickets");
      }
      return response.json();
    },
  });
  
  // Form for updating a ticket
  const updateForm = useForm<z.infer<typeof updateTicketSchema>>({
    resolver: zodResolver(updateTicketSchema),
    defaultValues: {
      status: "",
      priority: "",
      assignedTo: null,
      notes: "",
    },
  });
  
  // Form for creating a new ticket
  const createForm = useForm<z.infer<typeof createTicketSchema>>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      merchantId: 0,
      contractId: null,
      topic: "",
      category: "",
      description: "",
      priority: "normal",
      assignedTo: null,
    },
  });
  
  // Handle updating a ticket
  const handleUpdateTicket = async (values: z.infer<typeof updateTicketSchema>) => {
    if (!selectedTicket) return;
    
    try {
      const response = await fetch(`/api/support-tickets/${selectedTicket.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update ticket");
      }
      
      await refetchTickets();
      toast({
        title: "Ticket Updated",
        description: "The support ticket has been updated successfully.",
      });
      setIsUpdateDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update the ticket. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Handle creating a new ticket
  const handleCreateTicket = async (values: z.infer<typeof createTicketSchema>) => {
    try {
      const response = await fetch("/api/support-tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create ticket");
      }
      
      await refetchTickets();
      toast({
        title: "Ticket Created",
        description: "The support ticket has been created successfully.",
      });
      setIsNewTicketDialogOpen(false);
      createForm.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create the ticket. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Open the update dialog for a ticket
  const openUpdateDialog = (ticket: any) => {
    setSelectedTicket(ticket);
    updateForm.reset({
      status: ticket.status,
      priority: ticket.priority,
      assignedTo: ticket.assignedTo,
      notes: "",
    });
    setIsUpdateDialogOpen(true);
  };
  
  // Handle tab change for filtering by status
  const handleTabChange = (value: string) => {
    updateParams({ status: value === "all" ? null : value });
  };
  
  // Reset all filters
  const resetFilters = () => {
    updateParams({
      status: null,
      category: null,
      priority: null,
      assignedTo: null,
    });
  };
  
  // Define table columns
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "ticketNumber",
      header: "Ticket #",
      cell: ({ row }) => (
        <Link
          to={`/admin/support-tickets/${row.original.id}`}
          className="text-blue-600 hover:underline font-medium"
        >
          {row.original.ticketNumber}
        </Link>
      ),
    },
    {
      accessorKey: "topic",
      header: "Topic",
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate" title={row.original.topic}>
          {row.original.topic}
        </div>
      ),
    },
    {
      accessorKey: "merchantName",
      header: "Merchant",
      cell: ({ row }) => (
        <Link
          to={`/admin/merchants/${row.original.merchantId}`}
          className="text-blue-600 hover:underline"
        >
          {row.original.merchantName}
        </Link>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const category = row.original.category;
        return (
          <div className="capitalize">
            {category.replace("_", " ")}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge className={getStatusColor(status)}>
            {status.replace("_", " ").toUpperCase()}
          </Badge>
        );
      },
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => {
        const priority = row.original.priority;
        return (
          <Badge className={getStatusColor(priority)}>
            {priority.toUpperCase()}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      accessorKey: "updatedAt",
      header: "Last Updated",
      cell: ({ row }) => formatDateTime(row.original.updatedAt),
    },
    {
      accessorKey: "assignedToName",
      header: "Assigned To",
      cell: ({ row }) => row.original.assignedToName || "Unassigned",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => openUpdateDialog(row.original)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Update Status
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => window.location.href = `/admin/support-tickets/${row.original.id}`}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              View Conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
  
  // Group tickets by status for stats
  const stats = {
    all: tickets.length || 0,
    new: tickets.filter(t => t.status === "new").length || 0,
    in_progress: tickets.filter(t => t.status === "in_progress").length || 0,
    pending_merchant: tickets.filter(t => t.status === "pending_merchant").length || 0,
    pending_customer: tickets.filter(t => t.status === "pending_customer").length || 0,
    resolved: tickets.filter(t => t.status === "resolved").length || 0,
    closed: tickets.filter(t => t.status === "closed").length || 0,
    urgent: tickets.filter(t => t.priority === "urgent").length || 0,
  };
  
  return (
    <AdminLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchTickets()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => setIsNewTicketDialogOpen(true)}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2 items-center">
            <Filter className="h-4 w-4" />
            <span className="font-medium text-sm">Filters:</span>
          </div>
          
          <Select
            value={params.category || ""}
            onValueChange={(value) => updateParams({ category: value || null })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {categoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select
            value={params.priority || ""}
            onValueChange={(value) => updateParams({ priority: value || null })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Priorities</SelectItem>
              {priorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select
            value={params.assignedTo || ""}
            onValueChange={(value) => updateParams({ assignedTo: value || null })}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Assigned To" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Agents</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {admins?.map((admin: any) => (
                <SelectItem key={admin.id} value={String(admin.id)}>
                  {admin.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear Filters
          </Button>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-full">
                <MessageCircle className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Tickets</div>
                <div className="text-2xl font-bold">{stats.all}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4 border">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-yellow-100 rounded-full">
                <Clock className="h-5 w-5 text-yellow-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Pending Response</div>
                <div className="text-2xl font-bold">{stats.pending_merchant + stats.pending_customer}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4 border">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-full">
                <Check className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Resolved</div>
                <div className="text-2xl font-bold">{stats.resolved}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4 border">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-full">
                <UserCircle className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Urgent</div>
                <div className="text-2xl font-bold">{stats.urgent}</div>
              </div>
            </div>
          </div>
        </div>
        
        <Tabs
          defaultValue={params.status || "all"}
          onValueChange={handleTabChange}
          value={params.status || "all"}
        >
          <TabsList className="grid grid-cols-7 w-full md:w-auto">
            <TabsTrigger value="all">All ({stats.all})</TabsTrigger>
            <TabsTrigger value="new">New ({stats.new})</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress ({stats.in_progress})</TabsTrigger>
            <TabsTrigger value="pending_merchant">Pending Merchant ({stats.pending_merchant})</TabsTrigger>
            <TabsTrigger value="pending_customer">Pending Customer ({stats.pending_customer})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({stats.resolved})</TabsTrigger>
            <TabsTrigger value="closed">Closed ({stats.closed})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <DataTable
              columns={columns}
              data={tickets}
              showSearch={true}
              searchKey="topic"
              placeholder="Search tickets..."
            />
          </TabsContent>
          
          <TabsContent value="new">
            <DataTable
              columns={columns}
              data={tickets.filter((t) => t.status === "new")}
              showSearch={true}
              searchKey="topic"
              placeholder="Search new tickets..."
            />
          </TabsContent>
          
          <TabsContent value="in_progress">
            <DataTable
              columns={columns}
              data={tickets.filter((t) => t.status === "in_progress")}
              showSearch={true}
              searchKey="topic"
              placeholder="Search in-progress tickets..."
            />
          </TabsContent>
          
          <TabsContent value="pending_merchant">
            <DataTable
              columns={columns}
              data={tickets.filter((t) => t.status === "pending_merchant")}
              showSearch={true}
              searchKey="topic"
              placeholder="Search tickets pending merchant..."
            />
          </TabsContent>
          
          <TabsContent value="pending_customer">
            <DataTable
              columns={columns}
              data={tickets.filter((t) => t.status === "pending_customer")}
              showSearch={true}
              searchKey="topic"
              placeholder="Search tickets pending customer..."
            />
          </TabsContent>
          
          <TabsContent value="resolved">
            <DataTable
              columns={columns}
              data={tickets.filter((t) => t.status === "resolved")}
              showSearch={true}
              searchKey="topic"
              placeholder="Search resolved tickets..."
            />
          </TabsContent>
          
          <TabsContent value="closed">
            <DataTable
              columns={columns}
              data={tickets.filter((t) => t.status === "closed")}
              showSearch={true}
              searchKey="topic"
              placeholder="Search closed tickets..."
            />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Update Ticket Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Support Ticket</DialogTitle>
            <DialogDescription>
              Update the status, priority, or assignment of this support ticket.
            </DialogDescription>
          </DialogHeader>
          
          {selectedTicket && (
            <Form {...updateForm}>
              <form onSubmit={updateForm.handleSubmit(handleUpdateTicket)} className="space-y-4">
                <div className="grid gap-4">
                  <FormField
                    control={updateForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={updateForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {priorityOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={updateForm.control}
                    name="assignedTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned To</FormLabel>
                        <Select
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(value) => field.onChange(value ? Number(value) : null)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Assign to admin" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Unassigned</SelectItem>
                            {admins?.map((admin: any) => (
                              <SelectItem key={admin.id} value={String(admin.id)}>
                                {admin.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={updateForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add internal notes about this update (optional)"
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          These notes will be saved with the ticket but not sent to the merchant.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <DialogFooter>
                  <Button type="submit">Save Changes</Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Create New Ticket Dialog */}
      <Dialog open={isNewTicketDialogOpen} onOpenChange={setIsNewTicketDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>
              Create a new support ticket for a merchant.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateTicket)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="merchantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Merchant ID</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter merchant ID"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="contractId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract ID (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter contract ID if applicable"
                          value={field.value || ""}
                          onChange={(e) => 
                            field.onChange(e.target.value ? Number(e.target.value) : null)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Topic</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter ticket topic" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {priorityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(value) => field.onChange(value ? Number(value) : null)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Assign to admin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Unassigned</SelectItem>
                          {admins?.map((admin: any) => (
                            <SelectItem key={admin.id} value={String(admin.id)}>
                              {admin.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter detailed description of the issue"
                          className="min-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button type="submit">Create Ticket</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}