import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft } from "lucide-react";
import { FormInputField } from "@/components/common/forms/FormInputField";
import { SelectFormField } from "@/components/common/forms/SelectFormField";
import { CheckboxFormField } from "@/components/common/forms/CheckboxFormField";
import { apiClient } from "@/lib/api/apiClient";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  phone: z.string().min(10, { message: "Please enter a valid phone number." }),
  company: z.string().optional(),
  investmentAmount: z.string().min(1, { message: "Please indicate your investment amount." }),
  investmentGoals: z.string().min(1, { message: "Please select your investment goals." }),
  isAccredited: z.boolean().refine(val => val === true, {
    message: "You must be an accredited investor to register.",
  }),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function InvestorSignup() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      investmentAmount: "",
      investmentGoals: "",
      isAccredited: false,
      agreeToTerms: false,
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      // Send the application data to the backend using our new API client
      const response = await apiClient.post<{
        success: boolean; 
        userId?: number; 
        token?: string; 
        existingUser?: boolean
      }>("/api/investor/applications", data);
      
      // Check for errors
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Check if the user already exists
      if (response.data?.existingUser) {
        toast({
          title: "Email already exists",
          description: "This email is already registered. Please login or use a different email.",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }
      
      // Show success message
      toast({
        title: "Application Approved",
        description: "Your investor application has been pre-approved. Please complete the verification process.",
      });
      
      // Redirect to KYC verification page
      setTimeout(() => {
        navigate("/investor/verify/kyc");
      }, 1000);
    } catch (error: any) {
      console.error("Signup error:", error);
      
      // Handle specific error types
      if (error.message && error.message.includes("Email already exists")) {
        toast({
          title: "Email already exists",
          description: "This email is already registered. Please login or use a different email.",
          variant: "destructive"
        });
      } else if (error.message && error.message.includes("CSRF")) {
        toast({
          title: "Security Verification Failed",
          description: "Your session may have expired. Please refresh the page and try again.",
          variant: "destructive",
        });
      } else {
        // Generic error message for other errors
        toast({
          title: "Submission Failed",
          description: "There was an error submitting your application. Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <Button 
          variant="ghost" 
          className="mb-2 gap-1"
          onClick={() => navigate("/investor")}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Investor Portal
        </Button>
        <h1 className="text-3xl font-bold">Investor Application</h1>
        <p className="text-muted-foreground mt-2">
          Complete this form to apply for access to ShiFi's Investor Portal. Our team will review your application and reach out to you directly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Details</CardTitle>
          <CardDescription>
            Please provide the following information to apply for investor access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInputField
                  control={form.control}
                  name="name"
                  label="Full Name"
                  placeholder="John Smith"
                />
                <FormInputField
                  control={form.control}
                  name="email"
                  label="Email Address"
                  placeholder="john@example.com"
                  type="email"
                />
                <FormInputField
                  control={form.control}
                  name="phone"
                  label="Phone Number"
                  placeholder="(555) 123-4567"
                />
                <FormInputField
                  control={form.control}
                  name="company"
                  label="Company/Organization (Optional)"
                  placeholder="Your company name"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Investment Information</h3>
                
                <SelectFormField
                  control={form.control}
                  name="investmentAmount"
                  label="Approximate Investment Amount"
                  placeholder="Select an amount"
                  options={[
                    { value: "50k-100k", label: "$50,000 - $100,000" },
                    { value: "100k-250k", label: "$100,000 - $250,000" },
                    { value: "250k-500k", label: "$250,000 - $500,000" },
                    { value: "500k-1m", label: "$500,000 - $1,000,000" },
                    { value: "1m+", label: "$1,000,000+" }
                  ]}
                />
                
                <SelectFormField
                  control={form.control}
                  name="investmentGoals"
                  label="Investment Goals"
                  placeholder="Select your investment goal"
                  options={[
                    { value: "change_world", label: "Change the World for Good" },
                    { value: "multiple_wealth", label: "Multiple Wealth" },
                    { value: "both", label: "Both" }
                  ]}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Investor Qualification</h3>
                
                <CheckboxFormField
                  control={form.control}
                  name="isAccredited"
                  label="I confirm that I am an accredited investor as defined by the SEC"
                  description="An individual with income exceeding $200,000 (or $300,000 with spouse) in each of the prior two years, or with a net worth over $1 million, excluding primary residence."
                />
                
                <CheckboxFormField
                  control={form.control}
                  name="agreeToTerms"
                  label="I agree to the terms and conditions"
                  description={<>By checking this box, you agree to our <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>.</>}
                />
              </div>

              <CardFooter className="flex justify-end px-0 pb-0">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}