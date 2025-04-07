import React, { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  FileText,
  MessageSquare,
  Search,
  AlertCircle,
  CheckCircle2,
  Tag,
  ArchiveIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, getStatusColor } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";

// Interface for support tickets
interface SupportTicket {
  id: number;
  ticketNumber: string;
  merchantId: number;
  merchantName: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: number;
  assignedToName?: string;
}

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

export default function SupportTickets() {
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [updatedStatus, setUpdatedStatus] = useState<string>("");
  const [updatedPriority, setUpdatedPriority] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");

  // Fetch support tickets
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/support-tickets"],
    queryFn: async () => {
      const response = await fetch("/api/support-tickets");
      if (!response.ok) throw new Error("Failed to fetch tickets");
      const data = await response.json();
      return data;
    },
  });
  
  // Extract tickets array from the response
  const tickets = data?.tickets || [];

  // Filter tickets based on active tab
  const filteredTickets = React.useMemo(() => {
    if (activeTab === "all") return tickets;
    if (activeTab === "new") return tickets.filter((t: SupportTicket) => t.status === "new");
    if (activeTab === "in_progress") return tickets.filter((t: SupportTicket) => t.status === "in_progress");
    if (activeTab === "pending") 
      return tickets.filter((t: SupportTicket) => 
        t.status === "pending_merchant" || t.status === "pending_customer");
    if (activeTab === "resolved") return tickets.filter((t: SupportTicket) => t.status === "resolved");
    if (activeTab === "closed") return tickets.filter((t: SupportTicket) => t.status === "closed");
    return tickets;
  }, [tickets, activeTab]);

  // Open update dialog with selected ticket data
  const handleUpdateClick = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setUpdatedStatus(ticket.status);
    setUpdatedPriority(ticket.priority);
    setIsUpdateDialogOpen(true);
  };

  // Open reply dialog with selected ticket data
  const handleReplyClick = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setReplyMessage("");
    setIsReplyDialogOpen(true);
  };

  // Handle ticket update
  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;

    try {
      const response = await fetch(`/api/support-tickets/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: updatedStatus,
          priority: updatedPriority,
        }),
      });

      if (!response.ok) throw new Error("Failed to update ticket");

      toast({
        title: "Ticket Updated",
        description: `Ticket ${selectedTicket.ticketNumber} has been updated successfully.`,
      });

      setIsUpdateDialogOpen(false);
      refetch();
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "There was an error updating the ticket. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle ticket reply
  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    try {
      const response = await fetch(`/api/support-tickets/${selectedTicket.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: replyMessage,
        }),
      });

      if (!response.ok) throw new Error("Failed to send reply");

      toast({
        title: "Reply Sent",
        description: `Your reply to ticket ${selectedTicket.ticketNumber} has been sent.`,
      });

      setIsReplyDialogOpen(false);
      refetch();
    } catch (error) {
      toast({
        title: "Reply Failed",
        description: "There was an error sending your reply. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Column definitions for the DataTable
  const columns: ColumnDef<SupportTicket>[] = [
    {
      accessorKey: "ticketNumber",
      header: "Ticket #",
      cell: ({ row }) => (
        <Link to={`/admin/support-tickets/${row.original.id}`} className="font-medium text-blue-600 hover:underline">
          {row.original.ticketNumber}
        </Link>
      ),
    },
    {
      accessorKey: "merchantName",
      header: "Merchant",
    },
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate" title={row.original.subject}>
          {row.original.subject}
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const category = row.original.category;
        return (
          <div className="flex items-center">
            <Tag className="mr-2 h-4 w-4" />
            <span className="capitalize">{category.replace(/_/g, " ")}</span>
          </div>
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
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const statusText = status.replace(/_/g, " ");
        return (
          <Badge className={getStatusColor(status)}>
            {statusText.charAt(0).toUpperCase() + statusText.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDateTime(new Date(row.original.createdAt)),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const ticket = row.original;
        return (
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleUpdateClick(ticket)}
              title="Update Status & Priority"
            >
              <Clock className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleReplyClick(ticket)}
              title="Reply"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Link to={`/admin/support-tickets/${ticket.id}`}>
              <Button
                variant="outline"
                size="icon"
                title="View Ticket"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <AdminLayout>
      <div className="container mx-auto py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
          <Link to="/admin/messages">
            <Button>
              <MessageSquare className="mr-2 h-4 w-4" />
              All Messages
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manage Support Tickets</CardTitle>
            <CardDescription>
              View and manage merchant support tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="new" className="flex items-center">
                  <AlertCircle className="mr-1 h-4 w-4" />
                  New
                </TabsTrigger>
                <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="resolved">
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  Resolved
                </TabsTrigger>
                <TabsTrigger value="closed">
                  <ArchiveIcon className="mr-1 h-4 w-4" />
                  Closed
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                <DataTable
                  columns={columns}
                  data={filteredTickets}
                  showSearch={true}
                  searchKey="subject"
                  placeholder="Search tickets..."
                  isLoading={isLoading}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Update Ticket Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Ticket</DialogTitle>
            <DialogDescription>
              Update the status and priority of ticket #{selectedTicket?.ticketNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                value={updatedStatus}
                onValueChange={setUpdatedStatus}
              >
                <SelectTrigger className="col-span-3">
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="priority" className="text-right">
                Priority
              </Label>
              <Select
                value={updatedPriority}
                onValueChange={setUpdatedPriority}
              >
                <SelectTrigger className="col-span-3">
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUpdateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateTicket}>Update Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={isReplyDialogOpen} onOpenChange={setIsReplyDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Reply to Ticket</DialogTitle>
            <DialogDescription>
              Send a message to {selectedTicket?.merchantName} regarding ticket #{selectedTicket?.ticketNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                rows={5}
                placeholder="Type your reply here..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReplyDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSendReply}>Send Reply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}