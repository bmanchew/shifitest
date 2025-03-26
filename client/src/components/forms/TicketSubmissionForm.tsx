import React from "react";
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export function TicketSubmissionForm({
  merchantId,
  onSuccess,
  initialValues,
  contractId,
}: TicketSubmissionFormProps) {
  const { toast } = useToast();

  // Initialize form with default values
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      subject: initialValues?.subject || "",
      category: initialValues?.category || "technical_issue",
      priority: initialValues?.priority || "normal",
      description: initialValues?.description || "",
      contractId: contractId ? String(contractId) : undefined,
      attachments: undefined,
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: TicketFormValues) => {
    try {
      // If no merchantId is provided, show error
      if (!merchantId) {
        toast({
          title: "Error",
          description: "Merchant information is missing. Please try again later.",
          variant: "destructive",
        });
        return;
      }

      // Create form data for submission
      const ticketData = {
        ...values,
        merchantId,
        contractId: values.contractId ? Number(values.contractId) : null,
      };

      // Submit ticket to API
      const response = await fetch("/api/support-tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ticketData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit support ticket");
      }

      const data = await response.json();
      
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

        {/* Contract ID field - hidden if contractId is provided as prop */}
        {!contractId && (
          <FormField
            control={form.control}
            name="contractId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contract ID (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter contract ID if applicable"
                    {...field}
                    disabled={isSubmitting}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  If your issue relates to a specific contract, enter the contract ID
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