import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MerchantLayout from "@/components/layout/MerchantLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusCircle, MessageCircle, Clock, Filter, X, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

// Define form schema for new conversation
const newConversationSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  // Adding subject for compatibility with both field names
  subject: z.string().optional(),
  message: z.string().min(1, "Message is required"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export default function MerchantMessages() {
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create form for new conversation
  const form = useForm<z.infer<typeof newConversationSchema>>({
    resolver: zodResolver(newConversationSchema),
    defaultValues: {
      topic: "",
      subject: "",
      message: "",
      priority: "normal",
    },
  });

  // Query to get all conversations
  const { 
    data: conversationsData, 
    isLoading,
    error: conversationsError,
    refetch: refetchConversations 
  } = useQuery({
    queryKey: ["/api/communications/merchant"],
    queryFn: async () => {
      console.log("Fetching merchant conversations");
      try {
        // Use the apiRequest utility which handles CSRF tokens
        const response = await apiRequest("GET", "/api/communications/merchant");
        console.log("Merchant conversations response:", response);
        return response;
      } catch (error) {
        console.error("Error fetching merchant conversations:", error);
        throw error;
      }
    },
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof newConversationSchema>) => {
      // Fix: Correct parameter order for apiRequest - method first, then URL, then data
      return apiRequest("POST", "/api/communications/merchant", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/merchant"] });
      setCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Conversation created",
        description: "Your message has been sent to support.",
      });
      // Navigate to the new conversation
      if (data.id) {
        setLocation(`/merchant/messages/${data.id}`);
      }
    },
    onError: (error) => {
      console.error("Error creating conversation:", error);
      toast({
        title: "Error",
        description: `Failed to create conversation: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: z.infer<typeof newConversationSchema>) => {
    createConversationMutation.mutate(data);
  };

  // Filter conversations based on active tab
  const filterConversations = (conversations) => {
    if (!conversations) return [];
    
    switch (activeTab) {
      case "active":
        return conversations.filter((conv) => conv.status === "active");
      case "resolved":
        return conversations.filter((conv) => conv.status === "resolved");
      case "archived":
        return conversations.filter((conv) => conv.status === "archived");
      default:
        return conversations;
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return format(date, "MMM d, yyyy h:mm a");
  };

  // Get priority badge color
  const getPriorityColor = (priority) => {
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

  // Get status badge color
  const getStatusColor = (status) => {
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

  // Check for error state
  const hasError = conversationsError !== null;
  
  // Extract conversations with better error handling for various response formats
  console.log("Raw conversations data:", conversationsData);
  
  const conversations = conversationsData?.conversations || 
                       (conversationsData?.data) || 
                       (conversationsData?.success && conversationsData) || 
                       [];
  
  // Apply filtering to the conversations
  const filteredConversations = filterConversations(Array.isArray(conversations) ? conversations : []);

  return (
    <MerchantLayout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Messages</h1>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Message
          </Button>
        </div>

        <Tabs
          defaultValue="active"
          className="w-full"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
              </div>
            ) : hasError ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="text-red-500 rounded-full bg-red-50 p-3 mb-4">
                    <X className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Connection Error</h3>
                  <p className="text-gray-500 text-center mb-4 max-w-md">
                    We're having trouble connecting to the messaging system. This might be due to network issues or server maintenance.
                  </p>
                  <Button 
                    onClick={() => refetchConversations()}
                    className="mb-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                  <p className="text-xs text-gray-400 mt-2">
                    Error: {conversationsError instanceof Error ? conversationsError.message : "Unknown error"}
                  </p>
                </CardContent>
              </Card>
            ) : filteredConversations.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <MessageCircle className="h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-center">
                    No active messages. Create a new message to get started.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Message
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredConversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/merchant/messages/${conversation.id}`}
                  >
                    <Card className="cursor-pointer hover:border-primary transition-all duration-200">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg truncate">
                            {conversation.topic || conversation.subject || "Conversation"}
                          </CardTitle>
                          <Badge className={getStatusColor(conversation.status)}>
                            {conversation.status}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(conversation.lastMessageAt || conversation.createdAt)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={getPriorityColor(conversation.priority)}>
                            {conversation.priority || "normal"}
                          </Badge>
                          {conversation.unreadMessages > 0 && (
                            <Badge className="bg-primary text-primary-foreground">
                              {conversation.unreadMessages} new
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="resolved" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
              </div>
            ) : hasError ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="text-red-500 rounded-full bg-red-50 p-3 mb-4">
                    <X className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Connection Error</h3>
                  <p className="text-gray-500 text-center mb-4 max-w-md">
                    We're having trouble connecting to the messaging system. This might be due to network issues or server maintenance.
                  </p>
                  <Button 
                    onClick={() => refetchConversations()}
                    className="mb-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            ) : filteredConversations.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <MessageCircle className="h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-center">
                    No resolved messages.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredConversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/merchant/messages/${conversation.id}`}
                  >
                    <Card className="cursor-pointer hover:border-primary transition-all duration-200">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg truncate">
                            {conversation.topic || conversation.subject || "Conversation"}
                          </CardTitle>
                          <Badge className={getStatusColor(conversation.status)}>
                            {conversation.status}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(conversation.lastMessageAt || conversation.createdAt)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Badge variant="outline" className={getPriorityColor(conversation.priority)}>
                          {conversation.priority || "normal"}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="archived" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
              </div>
            ) : hasError ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="text-red-500 rounded-full bg-red-50 p-3 mb-4">
                    <X className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Connection Error</h3>
                  <p className="text-gray-500 text-center mb-4 max-w-md">
                    We're having trouble connecting to the messaging system. This might be due to network issues or server maintenance.
                  </p>
                  <Button 
                    onClick={() => refetchConversations()}
                    className="mb-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            ) : filteredConversations.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <MessageCircle className="h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-center">
                    No archived messages.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredConversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/merchant/messages/${conversation.id}`}
                  >
                    <Card className="cursor-pointer hover:border-primary transition-all duration-200">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg truncate">
                            {conversation.topic || conversation.subject || "Conversation"}
                          </CardTitle>
                          <Badge className={getStatusColor(conversation.status)}>
                            {conversation.status}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(conversation.lastMessageAt || conversation.createdAt)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Badge variant="outline" className={getPriorityColor(conversation.priority)}>
                          {conversation.priority || "normal"}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create new conversation dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>
              Create a new message to communicate with our team.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter message topic" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
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
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Type your message here..."
                        className="resize-none min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createConversationMutation.isPending}
                >
                  {createConversationMutation.isPending ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-b-2 border-current" />
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}