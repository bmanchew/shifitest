import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Loader2,
  ArrowLeft,
  Send,
  User,
  Clock,
  MessageSquare,
  Tag,
  CheckCircle2,
  Calendar,
  Building,
  Mail,
  ShieldAlert,
  Flag
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateTime, getStatusColor } from "@/lib/utils";
import AdminLayout from "@/components/layout/AdminLayout";

// Define ticket status options
const ticketStatusOptions = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending_merchant", label: "Pending Merchant" },
  { value: "pending_customer", label: "Pending Customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

// Define ticket priority options
const ticketPriorityOptions = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export default function AdminSupportTicketPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  
  // Fetch ticket details
  const {
    data: ticketData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["support-ticket", id],
    queryFn: async () => {
      if (!id) return null;
      
      const response = await fetch(`/api/support-tickets/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch ticket details");
      }
      return response.json();
    },
    enabled: !!id,
  });

  const ticket = ticketData?.ticket;

  // Set initial status and priority when ticket data is loaded
  React.useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setPriority(ticket.priority);
    }
  }, [ticket]);

  // Fetch messages for this ticket
  const {
    data: messagesData = { messages: [] },
    isLoading: messagesLoading,
  } = useQuery({
    queryKey: ["support-ticket-messages", id],
    queryFn: async () => {
      if (!id) return { messages: [] };
      
      const response = await fetch(`/api/support-tickets/${id}/messages`);
      if (!response.ok) {
        throw new Error("Failed to fetch ticket messages");
      }
      return response.json();
    },
    enabled: !!id,
  });

  const messages = messagesData.messages || [];

  // Format the category text for display
  const formatCategoryText = (category: string) => {
    return category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`/api/support-tickets/${id}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: newMessage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      setNewMessage("");
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      });

      // Refresh messages
      queryClient.invalidateQueries({
        queryKey: ["support-ticket-messages", id]
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle status and priority update
  const handleUpdateTicket = async () => {
    if (!id) return;

    try {
      const response = await fetch(`/api/support-tickets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          priority,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update ticket");
      }

      toast({
        title: "Ticket updated",
        description: "The ticket has been updated successfully.",
      });

      // Refresh ticket data
      queryClient.invalidateQueries({
        queryKey: ["support-ticket", id]
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update ticket. Please try again.",
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="container mx-auto py-8 flex justify-center items-center h-[calc(100vh-200px)]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading ticket information...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Error state
  if (isError || !ticket) {
    return (
      <AdminLayout>
        <div className="container mx-auto py-8">
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Failed to load the ticket. It may not exist or you may not have permission to view it."}
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => setLocation("/admin/support-tickets")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Support Tickets
          </Button>
        </div>
      </AdminLayout>
    );
  }

  // Render ticket details
  return (
    <AdminLayout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/admin/support-tickets">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-2xl font-semibold">Ticket #{ticket.ticketNumber}</h1>
              <Badge className={getStatusColor(ticket.status)}>
                {ticket.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Opened {formatDate(ticket.createdAt)} by {ticket.createdByName || "Unknown User"}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/merchants/${ticket.merchantId}`}>
              <Button variant="outline" size="sm">
                <Building className="mr-2 h-4 w-4" />
                View Merchant
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main content area */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{ticket.subject}</CardTitle>
                <CardDescription>
                  {formatCategoryText(ticket.category)}
                  {ticket.subcategory && ` > ${ticket.subcategory}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <p>{ticket.description}</p>
                </div>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No messages in this conversation yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((message: any) => (
                      <div key={message.id} className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            message.senderType === "admin" 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted"
                          }`}>
                            <User className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {message.senderName || (message.senderType === "admin" ? "Admin" : "Merchant")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(new Date(message.createdAt))}
                            </span>
                          </div>
                          <div className="prose max-w-none text-sm">
                            <p>{message.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <div className="w-full space-y-2">
                  <Textarea
                    placeholder="Type your reply here..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSendMessage} disabled={sendingMessage}>
                      {sendingMessage ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send Reply
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Ticket Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ticket Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    Created:
                  </div>
                  <div>{formatDateTime(new Date(ticket.createdAt))}</div>

                  {ticket.updatedAt && (
                    <>
                      <div className="flex items-center text-muted-foreground">
                        <Clock className="mr-2 h-4 w-4" />
                        Updated:
                      </div>
                      <div>{formatDateTime(new Date(ticket.updatedAt))}</div>
                    </>
                  )}

                  <div className="flex items-center text-muted-foreground">
                    <Building className="mr-2 h-4 w-4" />
                    Merchant:
                  </div>
                  <div>{ticket.merchantName}</div>

                  <div className="flex items-center text-muted-foreground">
                    <Tag className="mr-2 h-4 w-4" />
                    Category:
                  </div>
                  <div>{formatCategoryText(ticket.category)}</div>

                  {ticket.assignedToName && (
                    <>
                      <div className="flex items-center text-muted-foreground">
                        <User className="mr-2 h-4 w-4" />
                        Assigned to:
                      </div>
                      <div>{ticket.assignedToName}</div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Update Ticket Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Update Ticket</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {ticketStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {ticketPriorityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handleUpdateTicket} 
                  disabled={status === ticket.status && priority === ticket.priority}
                  className="w-full"
                >
                  Update Ticket
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}