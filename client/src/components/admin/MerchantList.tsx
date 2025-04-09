import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Merchant } from "@shared/schema";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Check, X, PlusCircle, ExternalLink, Pencil } from "lucide-react";
import { Link } from "wouter";
import { extractApiErrorMessage, isSessionExpiredError } from '@/lib/errorHandling';

export default function MerchantList() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: 0,
    name: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    active: true,
  });
  const [isEditing, setIsEditing] = useState(false);

  // From the second implementation - these states are needed
  const [merchants, setMerchants] = useState<IMerchant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use React Query for data fetching
  const { data: merchantsData = [], isLoading, isError, error, refetch } = useQuery<Merchant[]>({
    queryKey: ["/api/admin/merchants"],
    queryFn: async () => {
      try {
        // Get auth token from storage explicitly to ensure it's included
        let authToken: string | undefined;
        try {
          const userData = localStorage.getItem("shifi_user");
          if (userData) {
            const user = JSON.parse(userData);
            
            // IMPROVED token extraction - check all possible token locations
            // Log user structure for debugging
            console.log(`[TOKEN DEBUG] User data structure: ${JSON.stringify(user, null, 2)}`);
            
            // First check if token is directly on user object
            if (user.token) {
              authToken = user.token;
              console.log("[TOKEN DEBUG] Found auth token directly on user object");
            } 
            // Then check if it's nested under user.user
            else if (user.user && user.user.token) {
              authToken = user.user.token;
              console.log("[TOKEN DEBUG] Found auth token in nested user.user object");
            }
            // Check if it's in an access_token field
            else if (user.access_token) {
              authToken = user.access_token;
              console.log("[TOKEN DEBUG] Found auth token in access_token field");
            }
            // Check if there's a JWT property 
            else if (user.jwt) {
              authToken = user.jwt;
              console.log("[TOKEN DEBUG] Found auth token in jwt field");
            }
            // Check if token is directly inside user without a token property
            else if (typeof user === 'string' && user.includes('.') && user.split('.').length === 3) {
              // This looks like a JWT token directly
              authToken = user;
              console.log("[TOKEN DEBUG] User data itself appears to be a JWT token");
            }
            
            if (authToken) {
              console.log("Successfully found auth token for admin merchants request");
              
              // Log token structure for debugging (safe first/last portion only)
              const tokenPreview = authToken.substring(0, 10) + '...' + authToken.substring(authToken.length - 5);
              console.log(`Token preview: ${tokenPreview}`);
            } else {
              console.error("No auth token found in localStorage - user data structure:", user);
            }
          } else {
            console.error("No user data found in localStorage");
          }
        } catch (tokenError) {
          console.error("Error getting auth token from localStorage:", tokenError);
        }
        
        // Use our apiRequest function with explicit custom headers for auth token
        const headers: Record<string, string> = {};
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
          console.log("Added Authorization header with Bearer token");
        } else {
          console.warn("No Authorization header added (missing token)");
        }
        
        // Make the request with explicit headers
        const response = await apiRequest("GET", "/api/admin/merchants", undefined, headers);
        
        if (response.success) {
          return response.merchants;
        }
        
        // Log server-reported error if available
        if (response.message) {
          console.error("Server error:", response.message);
          throw new Error(response.message);
        }
        
        throw new Error("Failed to fetch merchants");
      } catch (error) {
        // Enhanced error handling
        console.error("Merchant list fetching error:", error);
        
        // Extract a user-friendly error message
        const errorMessage = extractApiErrorMessage(error);
        
        // Check for specific error types
        if (isSessionExpiredError(error)) {
          console.warn("Session expired, redirecting to login...");
          // The session expired event will be dispatched by apiRequest
          throw new Error("Your session has expired. Please log in again.");
        }
        
        throw new Error(`Error: ${errorMessage}`);
      }
    },
    onError: (err) => {
      console.error("Merchant list error:", err);
      setErrorMessage("Error fetching merchants: " + (err instanceof Error ? err.message : String(err)));
    },
    onSettled: () => {
      setLoading(false);
    },
    // Add retry logic to handle temporary network issues
    retry: 1,
    retryDelay: 1000
  });

  useEffect(() => {
    setLoading(isLoading);
    if (isError && error) {
      console.error("Merchant list component error:", error);
      setErrorMessage("Error fetching merchants: " + (error instanceof Error ? error.message : String(error)));
    } else if (!isLoading && !isError) {
      // Clear any previous error messages when data loads successfully
      setErrorMessage("");
    }
  }, [isLoading, isError, error]);

  const columns: ColumnDef<Merchant>[] = [
    {
      accessorKey: "name",
      header: "Merchant Name",
    },
    {
      accessorKey: "contactName",
      header: "Contact Person",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "phone",
      header: "Phone",
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => {
        const active = row.getValue("active");
        return (
          <Badge variant={active ? "success" : "danger"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        const date = row.getValue("createdAt") as string;
        return format(new Date(date), "MMM d, yyyy");
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const merchant = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => handleEditClick(merchant)}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Link href={`/admin/merchants/${merchant.id}`}>
              <Button variant="ghost" size="sm" className="flex items-center gap-1">
                View <ExternalLink className="h-4 w-4 ml-1" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1"
                onClick={async (e) => {
                  e.preventDefault();
                  if (confirm('Are you sure you want to archive this merchant?')) {
                    const res = await fetch(`/api/merchants/${merchant.id}/archive`, {
                      method: 'POST',
                      credentials: 'include'
                    });
                    if (res.ok) {
                      refetch();
                      toast({
                        title: "Merchant archived",
                        description: "The merchant has been archived successfully."
                      });
                    }
                  }
                }}
              >
                Archive
              </Button>
            </Link>
          </div>
        );
      },
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("POST", "/api/merchants", {
        name: formData.name,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
      });
      setAddDialogOpen(false);
      refetch();
      toast({
        title: "Merchant Created",
        description: "The merchant has been successfully added.",
      });
      resetForm();
    } catch (error) {
      console.error("Failed to create merchant:", error);
      toast({
        title: "Error",
        description: "Failed to create the merchant. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("PATCH", `/api/merchants/${formData.id}`, {
        name: formData.name,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        active: formData.active,
      });
      setEditDialogOpen(false);
      refetch();
      toast({
        title: "Merchant Updated",
        description: "The merchant details have been successfully updated.",
      });
      resetForm();
    } catch (error) {
      console.error("Failed to update merchant:", error);
      toast({
        title: "Error",
        description: "Failed to update the merchant. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditClick = (merchant: Merchant) => {
    setFormData({
      id: merchant.id,
      name: merchant.name,
      contactName: merchant.contactName,
      email: merchant.email,
      phone: merchant.phone || "",
      address: merchant.address || "",
      active: merchant.active || true,
    });
    setIsEditing(true);
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      id: 0,
      name: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      active: true,
    });
    setIsEditing(false);
  };

  // Get status badge color based on Plaid status
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) return <div className="text-center py-8">Loading merchants...</div>;

  if (errorMessage) return <div className="text-center py-8 text-red-600">{errorMessage}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Merchants</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage all merchant accounts in the system
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Merchant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Merchant</DialogTitle>
              <DialogDescription>
                Create a new merchant account that can send financing applications to customers.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Merchant Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactName">Contact Person</Label>
                  <Input
                    id="contactName"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Merchant</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Merchant Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Merchant</DialogTitle>
              <DialogDescription>
                Update the merchant details.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Merchant Name</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-contactName">Contact Person</Label>
                  <Input
                    id="edit-contactName"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input
                    id="edit-address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-active"
                    name="active"
                    checked={formData.active}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Label htmlFor="edit-active">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setEditDialogOpen(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button type="submit">Update Merchant</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md my-4">
          <h3 className="font-semibold mb-1">Error</h3>
          <p className="text-sm">{errorMessage}</p>
          <button 
            onClick={() => refetch()} 
            className="mt-2 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={merchantsData}
        searchField="name"
        searchPlaceholder="Search merchants..."
        isLoading={isLoading}
      />
    </div>
  );
}

// Define any missing interface
interface IMerchant {
  id: number;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  status?: string;
  createdAt?: string;
  plaidStatus?: string;
  active?: boolean;
  // Add other properties used in your component
}