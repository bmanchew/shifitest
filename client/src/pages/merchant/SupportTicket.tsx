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
import { 
  AlertCircle, 
  Loader2, 
  ArrowLeft, 
  Clock, 
  Calendar,
  Tag,
  FileText
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
  const activityLog = ticketData?.activityLog || [];

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main content area */}
          <div className="md:col-span-2">
            <Card>
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
              
              <CardContent className="pt-6">              
                {ticket.description && (
                  <div className="mb-6">
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">Description</h3>
                    <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
                      {ticket.description}
                    </div>
                  </div>
                )}
                
                {/* Activity Log */}
                <div className="mt-6">
                  <h3 className="font-medium text-base mb-4">Activity Log</h3>
                  {activityLog.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>No activity recorded for this ticket.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activityLog.map((activity: any, index: number) => (
                        <div key={index} className="flex gap-3 items-start pb-4 border-b border-muted last:border-0">
                          <div className="rounded-full bg-muted h-8 w-8 flex items-center justify-center flex-shrink-0">
                            <Clock className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm">
                              <span className="font-medium">{activity.actionType.replace(/_/g, " ")}</span>
                              {activity.actionDetails && `: ${activity.actionDetails}`}
                              {activity.previousValue && activity.newValue && (
                                <span> from <Badge variant="outline">{activity.previousValue}</Badge> to <Badge>{activity.newValue}</Badge></span>
                              )}
                            </p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDate(activity.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
              
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
                  <div>{formatDate(ticket.createdAt)}</div>

                  {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
                    <>
                      <div className="flex items-center text-muted-foreground">
                        <Clock className="mr-2 h-4 w-4" />
                        Updated:
                      </div>
                      <div>{formatDate(ticket.updatedAt)}</div>
                    </>
                  )}

                  <div className="flex items-center text-muted-foreground">
                    <Tag className="mr-2 h-4 w-4" />
                    Category:
                  </div>
                  <div>{formatCategoryText(ticket.category)}</div>
                  
                  <div className="flex items-center text-muted-foreground">
                    <Tag className="mr-2 h-4 w-4" />
                    Priority:
                  </div>
                  <div className="capitalize">{ticket.priority}</div>
                </div>
              </CardContent>
            </Card>

            {/* Related Items */}
            {ticket.contractId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Related Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <Button 
                      variant="link" 
                      className="p-0 h-auto" 
                      onClick={() => setLocation(`/merchant/contracts/${ticket.contractId}`)}
                    >
                      Contract #{ticket.contractNumber}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Support Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Need Additional Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  If you have additional questions about this ticket, please create a new support ticket.
                </p>
                <Button 
                  className="w-full" 
                  onClick={() => setLocation("/merchant/support-tickets/create")}
                >
                  Create New Ticket
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MerchantLayout>
  );
}