import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MerchantProgram } from "@shared/schema";
import { Loader2, Plus, Edit, Trash2, Upload, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getCsrfToken, addCsrfHeader } from "@/lib/csrf";

// Define agreement type
interface ProgramAgreement {
  id: number;
  programId: number;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  storedFilename: string;
}

// Define the form schema
const programFormSchema = z.object({
  name: z.string().min(1, "Program name is required"),
  description: z.string().optional(),
  durationMonths: z.number().min(1, "Duration must be at least 1 month"),
});

type ProgramFormValues = z.infer<typeof programFormSchema>;

// Function to upload program agreement
/**
 * Upload a program agreement file to the server
 * This function handles the file upload and creation of a Thanks Roger template
 */
const uploadProgramAgreement = async (programId: number, file: File) => {
  const formData = new FormData();
  formData.append("agreement", file); // Use "agreement" as the field name
  
  // Get CSRF token for secure submission
  const token = await getCsrfToken();
  if (!token) {
    throw new Error("Could not get CSRF token");
  }
  
  const response = await fetch(`/api/merchant/programs/${programId}/agreements`, {
    method: "POST",
    headers: {
      "X-CSRF-Token": token,
    },
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to upload agreement");
  }

  return response.json();
};

export default function ProgramsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAgreementsDialogOpen, setIsAgreementsDialogOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<MerchantProgram | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Set up form with validation
  const form = useForm<ProgramFormValues>({
    resolver: zodResolver(programFormSchema),
    defaultValues: {
      name: "",
      description: "",
      durationMonths: 12,
    },
  });

  // Fetch programs for the current merchant
  const { data: programs = [], isLoading } = useQuery<MerchantProgram[]>({
    queryKey: ["/api/merchant/programs"],
    queryFn: async () => {
      const response = await fetch("/api/merchant/programs", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch programs");
      }
      const data = await response.json();
      return data.data;
    },
  });

  // Fetch agreements for a specific program
  const { data: agreements = [], isLoading: isAgreementsLoading, refetch: refetchAgreements } = useQuery<ProgramAgreement[]>({
    queryKey: ["/api/merchant/programs/agreements", selectedProgram?.id],
    queryFn: async () => {
      if (!selectedProgram) return [];
      
      // Use credentials and ensure CSRF token is handled by default fetch behavior
      const response = await fetch(`/api/merchant/programs/${selectedProgram.id}/agreements`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch agreements");
      }
      
      const data = await response.json();
      return data.data;
    },
    enabled: !!selectedProgram,
  });

  // Create a new program
  const createProgram = useMutation({
    mutationFn: async (data: ProgramFormValues) => {
      // Get CSRF token and add it to headers
      const headers = await addCsrfHeader({
        "Content-Type": "application/json",
      });
      
      const response = await fetch("/api/merchant/programs", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to create program");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Program Created",
        description: "Your program has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/programs"] });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create program: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update an existing program
  const updateProgram = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProgramFormValues> }) => {
      // Get CSRF token and add it to headers
      const headers = await addCsrfHeader({
        "Content-Type": "application/json",
      });
      
      const response = await fetch(`/api/merchant/programs/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to update program");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Program Updated",
        description: "Your program has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/programs"] });
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update program: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete a program
  const deleteProgram = useMutation({
    mutationFn: async (id: number) => {
      // Get CSRF token and add it to headers
      const headers = await addCsrfHeader();
      
      const response = await fetch(`/api/merchant/programs/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete program");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Program Deleted",
        description: "Your program has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/programs"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete program: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete an agreement
  const deleteAgreement = useMutation({
    mutationFn: async (id: number) => {
      // Get CSRF token and add it to headers
      const headers = await addCsrfHeader();
      
      const response = await fetch(`/api/merchant/programs/agreements/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete agreement");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Agreement Deleted",
        description: "The agreement has been deleted successfully",
      });
      refetchAgreements();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete agreement: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle form submission for creating a program
  const onSubmitCreate = (data: ProgramFormValues) => {
    createProgram.mutate(data);
  };

  // Handle form submission for updating a program
  const onSubmitUpdate = (data: ProgramFormValues) => {
    if (selectedProgram) {
      updateProgram.mutate({ id: selectedProgram.id, data });
    }
  };

  // File selection state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Handle file selection
  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !selectedProgram) {
      return;
    }

    const file = e.target.files[0];
    setSelectedFile(file);
    
    // Display selected file name
    const fileDisplay = document.getElementById("selectedFileDisplay");
    if (fileDisplay) {
      fileDisplay.textContent = `Selected file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
      fileDisplay.className = "text-sm font-medium w-full border p-2 rounded bg-muted";
    }
  };
  
  // Handle file upload for a program
  const handleFileUpload = async () => {
    if (!selectedFile || !selectedProgram) {
      toast({
        title: "No file selected",
        description: "Please select a file first",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);

    try {
      await uploadProgramAgreement(selectedProgram.id, selectedFile);
      toast({
        title: "Agreement Uploaded",
        description: "Your agreement has been sent to Thanks Roger for template creation",
      });
      refetchAgreements();
      
      // Reset the file selection
      setSelectedFile(null);
      
      // Reset the file display
      const fileDisplay = document.getElementById("selectedFileDisplay");
      if (fileDisplay) {
        fileDisplay.textContent = "No file selected";
        fileDisplay.className = "text-sm text-muted-foreground w-full";
      }
      
      // Reset the file input
      const fileInput = document.getElementById("agreement-file") as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to upload agreement: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Open the edit dialog and populate the form with program data
  const handleEditProgram = (program: MerchantProgram) => {
    setSelectedProgram(program);
    form.reset({
      name: program.name,
      description: program.description || "",
      durationMonths: program.durationMonths,
    });
    setIsEditDialogOpen(true);
  };

  // Open the agreements dialog for a program
  const handleManageAgreements = (program: MerchantProgram) => {
    setSelectedProgram(program);
    setIsAgreementsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Financing Programs</CardTitle>
            <CardDescription>
              Manage the financing programs you offer to your customers
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Add Program
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Program</DialogTitle>
                <DialogDescription>
                  Create a new financing program for your customers
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Program Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter program name" />
                        </FormControl>
                        <FormDescription>
                          A descriptive name for this financing program
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Enter program description"
                            className="resize-none"
                          />
                        </FormControl>
                        <FormDescription>
                          Provide details about the financing program
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="durationMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (Months)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormDescription>
                          The duration of this financing program in months
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createProgram.isPending}>
                      {createProgram.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Program"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : programs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No programs found. Create your first program to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program Name</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="font-medium">{program.name}</TableCell>
                    <TableCell>{program.durationMonths} months</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          program.active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {program.active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProgram(program)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageAgreements(program)}
                        >
                          <FileText className="h-4 w-4" />
                          <span className="sr-only">Agreements</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the program and all associated
                                agreements. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteProgram.mutate(program.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Program Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Program</DialogTitle>
            <DialogDescription>
              Update the details of your financing program
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitUpdate)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter program name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter program description"
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="durationMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (Months)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateProgram.isPending}>
                  {updateProgram.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Program"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Agreements Dialog */}
      <Dialog open={isAgreementsDialogOpen} onOpenChange={setIsAgreementsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Program Agreements</DialogTitle>
            <DialogDescription>
              Manage sales agreements for {selectedProgram?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Upload new agreement */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Upload New Agreement</h3>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <div className="flex flex-col items-start gap-4">
                  <div className="w-full flex items-center gap-2">
                    <input
                      id="agreement-file"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleFileSelection}
                    />
                    <Button 
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        const fileInput = document.getElementById("agreement-file");
                        if (fileInput) {
                          fileInput.click();
                        }
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Select Document
                    </Button>
                    <Button 
                      type="button"
                      disabled={isUploading}
                      className="min-w-[120px]"
                      onClick={handleFileUpload}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <div id="selectedFileDisplay" className="text-sm text-muted-foreground w-full">
                    No file selected
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Accepted file types: PDF, DOC, DOCX. This agreement will be sent to Thanks Roger for template creation.
                  </p>
                </div>
              </form>
            </div>

            {/* List of agreements */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-4">Existing Agreements</h3>
              {isAgreementsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : agreements.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No agreements found. Upload your first agreement.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreements.map((agreement: ProgramAgreement) => (
                      <TableRow key={agreement.id}>
                        <TableCell className="font-medium">
                          {agreement.originalFilename}
                        </TableCell>
                        <TableCell>{agreement.mimeType}</TableCell>
                        <TableCell>
                          {agreement.fileSize
                            ? `${Math.round(agreement.fileSize / 1024)} KB`
                            : "Unknown"}
                        </TableCell>
                        <TableCell>
                          {new Date(agreement.uploadedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this agreement. This action
                                    cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteAgreement.mutate(agreement.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}