import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { formatPhoneNumber } from '@/lib/formatters';
import { toast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Form validation schema
const formSchema = z.object({
  customerName: z.string().min(3, {
    message: 'Customer name must be at least 3 characters.',
  }),
  phoneNumber: z.string().min(10, {
    message: 'Phone number must be at least 10 digits.',
  }),
  amount: z.string().min(1, {
    message: 'Amount is required.',
  }),
  term: z.string().default('24'),
});

type FormValues = z.infer<typeof formSchema>;

interface SendApplicationProps {
  merchantId?: number;
}

export default function SendApplication({ merchantId = 2 }: SendApplicationProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: '',
      phoneNumber: '',
      amount: '',
      term: '24',
    },
  });

  const onSubmit = async (formData: FormValues) => {
    // Format phone number - remove any non-digit characters
    const formattedPhone = formData.phoneNumber.replace(/\D/g, '');
    const amount = parseFloat(formData.amount);
    const term = parseInt(formData.term);
    
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Send the application via SMS
      const response = await apiRequest('POST', '/api/send-application', {
        phoneNumber: formattedPhone,
        customerName: formData.customerName,
        merchantId: merchantId,
        amount: amount
      });

      console.log("SMS API Response:", response);

      // Check if we have a contract ID in the response
      if (response.contractId) {
        toast({
          title: "Success",
          description: `Application sent to ${formatPhoneNumber(formattedPhone)}`,
        });

        // Navigate to the contract details page
        navigate(`/admin/contracts/${response.contractId}`);
      } else if (response.success) {
        // If success but no contractId, just show success without navigation
        toast({
          title: "Success",
          description: `Application sent to ${formatPhoneNumber(formattedPhone)}`,
        });

        // Reset form after successful submission
        form.reset();
      } else {
        console.error("Contract ID is invalid or missing from API response:", response);
        toast({
          title: "Error",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error sending application:", error);
      console.error("Error details:", {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        requestData: {
          phoneNumber: formattedPhone,
          customerName: formData.customerName,
          merchantId: merchantId,
          amount: amount
        }
      });
      
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Send Application</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter customer name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter phone number" 
                      {...field} 
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        field.onChange(formatted);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter amount" 
                      type="number" 
                      step="0.01" 
                      min="0"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="term"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Term (Months)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter term in months" 
                      type="number" 
                      min="1"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send Application"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}