import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2, Plus, Search, Filter } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { getStatusColor, formatDate } from "@/lib/utils";
import MerchantLayout from "@/components/layout/MerchantLayout";

export default function SupportTicketsList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch tickets
  const { data, isLoading, isError } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      if (!user?.id || user.role !== "merchant") {
        return { tickets: [] };
      }
      
      // We don't need to pass merchantId as query param anymore
      // The backend will automatically use the merchant ID from the authenticated user
      const response = await fetch(`/api/support-tickets`);
      
      if (!response.ok) {
        console.error("Failed to fetch tickets:", response.statusText);
        throw new Error("Failed to fetch tickets");
      }
      return response.json();
    },
    enabled: !!user?.id && user.role === "merchant",
  });
  
  // Extract tickets array from the response
  const tickets = data?.tickets || [];

  // Handler for creating a new ticket
  const handleCreateTicket = () => {
    setLocation("/merchant/support-tickets/create");
  };

  // Navigate to a specific ticket
  const handleViewTicket = (ticketId: number) => {
    setLocation(`/merchant/support-tickets/${ticketId}`);
  };

  // Format the category text for display
  const formatCategoryText = (category: string) => {
    return category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Get status text for display
  const getStatusText = (status: string) => {
    switch (status) {
      case "new":
        return "New";
      case "in_progress":
        return "In Progress";
      case "pending_merchant":
        return "Awaiting Your Response";
      case "pending_customer":
        return "Awaiting Customer";
      case "resolved":
        return "Resolved";
      case "closed":
        return "Closed";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Filter tickets based on search and filters
  const filteredTickets = tickets.filter((ticket: any) => {
    // Apply search filter (case-insensitive)
    const matchesSearch =
      searchQuery === "" ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ticket.description && 
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Apply status filter
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    
    // Apply category filter
    const matchesCategory = categoryFilter === "all" || ticket.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });
  
  // Loading state inside MerchantLayout
  if (isLoading) {
    return (
      <MerchantLayout>
        <div className="container py-8 flex justify-center items-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MerchantLayout>
    );
  }

  // Error state inside MerchantLayout
  if (isError) {
    return (
      <MerchantLayout>
        <div className="container py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load support tickets. Please try again later or contact support.
            </AlertDescription>
          </Alert>
        </div>
      </MerchantLayout>
    );
  }

  // Main content with tickets list inside MerchantLayout
  return (
    <MerchantLayout>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Support Tickets</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your support requests
            </p>
          </div>
          <Button onClick={handleCreateTicket} className="mt-4 md:mt-0">
            <Plus className="mr-2 h-4 w-4" />
            Create Ticket
          </Button>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="pending_merchant">Awaiting Your Response</SelectItem>
                  <SelectItem value="pending_customer">Awaiting Customer</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="accounting">Accounting & Billing</SelectItem>
                  <SelectItem value="customer_issue">Customer Issue</SelectItem>
                  <SelectItem value="technical_issue">Technical Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        {filteredTickets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-6 flex flex-col items-center justify-center py-16">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">No tickets found</h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                    ? "No tickets match your search criteria. Try adjusting your filters."
                    : "You haven't created any support tickets yet."}
                </p>
                {!searchQuery && statusFilter === "all" && categoryFilter === "all" && (
                  <Button onClick={handleCreateTicket}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Ticket
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTickets.map((ticket: any) => (
              <Card
                key={ticket.id}
                className="hover:bg-accent/10 cursor-pointer transition-colors"
                onClick={() => handleViewTicket(ticket.id)}
              >
                <CardContent className="pt-6 pb-6">
                  <div className="flex flex-col md:flex-row justify-between">
                    <div className="flex-1">
                      <div className="flex gap-2 items-center mb-2">
                        <h3 className="text-lg font-semibold">{ticket.subject}</h3>
                        <Badge variant={getStatusColor(ticket.status)}>
                          {getStatusText(ticket.status)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        <span className="font-medium">#{ticket.ticketNumber}</span> • 
                        <span className="ml-2">{formatCategoryText(ticket.category)}</span> •
                        <span className="ml-2 capitalize">{ticket.priority} Priority</span>
                      </div>
                      {ticket.description && (
                        <p className="text-sm line-clamp-2 mb-4">
                          {ticket.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 md:mt-0 md:ml-6 md:text-right flex flex-col items-start md:items-end">
                      <div className="text-sm text-muted-foreground">
                        Created: {formatDate(ticket.createdAt)}
                      </div>
                      {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
                        <div className="text-sm text-muted-foreground">
                          Updated: {formatDate(ticket.updatedAt)}
                        </div>
                      )}
                      {ticket.lastMessageAt && (
                        <div className="text-sm mt-2">
                          <Badge variant="outline">
                            Last Message: {formatDate(ticket.lastMessageAt)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MerchantLayout>
  );
}