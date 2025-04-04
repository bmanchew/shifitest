import React, { useState, useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Contract } from "@shared/schema";

// Define form schema with validation
const ticketFormSchema = z.object({
  subject: z
    .string()
    .min(5, { message: "Subject must be at least 5 characters" })
    .max(100, { message: "Subject cannot exceed 100 characters" }),
  category: z.enum(["accounting", "customer_issue", "technical_issue", "other"], {
    required_error: "Please select a category",
  }),
  priority: z.enum(["low", "normal", "high", "urgent"], {
    required_error: "Please select a priority",
  }),
  description: z
    .string()
    .min(20, { message: "Description must be at least 20 characters" })
    .max(2000, { message: "Description cannot exceed 2000 characters" }),
  contractId: z.string().optional(),
  attachments: z.any().optional(),
});

type TicketFormValues = z.infer<typeof ticketFormSchema>;

interface TicketSubmissionFormProps {
  merchantId: number;
  onSuccess: (id: number, ticketNumber: string) => void;
  initialValues?: Partial<TicketFormValues>;
  contractId?: number | null;
}

interface CustomerInfo {
  id: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export function TicketSubmissionForm({
  merchantId,
  onSuccess,
  initialValues,
  contractId,
}: TicketSubmissionFormProps) {
  // Helper to convert null to undefined for type compatibility
  const nullToUndefined = <T,>(value: T | null): T | undefined => 
    value === null ? undefined : value;
    
  const { toast } = useToast();
  const { user } = useAuth();
  const [contractSearchTerm, setContractSearchTerm] = useState("");
  const [contractSearchOpen, setContractSearchOpen] = useState(false);
  const [customerCache, setCustomerCache] = useState<Record<number, CustomerInfo>>({});
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Fetch all contracts for this merchant
  const { 
    data: contractsData,
    isLoading: isLoadingContracts,
    isError: isContractsError,
    refetch: refetchContracts,
    error: contractsError
  } = useQuery<{ success: boolean, contracts: Contract[] } | Contract[]>({
    queryKey: ["/api/contracts", { merchantId }],
    queryFn: async () => {
      try {
        console.log('Fetching contracts for merchant ID:', merchantId);
        const res = await fetch(`/api/contracts?merchantId=${merchantId}`, {
          credentials: "include",
        });
        
        if (!res.ok) {
          console.error('Contracts API error:', res.status, await res.text());
          throw new Error(`Failed to fetch contracts: ${res.status}`);
        }
        
        const data = await res.json();
        console.log('Contract API Response:', data);
        return data;
      } catch (error) {
        console.error('Contract fetch error:', error);
        throw error;
      }
    },
    enabled: !!merchantId,
    retry: 3, // Retry up to 3 times
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true, // Refresh when tab gets focus
  });
  
  // Retry contracts fetch if it fails
  useEffect(() => {
    if (isContractsError && merchantId) {
      console.log('Error fetching contracts, will retry in 2 seconds');
      const retryTimer = setTimeout(() => {
        console.log('Retrying contracts fetch...');
        refetchContracts();
      }, 2000);
      
      return () => clearTimeout(retryTimer);
    }
  }, [isContractsError, merchantId, refetchContracts]);
  
  // Handle both response formats:
  // 1. Direct array of contracts (old format)
  // 2. Object with { success: boolean, contracts: Contract[] } (new format)
  const contracts = useMemo(() => {
    return Array.isArray(contractsData) 
      ? contractsData 
      : (contractsData?.contracts || []);
  }, [contractsData]);

  // Initialize form with default values
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      subject: initialValues?.subject || "",
      category: initialValues?.category || "technical_issue",
      priority: initialValues?.priority || "normal",
      description: initialValues?.description || "",
      contractId: contractId ? String(contractId) : "",
      attachments: undefined,
    },
  });

  // If contractId prop is provided, find that contract
  useEffect(() => {
    if (contractId && contracts.length > 0) {
      const foundContract = contracts.find((c: Contract) => c.id === contractId);
      if (foundContract) {
        setSelectedContract(foundContract);
      }
    }
  }, [contractId, contracts]);

  const isSubmitting = form.formState.isSubmitting;

  // Fetch customer data for a specific customerId
  const fetchCustomer = async (customerId: number) => {
    if (customerCache[customerId]) {
      return customerCache[customerId];
    }
    
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch customer with ID ${customerId}`);
      }
      
      const customer = await response.json();
      setCustomerCache(prev => ({ ...prev, [customerId]: customer }));
      return customer;
    } catch (error) {
      console.error(`Error fetching customer ${customerId}:`, error);
      return { id: customerId };
    }
  };

  // Hook to fetch customer data for all contracts
  useQuery({
    queryKey: ["customers", contracts.map((c: Contract) => c.customerId).filter(Boolean)],
    queryFn: async () => {
      // Get all customer IDs from contracts, filtering out null/undefined values
      const customerIds = contracts
        .map((c: Contract) => c.customerId)
        .filter((id): id is number => id !== null && id !== undefined);
      
      // Remove duplicates
      const uniqueIds = [...new Set(customerIds)];
      
      // Fetch data for each customer ID
      await Promise.all(uniqueIds.map((id: number) => fetchCustomer(id)));
      return true;
    },
    enabled: contracts.length > 0,
  });

  // Helper function to get customer name for display
  const getCustomerName = (customerId?: number) => {
    if (!customerId) return "Unknown Customer";
    
    const customer = customerCache[customerId];
    if (!customer) return `Loading...`;
    
    if (customer.name) return customer.name;
    if (customer.firstName && customer.lastName) return `${customer.firstName} ${customer.lastName}`;
    if (customer.firstName) return customer.firstName;
    if (customer.lastName) return customer.lastName;
    if (customer.email) return customer.email.split('@')[0];
    if (customer.phone) return customer.phone;
    
    return `Customer ${customerId}`;
  };

  // Function to format contract ID and customer info for display
  const formatContractInfo = (contract: Contract) => {
    return `#${contract.contractNumber} - ${getCustomerName(nullToUndefined(contract.customerId))}`;
  };

  // Handler for contract selection
  const handleContractSelect = (contract: Contract) => {
    setSelectedContract(contract);
    form.setValue("contractId", String(contract.id));
    setContractSearchOpen(false);
  };

  // Filter contracts based on search term
  const filteredContracts = contracts.filter((contract: Contract) => 
    contract.contractNumber?.toLowerCase().includes(contractSearchTerm.toLowerCase()) ||
    getCustomerName(nullToUndefined(contract.customerId))?.toLowerCase().includes(contractSearchTerm.toLowerCase())
  );

  const onSubmit = async (values: TicketFormValues) => {
    try {
      console.log("Form submission started with values:", values);
      console.log("Current user from useAuth():", user);
      console.log("Merchant ID:", merchantId);
      
      // If no merchantId is provided, show error
      if (!merchantId) {
        console.error("No merchant ID available");
        toast({
          title: "Error",
          description: "Merchant information is missing. Please try again later.",
          variant: "destructive",
        });
        return;
      }

      // Try a backup approach for getting user ID
      let submitterId = null;
      
      // First check if user is available from auth context
      if (user && user.id) {
        console.log("Using user ID from auth context:", user.id);
        submitterId = user.id;
      } else {
        console.log("No user in auth context, fetching from API");
        
        // Fallback to API if auth context doesn't have user
        try {
          const userResponse = await fetch("/api/users/me", {
            credentials: "include"
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log("User data from API:", userData);
            if (userData.id) {
              submitterId = userData.id;
              console.log("Using user ID from API:", submitterId);
            }
          } else {
            console.error("Failed to fetch user data:", await userResponse.text());
          }
        } catch (error) {
          console.error("Error fetching user:", error);
        }
      }
      
      // Final check for user ID
      if (!submitterId) {
        console.error("No user ID available after all attempts");
        toast({
          title: "Error",
          description: "Could not determine your user information. Please try logging out and back in.",
          variant: "destructive",
        });
        return;
      }

      // Create form data for submission
      const ticketData = {
        ...values,
        merchantId,
        contractId: values.contractId ? Number(values.contractId) : null,
        // Add createdBy field which is required by the API
        createdBy: submitterId,
      };

      console.log("Submitting ticket data:", ticketData);

      // Submit ticket to API using the correct endpoint
      const response = await fetch("/api/communications/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ticketData),
      });

      const responseText = await response.text();
      console.log("API Response:", responseText);
      
      if (!response.ok) {
        console.error("Server error response status:", response.status);
        console.error("Server error response:", responseText);
        throw new Error("Failed to submit support ticket");
      }

      const data = JSON.parse(responseText);
      
      // Show success message
      toast({
        title: "Ticket Submitted",
        description: `Your support ticket #${data.ticketNumber} has been created successfully.`,
        variant: "default",
      });

      // Call success callback
      onSuccess(data.id, data.ticketNumber);
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your ticket. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Brief description of your issue" 
                  {...field} 
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>
                A clear and concise title for your support request
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="accounting">Accounting & Billing</SelectItem>
                    <SelectItem value="customer_issue">Customer Issue</SelectItem>
                    <SelectItem value="technical_issue">Technical Issue</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Select the category that best describes your issue
                </FormDescription>
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
                  disabled={isSubmitting}
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
                <FormDescription>
                  How urgent is this issue for you?
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Please provide detailed information about your issue..."
                  className="min-h-[150px] resize-y"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>
                Include any relevant details, steps to reproduce, error messages, or context that might help us resolve your issue
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Enhanced Contract Selection */}
        {!contractId && (
          <FormField
            control={form.control}
            name="contractId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Related Contract (Optional)</FormLabel>
                <Popover open={contractSearchOpen} onOpenChange={setContractSearchOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={contractSearchOpen}
                        className="w-full justify-between"
                        disabled={isSubmitting || isLoadingContracts}
                      >
                        {isLoadingContracts ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading contracts...
                          </>
                        ) : selectedContract ? (
                          formatContractInfo(selectedContract)
                        ) : isContractsError ? (
                          "Error loading contracts - Click to retry"
                        ) : (
                          "Select a contract..."
                        )}
                        {!isLoadingContracts && !isContractsError && (
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        )}
                        {isContractsError && (
                          <RefreshCw className="ml-2 h-4 w-4 shrink-0 opacity-50" onClick={(e) => {
                            e.stopPropagation();
                            refetchContracts();
                          }} />
                        )}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput 
                        placeholder="Search contracts or customers..." 
                        value={contractSearchTerm}
                        onValueChange={setContractSearchTerm}
                        disabled={isLoadingContracts}
                      />
                      <CommandList>
                        {isLoadingContracts ? (
                          <div className="flex flex-col items-center justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <p className="mt-2 text-sm text-muted-foreground">Loading contracts...</p>
                          </div>
                        ) : isContractsError ? (
                          <div className="flex flex-col items-center justify-center py-6">
                            <AlertTriangle className="h-6 w-6 text-destructive" />
                            <p className="mt-2 text-sm text-muted-foreground">Failed to load contracts</p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => refetchContracts()}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" /> Retry
                            </Button>
                          </div>
                        ) : filteredContracts.length === 0 ? (
                          <CommandEmpty>No contracts found.</CommandEmpty>
                        ) : (
                          <CommandGroup heading={`Contracts (${filteredContracts.length})`}>
                            {filteredContracts.map((contract) => (
                              <CommandItem
                                key={contract.id}
                                value={String(contract.id)}
                                onSelect={() => handleContractSelect(contract)}
                              >
                                <div className="flex flex-col">
                                  <div className="flex items-center">
                                    <span className="font-medium">#{contract.contractNumber}</span>
                                    <Badge 
                                      variant={
                                        contract.status === 'active' ? 'success' : 
                                        contract.status === 'pending' ? 'warning' : 
                                        contract.status === 'completed' ? 'default' : 'destructive'
                                      }
                                      className="ml-2"
                                    >
                                      {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                                    </Badge>
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {getCustomerName(nullToUndefined(contract.customerId))}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  If your issue relates to a specific contract, select it from the list
                  {isContractsError && (
                    <span className="ml-1 text-destructive">
                      (Error loading contracts. <Button variant="link" className="p-0 h-auto" onClick={() => refetchContracts()}>Retry</Button>)
                    </span>
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              "Submit Ticket"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}