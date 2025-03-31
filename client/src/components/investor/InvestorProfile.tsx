import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { InvestorLayout } from "./InvestorLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  CheckCircle2, 
  Clock, 
  FileCheck, 
  FileQuestion, 
  Info, 
  LockKeyhole, 
  Save, 
  User 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the form schema
const profileFormSchema = z.object({
  legalName: z.string().min(2, {
    message: "Legal name must be at least 2 characters.",
  }),
  address: z.string().min(5, {
    message: "Address must be at least 5 characters.",
  }),
  city: z.string().min(2, {
    message: "City must be at least 2 characters.",
  }),
  state: z.string().min(2, {
    message: "State must be at least 2 characters.",
  }),
  zipCode: z.string().min(5, {
    message: "Zip code must be at least 5 characters.",
  }),
  country: z.string().min(2, {
    message: "Country must be at least 2 characters.",
  }),
  phone: z.string().min(10, {
    message: "Phone number must be at least 10 characters.",
  }),
  isAccredited: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function InvestorProfile() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch investor profile
  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ['/api/investor/profile'],
    retry: false,
  });

  // Set up form with default values from API
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      legalName: profileData?.investorProfile?.legalName || "",
      address: profileData?.investorProfile?.address || "",
      city: profileData?.investorProfile?.city || "",
      state: profileData?.investorProfile?.state || "",
      zipCode: profileData?.investorProfile?.zipCode || "",
      country: profileData?.investorProfile?.country || "US",
      phone: profileData?.investorProfile?.phone || "",
      isAccredited: profileData?.investorProfile?.isAccredited || false,
    },
    values: profileData?.investorProfile ? {
      legalName: profileData.investorProfile.legalName || "",
      address: profileData.investorProfile.address || "",
      city: profileData.investorProfile.city || "",
      state: profileData.investorProfile.state || "",
      zipCode: profileData.investorProfile.zipCode || "",
      country: profileData.investorProfile.country || "US",
      phone: profileData.investorProfile.phone || "",
      isAccredited: profileData.investorProfile.isAccredited || false,
    } : undefined,
  });

  // Handle form submission
  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);
    try {
      // Call the API to update the profile
      await fetch('/api/investor/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "There was an error updating your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render KYC status badge
  const renderKycStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <div className="flex items-center space-x-2 bg-green-100 text-green-700 px-3 py-1 rounded-full">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Verified</span>
          </div>
        );
      case "pending":
        return (
          <div className="flex items-center space-x-2 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Pending Verification</span>
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center space-x-2 bg-red-100 text-red-700 px-3 py-1 rounded-full">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">Verification Failed</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
            <FileQuestion className="h-4 w-4" />
            <span className="text-sm font-medium">Not Started</span>
          </div>
        );
    }
  };

  return (
    <InvestorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investor Profile</h1>
          <p className="text-muted-foreground">
            Manage your investor information and verification status
          </p>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Profile Form */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your investor profile details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="legalName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Full legal name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Street address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="State" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zip Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Zip code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="Country" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Phone number" 
                            type="tel" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isAccredited"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Accredited Investor
                          </FormLabel>
                          <FormDescription>
                            Indicate if you are an accredited investor
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-readonly
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isSubmitting}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Verification Status */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileCheck className="mr-2 h-5 w-5" />
                  Verification Status
                </CardTitle>
                <CardDescription>
                  Your current verification status and documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">KYC Verification</h3>
                    {profileData?.investorProfile && renderKycStatusBadge(profileData.investorProfile.kycStatus)}
                  </div>
                  
                  {profileData?.investorProfile?.kycStatus === "not_started" && (
                    <div className="mt-2">
                      <Button className="w-full">Start KYC Process</Button>
                    </div>
                  )}
                  
                  {profileData?.investorProfile?.kycStatus === "pending" && (
                    <p className="text-sm text-muted-foreground">
                      Your verification is being processed. This usually takes 1-2 business days.
                    </p>
                  )}
                  
                  {profileData?.investorProfile?.kycStatus === "rejected" && (
                    <>
                      <p className="text-sm text-red-600 mb-2">
                        Your verification was rejected. Please review the reason below and resubmit.
                      </p>
                      <Button className="w-full">Resubmit KYC</Button>
                    </>
                  )}
                </div>
                
                <div className="rounded-lg border p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Non-Disclosure Agreement</h3>
                    {profileData?.investorProfile?.ndaSigned ? (
                      <div className="flex items-center space-x-2 bg-green-100 text-green-700 px-3 py-1 rounded-full">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Signed</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
                        <LockKeyhole className="h-4 w-4" />
                        <span className="text-sm font-medium">Required</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2">
                    A signed NDA is required to access confidential investment documents.
                  </p>
                  
                  {!profileData?.investorProfile?.ndaSigned && (
                    <Button variant="outline" className="w-full">
                      Sign NDA
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bank Account */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <LockKeyhole className="mr-2 h-5 w-5" />
                  Banking Information
                </CardTitle>
                <CardDescription>
                  Connect your bank account for investments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profileData?.investorProfile?.plaidItemId ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{profileData.investorProfile.bankAccountName}</p>
                        <p className="text-sm text-muted-foreground">
                          Account ending in {profileData.investorProfile.bankAccountMask}
                        </p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <Button variant="outline" className="w-full">
                      Update Bank Account
                    </Button>
                  </div>
                ) : (
                  <>
                    <Alert className="mb-4">
                      <AlertTitle>Bank Account Required</AlertTitle>
                      <AlertDescription>
                        You need to connect a bank account to make investments.
                      </AlertDescription>
                    </Alert>
                    <Button className="w-full">
                      Connect Bank Account
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </InvestorLayout>
  );
}