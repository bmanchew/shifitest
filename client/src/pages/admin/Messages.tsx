import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useSearchParams } from "@/hooks/use-search-params";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateTime, getStatusColor, getInitials } from "@/lib/utils";
import {
  Archive,
  Filter,
  MessageCircle,
  MoreHorizontal,
  PlusCircle,
  RefreshCw,
  Search,
  UserCircle,
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import AdminLayout from "@/components/layout/AdminLayout";
import { Link } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Define the schema for creating a new conversation
const newConversationSchema = z.object({
  merchantId: z.number(),
  contractId: z.number().optional().nullable(),
  topic: z.string().min(1, { message: "Topic is required" }),
  message: z.string().min(1, { message: "Initial message is required" }),
  priority: z.string().optional(),
});

// Define the columns for the conversations data table
const conversationsColumns: ColumnDef<any>[] = [
  {
    accessorKey: "id",
    header: "#",
    cell: ({ row }) => <span>#{row.original.id}</span>,
  },
  {
    accessorKey: "topic",
    header: "Topic",
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate" title={row.original.topic}>
        <Link 
          to={`/admin/messages/${row.original.id}`}
          className="text-blue-600 hover:underline font-medium"
        >
          {row.original.topic}
        </Link>
      </div>
    ),
  },
  {
    accessorKey: "merchantName",
    header: "Merchant",
    cell: ({ row }) => (
      <div className="flex items-center space-x-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-blue-100 text-blue-800">
            {getInitials(row.original.merchantName || "Unknown Merchant")}
          </AvatarFallback>
        </Avatar>
        <Link 
          to={`/admin/merchants/${row.original.merchantId}`}
          className="text-blue-600 hover:underline"
        >
          {row.original.merchantName}
        </Link>
      </div>
    ),
  },
  {
    accessorKey: "contractNumber",
    header: "Contract",
    cell: ({ row }) => {
      if (!row.original.contractNumber) return <span className="text-gray-500">N/A</span>;
      
      return (
        <Link 
          to={`/admin/contracts/${row.original.contractId}`}
          className="text-blue-600 hover:underline"
        >
          {row.original.contractNumber}
        </Link>
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
          {status.toUpperCase()}
        </Badge>
      );
    },
  },
  {
    accessorKey: "lastMessageAt",
    header: "Last Message",
    cell: ({ row }) => 
      row.original.lastMessageAt ? 
      formatDateTime(row.original.lastMessageAt) : 
      formatDateTime(row.original.createdAt),
  },
  {
    accessorKey: "unreadCount",
    header: "Unread",
    cell: ({ row }) => {
      if (!row.original.unreadCount) return null;
      
      return (
        <Badge variant="destructive" className="rounded-full px-2">
          {row.original.unreadCount}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const conversation = row.original;
      
      return (
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
              onClick={() => window.location.href = `/admin/messages/${conversation.id}`}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              View Conversation
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => window.location.href = `/admin/merchants/${conversation.merchantId}`}
            >
              <UserCircle className="mr-2 h-4 w-4" />
              View Merchant
            </DropdownMenuItem>
            {conversation.status !== "archived" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => {
                    fetch(`/api/conversations/${conversation.id}/archive`, {
                      method: "POST",
                    })
                      .then((res) => {
                        if (res.ok) {
                          window.location.reload();
                        }
                      })
                      .catch((error) => {
                        console.error("Error archiving conversation:", error);
                      });
                  }}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default function AdminMessages() {
  const { 
    searchParams,
    getParam,
    setParam,
    setParams: updateParams,
    clearParams
  } = useSearchParams();
  
  const { toast } = useToast();
  const [isNewConversationDialogOpen, setIsNewConversationDialogOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(getParam("search") || "");
  
  // Form for new conversation
  const newConversationForm = useForm<z.infer<typeof newConversationSchema>>({
    resolver: zodResolver(newConversationSchema),
    defaultValues: {
      merchantId: 0,
      contractId: null,
      topic: "",
      message: "",
      priority: "normal",
    },
  });
  
  // Effect to update search params when user stops typing
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchValue !== getParam("search")) {
        setParam("search", searchValue || undefined);
      }
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [searchValue, getParam, setParam]);
  
  // Query to fetch conversations
  const { 
    data: conversations = [], 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ["/api/conversations", searchParams.toString()],
    queryFn: async () => {
      const url = `/api/conversations${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to load conversations");
      }
      return response.json();
    },
  });
  
  // Query to fetch merchants (for new conversation)
  const { data: merchants = [] } = useQuery({
    queryKey: ["/api/merchants"],
    queryFn: async () => {
      const response = await fetch("/api/merchants");
      if (!response.ok) {
        throw new Error("Failed to load merchants");
      }
      return response.json();
    },
  });
  
  // Handle creating a new conversation
  const handleCreateConversation = async (values: z.infer<typeof newConversationSchema>) => {
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create conversation");
      }
      
      const data = await response.json();
      
      toast({
        title: "Conversation Created",
        description: "The conversation has been created successfully.",
      });
      
      setIsNewConversationDialogOpen(false);
      newConversationForm.reset();
      
      // Redirect to the new conversation
      window.location.href = `/admin/messages/${data.id}`;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create the conversation. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    updateParams({ status: value === "all" ? null : value });
  };
  
  // Reset filters
  const resetFilters = () => {
    updateParams({
      status: null,
      search: null,
      merchantId: null,
    });
    setSearchValue("");
  };
  
  // Stats for different conversation statuses
  const stats = {
    all: conversations.length || 0,
    active: conversations.filter((c: any) => c.status === "active").length || 0,
    resolved: conversations.filter((c: any) => c.status === "resolved").length || 0,
    archived: conversations.filter((c: any) => c.status === "archived").length || 0,
  };
  
  // Get filtered conversations based on current tab
  const getFilteredConversations = (status: string | null) => {
    if (!status || status === "all") return conversations;
    return conversations.filter((c: any) => c.status === status);
  };
  
  return (
    <AdminLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Messages</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => setIsNewConversationDialogOpen(true)}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              New Conversation
            </Button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2 items-center">
            <Filter className="h-4 w-4" />
            <span className="font-medium text-sm">Filters:</span>
          </div>
          
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search by topic or merchant..."
              className="pl-8"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          
          <Select
            value={params.merchantId || ""}
            onValueChange={(value) => updateParams({ merchantId: value || null })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Merchant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Merchants</SelectItem>
              {merchants.map((merchant: any) => (
                <SelectItem key={merchant.id} value={String(merchant.id)}>
                  {merchant.businessName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear Filters
          </Button>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-full">
                <MessageCircle className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Active</div>
                <div className="text-2xl font-bold">{stats.active}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4 border">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-full">
                <div className="h-5 w-5 rounded-full bg-green-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Resolved</div>
                <div className="text-2xl font-bold">{stats.resolved}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4 border">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gray-100 rounded-full">
                <Archive className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Archived</div>
                <div className="text-2xl font-bold">{stats.archived}</div>
              </div>
            </div>
          </div>
        </div>
        
        <Tabs
          defaultValue={params.status || "all"}
          value={params.status || "all"}
          onValueChange={handleTabChange}
        >
          <TabsList className="grid grid-cols-4 w-full md:w-auto">
            <TabsTrigger value="all">All ({stats.all})</TabsTrigger>
            <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({stats.resolved})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({stats.archived})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <DataTable
              columns={conversationsColumns}
              data={getFilteredConversations(null)}
              showSearch={false}
              isLoading={isLoading}
            />
          </TabsContent>
          
          <TabsContent value="active">
            <DataTable
              columns={conversationsColumns}
              data={getFilteredConversations("active")}
              showSearch={false}
              isLoading={isLoading}
            />
          </TabsContent>
          
          <TabsContent value="resolved">
            <DataTable
              columns={conversationsColumns}
              data={getFilteredConversations("resolved")}
              showSearch={false}
              isLoading={isLoading}
            />
          </TabsContent>
          
          <TabsContent value="archived">
            <DataTable
              columns={conversationsColumns}
              data={getFilteredConversations("archived")}
              showSearch={false}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* New Conversation Dialog */}
      <Dialog open={isNewConversationDialogOpen} onOpenChange={setIsNewConversationDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
            <DialogDescription>
              Start a new conversation with a merchant.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...newConversationForm}>
            <form onSubmit={newConversationForm.handleSubmit(handleCreateConversation)} className="space-y-4">
              <FormField
                control={newConversationForm.control}
                name="merchantId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Merchant</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a merchant" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {merchants.map((merchant: any) => (
                          <SelectItem key={merchant.id} value={String(merchant.id)}>
                            {merchant.businessName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={newConversationForm.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter conversation topic" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={newConversationForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Message</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter your message to the merchant" 
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={newConversationForm.control}
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
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit">Start Conversation</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}