import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
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
  MessageSquare 
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getStatusColor } from "@/lib/utils";
import MerchantLayout from "@/components/layout/MerchantLayout";

export default function SupportTicketPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Fetch ticket details
  const {
    data: ticket,
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

  // Fetch messages for this ticket
  const {
    data: messages = [],
    isLoading: messagesLoading,
  } = useQuery({
    queryKey: ["support-ticket-messages", id],
    queryFn: async () => {
      if (!id) return [];
      
      const response = await fetch(`/api/support-tickets/${id}/messages`);
      if (!response.ok) {
        throw new Error("Failed to fetch ticket messages");
      }
      return response.json();
    },
    enabled: !!id,
  });

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

  // Navigate back to tickets list
  const navigateBack = () => {
    setLocation("/merchant/support-tickets");
  };

  // Send a message
  const sendMessage = async () => {
    if (!newMessage.trim() || !id || !user?.merchantId) return;
    
    setSendingMessage(true);
    
    try {
      const response = await fetch(`/api/support-tickets/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: newMessage.trim(),
          senderId: user.merchantId,
          senderType: "merchant"
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      
      // Clear input and refetch messages
      setNewMessage("");
      queryClient.invalidateQueries(["support-ticket-messages", id]);
      queryClient.invalidateQueries(["support-ticket", id]);
      
      toast({
        title: "Message Sent",
        description: "Your message has been sent to support.",
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

  // Mark ticket as resolved (by merchant)
  const markResolved = async () => {
    if (!id) return;
    
    try {
      const response = await fetch(`/api/support-tickets/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "resolved",
          updatedBy: user?.merchantId,
          updatedByType: "merchant"
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update ticket status");
      }
      
      queryClient.invalidateQueries(["support-ticket", id]);
      
      toast({
        title: "Ticket Resolved",
        description: "This support ticket has been marked as resolved.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update ticket status. Please try again.",
      });
    }
  };

  // Reopen a resolved or closed ticket
  const reopenTicket = async () => {
    if (!id) return;
    
    try {
      const response = await fetch(`/api/support-tickets/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "in_progress",
          updatedBy: user?.merchantId,
          updatedByType: "merchant"
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update ticket status");
      }
      
      queryClient.invalidateQueries(["support-ticket", id]);
      
      toast({
        title: "Ticket Reopened",
        description: "This support ticket has been reopened.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update ticket status. Please try again.",
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <MerchantLayout>
        <div className="container py-8 flex justify-center items-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MerchantLayout>
    );
  }

  // Error state
  if (isError || !ticket) {
    return (
      <MerchantLayout>
        <div className="container py-8">
          <Button variant="outline" onClick={navigateBack} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tickets
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Failed to load ticket details. Please try again."}
            </AlertDescription>
          </Alert>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout>
      <div className="container py-8">
        <Button variant="outline" onClick={navigateBack} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tickets
        </Button>

        <div className="grid grid-cols-1 gap-6">
          {/* Unified Ticket View with Messages */}
          <Card>
            {/* Ticket Header */}
            <CardHeader className="border-b">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {ticket.subject}
                    <Badge variant={getStatusColor(ticket.status)}>
                      {getStatusText(ticket.status)}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-2">
                    <span className="font-medium">#{ticket.ticketNumber}</span> • 
                    <span className="ml-2">{formatCategoryText(ticket.category)}</span> •
                    <span className="ml-2 capitalize">{ticket.priority} Priority</span>
                  </CardDescription>
                </div>
                
                <div className="flex gap-2">
                  {(ticket.status === "resolved" || ticket.status === "closed") && (
                    <Button variant="secondary" onClick={reopenTicket}>
                      Reopen Ticket
                    </Button>
                  )}
                  
                  {(ticket.status === "new" || ticket.status === "in_progress" || ticket.status === "pending_merchant") && (
                    <Button variant="secondary" onClick={markResolved}>
                      Mark as Resolved
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            
            {/* Ticket Metadata */}
            <CardContent className="pt-6 border-b">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">Created</h3>
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatDate(ticket.createdAt)}
                  </p>
                </div>
                
                <div>
                  {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
                    <>
                      <h3 className="font-medium text-sm text-muted-foreground mb-2">Last Updated</h3>
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {formatDate(ticket.updatedAt)}
                      </p>
                    </>
                  )}
                </div>
                
                {ticket.contractId && (
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">Related Contract</h3>
                    <p className="flex items-center gap-2">
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-primary" 
                        onClick={() => setLocation(`/merchant/contracts/${ticket.contractId}`)}
                      >
                        View Contract #{ticket.contractNumber}
                      </Button>
                    </p>
                  </div>
                )}
              </div>
              
              {ticket.description && (
                <div className="mt-6">
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">Description</h3>
                  <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
                    {ticket.description}
                  </div>
                </div>
              )}
            </CardContent>
            
            {/* Messages Section */}
            <CardHeader className="pt-6">
              <div className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                <CardTitle className="text-lg">Conversation</CardTitle>
              </div>
            </CardHeader>
            
            <CardContent>
              {messagesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="border-dashed border rounded-md">
                  <div className="py-6 text-center text-muted-foreground">
                    No messages yet. Start the conversation by sending a message below.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message: any) => (
                    <div 
                      key={message.id} 
                      className={`p-4 rounded-lg ${
                        message.senderType === "merchant" 
                          ? "bg-primary/5 ml-12 mr-0" 
                          : "bg-muted mr-12 ml-0"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <p className="font-medium">
                              {message.senderType === "merchant" ? 
                                "You" : 
                                message.senderType === "admin" ? 
                                "Support Agent" : "System"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(message.createdAt)}
                            </p>
                          </div>
                          <div className="whitespace-pre-wrap text-sm">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            
            {/* Reply Box */}
            {(ticket.status === "new" || ticket.status === "in_progress" || ticket.status === "pending_merchant") && (
              <CardFooter className="border-t pt-6">
                <div className="w-full space-y-4">
                  <Textarea
                    placeholder="Type your message here..."
                    className="min-h-[120px] w-full"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sendingMessage}
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={sendMessage} 
                      disabled={!newMessage.trim() || sendingMessage}
                    >
                      {sendingMessage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </Button>
                  </div>
                </div>
              </CardFooter>
            )}
            
            {/* Closed or Resolved Status Notice */}
            {(ticket.status === "resolved" || ticket.status === "closed") && (
              <CardFooter className="border-t pt-6">
                <Alert className="w-full">
                  <AlertTitle>
                    {ticket.status === "resolved" ? "Ticket Resolved" : "Ticket Closed"}
                  </AlertTitle>
                  <AlertDescription>
                    {ticket.status === "resolved" 
                      ? "This ticket has been marked as resolved. If you need further assistance, you can reopen it using the button above."
                      : "This ticket has been closed. If you need further assistance, you can reopen it using the button above or create a new ticket."}
                  </AlertDescription>
                </Alert>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </MerchantLayout>
  );
}