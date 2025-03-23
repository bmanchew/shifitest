import { useState } from "react";
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

  const { data: merchants = [], refetch } = useQuery<Merchant[]>({
    queryKey: ["/api/merchants"],
  });

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

      <DataTable
        columns={columns}
        data={merchants}
        searchField="name"
        searchPlaceholder="Search merchants..."
      />
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

interface IMerchant {
  id: number;
  name: string;
  email: string;
  phone: string;
  contactName: string;
  active: boolean;
  createdAt: string;
  plaidStatus: string;
}

const MerchantList: React.FC = () => {
  const [merchants, setMerchants] = useState<IMerchant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/admin/merchants");
        if (response.data.success) {
          setMerchants(response.data.merchants);
        } else {
          setError("Failed to fetch merchants");
        }
      } catch (err) {
        setError("Error fetching merchants: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchMerchants();
  }, []);

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
  
  if (error) return <div className="text-center py-8 text-red-600">{error}</div>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {merchants.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-4 px-4 text-center text-gray-500">
                No merchants found
              </td>
            </tr>
          ) : (
            merchants.map((merchant) => (
              <tr key={merchant.id}>
                <td className="py-4 px-4 whitespace-nowrap">{merchant.name}</td>
                <td className="py-4 px-4 whitespace-nowrap">{merchant.contactName}</td>
                <td className="py-4 px-4 whitespace-nowrap">{merchant.email}</td>
                <td className="py-4 px-4 whitespace-nowrap">{merchant.phone}</td>
                <td className="py-4 px-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(merchant.plaidStatus)}`}>
                    {merchant.plaidStatus}
                  </span>
                </td>
                <td className="py-4 px-4 whitespace-nowrap">
                  {new Date(merchant.createdAt).toLocaleDateString()}
                </td>
                <td className="py-4 px-4 whitespace-nowrap text-sm font-medium">
                  <Link to={`/admin/merchants/${merchant.id}`} className="text-indigo-600 hover:text-indigo-900">
                    View Details
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MerchantList;
