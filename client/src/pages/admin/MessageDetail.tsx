import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, getStatusColor } from "@/lib/utils";
import {
  ArrowLeft,
  RefreshCw,
  Send,
  CheckCircle,
  ArchiveIcon,
  User,
  Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import AdminLayout from "@/components/layout/AdminLayout";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

// Define a message interface
interface MessageItem {
  id: number;
  content: string;
  senderType: 'admin' | 'merchant';
  createdAt: string;
  senderId: number;
}

export default function AdminMessageDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [newMessage, setNewMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const conversationId = parseInt(id || "", 10);

  // Validate conversation ID
  if (isNaN(conversationId)) {
    navigate("/admin/messages");
    return null;
  }

  // Query to get conversation details
  const {
    data: conversationData,
    isLoading: isLoadingConversation,
    error: conversationError,
    refetch: refetchConversation,
  } = useQuery({
    queryKey: [`/api/conversations/${conversationId}`],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${conversationId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch conversation details");
      }
      return response.json();
    },
  });

  // Query to get messages in the conversation
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: [`/api/conversations/${conversationId}/messages`],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      return response.json();
    },
  });

  // Extract data from responses
  const conversation = conversationData?.conversation;
  const messages = messagesData?.messages || [];

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    const markAsRead = async () => {
      if (conversation && conversation.unreadCount > 0) {
        try {
          await fetch(`/api/conversations/${conversationId}/read`, {
            method: "POST",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        } catch (error) {
          console.error("Failed to mark messages as read:", error);
        }
      }
    };

    markAsRead();
  }, [conversation, conversationId, queryClient]);

  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newMessage }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      // Clear the input and refetch messages
      setNewMessage("");
      refetchMessages();
      
      // Also invalidate the conversations list to update unread counts
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      
      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle updating conversation status
  const handleUpdateStatus = async (status: string) => {
    setStatusUpdateLoading(true);
    
    try {
      const response = await fetch(`/api/conversations/${conversationId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      // Refetch conversation details
      refetchConversation();
      
      // Also invalidate the conversations list to update statuses
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      
      toast({
        title: "Status Updated",
        description: `Conversation has been marked as ${status}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // Handle archiving conversation
  const handleArchiveConversation = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/archive`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to archive conversation");
      }

      toast({
        title: "Conversation Archived",
        description: "The conversation has been archived successfully.",
      });
      
      // Redirect back to messages list
      navigate("/admin/messages");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to archive conversation. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle errors
  if (conversationError) {
    return (
      <AdminLayout>
        <div className="container mx-auto py-6">
          <Link to="/admin/messages">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Messages
            </Button>
          </Link>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-10">
                <h2 className="text-xl font-semibold text-red-600">Error Loading Conversation</h2>
                <p className="text-gray-500 mt-2">
                  There was a problem loading the conversation. Please try again later.
                </p>
                <Button className="mt-4" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <Link to="/admin/messages">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Messages
            </Button>
          </Link>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchConversation();
                refetchMessages();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            {conversation && conversation.status !== "archived" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Status: <Badge className={`ml-2 ${getStatusColor(conversation.status)}`}>
                      {conversation.status.toUpperCase()}
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={conversation.status === "active" || statusUpdateLoading}
                    onClick={() => handleUpdateStatus("active")}
                  >
                    <div className="h-2 w-2 rounded-full bg-blue-600 mr-2" />
                    Mark as Active
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={conversation.status === "resolved" || statusUpdateLoading}
                    onClick={() => handleUpdateStatus("resolved")}
                  >
                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                    Mark as Resolved
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={statusUpdateLoading}
                    className="text-red-600"
                    onClick={handleArchiveConversation}
                  >
                    <ArchiveIcon className="h-4 w-4 mr-2" />
                    Archive Conversation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        
        {isLoadingConversation ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </CardContent>
          </Card>
        ) : conversation ? (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">{conversation.topic}</CardTitle>
                  <CardDescription>
                    Created {formatDateTime(conversation.createdAt)}
                    {conversation.contract && (
                      <> • Contract #<Link to={`/admin/contracts/${conversation.contractId}`} className="text-blue-600 hover:underline">{conversation.contract.contractNumber}</Link></>
                    )}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(conversation.status)}>
                  {conversation.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center mb-6 space-x-4">
                <div className="flex items-center">
                  <Building className="h-5 w-5 mr-2 text-gray-600" />
                  <Link to={`/admin/merchants/${conversation.merchantId}`} className="text-blue-600 hover:underline font-medium">
                    {conversation.merchant?.businessName || "Unknown Merchant"}
                  </Link>
                </div>
              </div>
              
              <div className="border rounded-md p-4 max-h-[500px] overflow-y-auto mb-4">
                {isLoadingMessages ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-3/4" />
                    <Skeleton className="h-16 w-3/4 ml-auto" />
                    <Skeleton className="h-16 w-3/4" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No messages in this conversation yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message: MessageItem) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.senderType === "admin" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] ${
                            message.senderType === "admin"
                              ? "bg-blue-100 rounded-bl-lg rounded-tl-lg rounded-tr-lg"
                              : "bg-gray-100 rounded-br-lg rounded-tr-lg rounded-tl-lg"
                          } p-3`}
                        >
                          <div className="flex items-center mb-1">
                            <Avatar className="h-6 w-6 mr-2">
                              <AvatarFallback className={message.senderType === "admin" ? "bg-blue-200" : "bg-gray-200"}>
                                {message.senderType === "admin" ? "A" : "M"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {message.senderType === "admin" ? "Admin" : conversation.merchant?.businessName || "Merchant"}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              {formatDateTime(message.createdAt)}
                            </span>
                          </div>
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              
              {conversation.status !== "archived" && (
                <div className="flex items-end gap-2">
                  <Textarea
                    className="flex-1"
                    placeholder="Type your message here..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    rows={3}
                  />
                  <Button
                    className="mb-[2px]"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              )}
            </CardContent>
            {conversation.status === "archived" && (
              <CardFooter className="bg-gray-50 border-t text-center py-3">
                <p className="text-sm text-gray-500 w-full">
                  This conversation has been archived. You cannot send new messages.
                </p>
              </CardFooter>
            )}
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-10">
                <h2 className="text-xl font-semibold">Conversation Not Found</h2>
                <p className="text-gray-500 mt-2">
                  The conversation you're looking for doesn't exist or has been deleted.
                </p>
                <Link to="/admin/messages">
                  <Button className="mt-4">
                    Go Back to Messages
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}