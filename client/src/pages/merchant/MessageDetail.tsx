import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import {
  ArrowLeft,
  Send,
  Clock,
  MoreHorizontal,
  CheckCircle,
  Archive,
  RefreshCcw,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { z } from "zod";

// Message interface
interface Message {
  id: number;
  content: string;
  isFromMerchant: boolean;
  createdAt: string;
}

// Conversation interface
interface Conversation {
  id: number;
  topic?: string;  // Database uses topic but might be missing in some responses
  subject?: string; // Some API responses use subject instead of topic
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  priority?: string;
  category?: string;
  merchantId?: number;
  contractId?: number;
  // Add any additional fields that might be in the response
  unreadMessages?: number;
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function MessageDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [newMessage, setNewMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const conversationId = id ? parseInt(id, 10) : 0;

  // Validate conversation ID
  if (isNaN(conversationId)) {
    navigate("/merchant/messages");
    return null;
  }

  // Query to get conversation details
  const {
    data: conversationData,
    isLoading: isLoadingConversation,
    error: conversationError,
    refetch: refetchConversation,
  } = useQuery({
    queryKey: [`/api/communications/merchant/${conversationId}`],
    queryFn: async () => {
      return apiRequest("GET", `/api/communications/merchant/${conversationId}`);
    },
  });

  // Query to get messages for this conversation
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: [`/api/communications/merchant/${conversationId}/messages`],
    queryFn: async () => {
      return apiRequest("GET", `/api/communications/merchant/${conversationId}/messages`);
    },
  });

  // Mark messages as read when we open the conversation
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/communications/merchant/${conversationId}/read`);
    },
    onSuccess: () => {
      // Don't need to refetch as this is just marking them as read on the server
      // but will refresh unread count in the sidebar
      queryClient.invalidateQueries({ queryKey: ["/api/communications/merchant"] });
    },
  });

  // Send a new message
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      console.log(`Sending message to conversation ${conversationId}:`, { content: content.substring(0, 20) + (content.length > 20 ? '...' : '') });
      
      // Use the apiRequest utility with improved error handling
      try {
        // First ensure we have a fresh CSRF token
        await fetch('/api/csrf-token');
        console.log("CSRF token refreshed before sending message");
        
        // Send the message with the updated CSRF token
        const response = await apiRequest("POST", `/api/communications/merchant/${conversationId}/messages`, { content });
        console.log("Send message response:", response);
        return response;
      } catch (error) {
        console.error("Error in sendMessageMutation:", error);
        
        // Handle CSRF token errors
        if (error instanceof Error && 
            (error.message.includes('CSRF') || error.message.includes('403'))) {
          
          // One more attempt with a fresh token
          try {
            await fetch('/api/csrf-token');
            const retryResponse = await apiRequest("POST", 
              `/api/communications/merchant/${conversationId}/messages`, 
              { content }
            );
            return retryResponse;
          } catch (retryError) {
            console.error("Error on retry:", retryError);
            throw retryError;
          }
        }
        
        throw error;
      }
    },
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ["/api/communications/merchant"] });
      
      // Add a small delay and scroll to bottom after message is added
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 300);
      
      // Provide user feedback
      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully.",
      });
    },
    onError: (error) => {
      console.error("Error details:", error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to send message. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('403') || error.message.includes('CSRF')) {
          errorMessage = "Session error. Please refresh the page and try again.";
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update conversation status
  const updateStatusMutation = useMutation({
    mutationFn: async (status: "active" | "resolved" | "archived") => {
      setStatusUpdateLoading(true);
      return apiRequest("PATCH", `/api/communications/merchant/${conversationId}/status`, { status });
    },
    onSuccess: () => {
      refetchConversation();
      queryClient.invalidateQueries({ queryKey: ["/api/communications/merchant"] });
      setStatusUpdateLoading(false);
      toast({
        title: "Status Updated",
        description: "Conversation status has been updated.",
      });
    },
    onError: (error) => {
      setStatusUpdateLoading(false);
      toast({
        title: "Error",
        description: `Failed to update status: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    },
  });

  // Format date for display
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return format(date, "MMM d, yyyy h:mm a");
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "resolved":
        return "bg-blue-100 text-blue-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority: string | null | undefined): string => {
    switch (priority) {
      case "low":
        return "bg-blue-100 text-blue-800";
      case "normal":
        return "bg-green-100 text-green-800";
      case "high":
        return "bg-amber-100 text-amber-800";
      case "urgent":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Mark messages as read when viewing conversation
  useEffect(() => {
    if (conversationId && !isLoadingMessages && messagesData) {
      markAsReadMutation.mutate();
    }
  }, [conversationId, isLoadingMessages, messagesData]);

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesData]);

  // Send message on Enter (but allow Shift+Enter for new lines)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim()) {
        handleSendMessage();
      }
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      console.log("Attempting to send message to conversation:", conversationId);
      
      // Log the current CSRF token for debugging
      const csrfToken = document.cookie.replace(/(?:(?:^|.*;\s*)XSRF-TOKEN\s*\=\s*([^;]*).*$)|^.*$/, "$1");
      console.log("Message sending context:", {
        csrfTokenPresent: !!csrfToken,
        message: newMessage.substring(0, 20) + (newMessage.length > 20 ? '...' : '')
      });
      
      // First ensure we have a fresh CSRF token
      try {
        await fetch('/api/csrf-token');
        console.log("CSRF token refreshed before sending message");
      } catch (tokenError) {
        console.error("Error refreshing CSRF token:", tokenError);
      }
      
      // Attempt to send the message with additional debugging
      sendMessageMutation.mutate(newMessage.trim(), {
        onSuccess: () => {
          console.log("Message sent successfully");
          // Scrolling is handled in the mutation's onSuccess
        },
        onError: (error) => {
          console.error("Detailed send message error:", error);
          
          // Provide more specific error messages to the user
          let errorMessage = "Failed to send message. Please try again.";
          
          if (error instanceof Error) {
            // Extract more specific error information if available
            if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
              errorMessage = "Network error. Please check your connection and try again.";
            } else if (error.message.includes('403') || error.message.includes('CSRF')) {
              errorMessage = "Session error. Please refresh the page and try again.";
              
              // Try to refresh the token automatically
              fetch('/api/csrf-token').catch(e => console.error("Token refresh failed:", e));
            }
          }
          
          toast({
            title: "Error Sending Message",
            description: errorMessage,
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error("Error in handleSendMessage outer try/catch:", error);
      toast({
        title: "Error",
        description: "Unexpected error when sending message. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle clicking back button
  const handleBack = () => {
    navigate("/merchant/messages");
  };

  // Loading state
  if (isLoadingConversation || isLoadingMessages) {
    return (
      <MerchantLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center mb-4">
            <Button variant="ghost" onClick={handleBack} className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Loading conversation...</h1>
          </div>
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
          </div>
        </div>
      </MerchantLayout>
    );
  }

  // Error state
  if (conversationError || messagesError) {
    return (
      <MerchantLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center mb-4">
            <Button variant="ghost" onClick={handleBack} className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Error</h1>
          </div>
          <Card>
            <CardContent className="py-6">
              <p className="text-red-500">
                Failed to load conversation. {conversationError?.message || messagesError?.message}
              </p>
              <Button className="mt-4" onClick={() => { refetchConversation(); refetchMessages(); }}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </MerchantLayout>
    );
  }

  // Get data - handle different response formats
  console.log("Merchant conversation data:", conversationData);
  console.log("Merchant messages data:", messagesData);
  
  // Handle various API response formats
  const conversation = conversationData?.conversation || 
                      (conversationData?.success && conversationData) || 
                      conversationData as Conversation | undefined;
  
  // Extract messages from various response formats
  const messagesArray = messagesData?.messages || 
                        (messagesData?.data) || 
                        (messagesData?.success && messagesData) || 
                        [];
  const messages = (Array.isArray(messagesArray) ? messagesArray : []) as Message[];

  // If no conversation found
  if (!conversation) {
    return (
      <MerchantLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center mb-4">
            <Button variant="ghost" onClick={handleBack} className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Conversation Not Found</h1>
          </div>
          <Card>
            <CardContent className="py-6">
              <p>The conversation you're looking for doesn't exist or you don't have permission to view it.</p>
              <Button className="mt-4" onClick={handleBack}>
                Back to Messages
              </Button>
            </CardContent>
          </Card>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Button variant="ghost" onClick={handleBack} className="mr-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">{conversation.topic || conversation.subject || "Conversation"}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(conversation.status)}>
              {conversation.status}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={statusUpdateLoading}>
                  {statusUpdateLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Mark as Resolved */}
                {conversation.status !== "resolved" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Resolved
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Mark as Resolved?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will mark the conversation as resolved. You can always reopen it later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => updateStatusMutation.mutate("resolved")}
                        >
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                
                {/* Archive Conversation */}
                {conversation.status !== "archived" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive Conversation
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Archive Conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will archive the conversation. You can still view it in the archived section.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => updateStatusMutation.mutate("archived")}
                        >
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                
                {/* Reopen Conversation */}
                {conversation.status !== "active" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Reopen Conversation
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reopen Conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will reopen the conversation and mark it as active.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => updateStatusMutation.mutate("active")}
                        >
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Conversation metadata */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-sm font-medium flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDate(conversation.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="text-sm font-medium flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDate(conversation.lastMessageAt || conversation.updatedAt)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Priority</p>
                <Badge variant="outline" className={getPriorityColor(conversation.priority)}>
                  {conversation.priority || "normal"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Messages */}
        <div className="bg-white rounded-lg border shadow-sm mb-6">
          <div className="p-4 h-[480px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <p className="text-gray-500">No messages yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message: Message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.isFromMerchant ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-lg ${
                        message.isFromMerchant
                          ? "bg-primary text-primary-foreground"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <div className="text-sm mb-1">
                        {message.isFromMerchant ? "You" : "Support Team"}
                      </div>
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      <div className="text-xs mt-1 opacity-70 text-right">
                        {formatDate(message.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          {/* Message input */}
          {conversation.status === "active" ? (
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message here..."
                  className="resize-none"
                  rows={2}
                  disabled={sendMessageMutation.isPending}
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="self-end"
                >
                  {sendMessageMutation.isPending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-center justify-center">
                <p className="text-gray-500 text-sm">
                  {conversation.status === "resolved" 
                    ? "This conversation has been resolved. Reopen it to send more messages." 
                    : "This conversation has been archived. Reopen it to send more messages."}
                </p>
                <Button 
                  variant="link" 
                  onClick={() => updateStatusMutation.mutate("active")}
                  disabled={statusUpdateLoading}
                  className="ml-2"
                >
                  Reopen
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MerchantLayout>
  );
}