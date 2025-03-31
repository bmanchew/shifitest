import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "wouter";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileText,
  Upload,
  User,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";

// Form validation schema
const profileFormSchema = z.object({
  fullName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid phone number." }),
  address: z.string().min(5, { message: "Address is required." }),
  city: z.string().min(2, { message: "City is required." }),
  state: z.string().min(2, { message: "State is required." }),
  zipCode: z.string().min(5, { message: "ZIP code is required." }),
  investorType: z.enum(["individual", "entity"], {
    required_error: "Please select investor type.",
  }),
  entityName: z.string().optional(),
  entityType: z.string().optional(),
  accreditedInvestorStatus: z.boolean(),
  investmentExperience: z.string().min(1, { message: "Please select your investment experience." }),
  investmentGoals: z.string().min(1, { message: "Please describe your investment goals." }),
  riskTolerance: z.string().min(1, { message: "Please select your risk tolerance." }),
  investmentHorizon: z.string().min(1, { message: "Please select your investment horizon." }),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms and conditions.",
  }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function InvestorProfile() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  
  // Fetch investor profile data
  const profileQuery = useQuery({
    queryKey: ["/api/investor/profile"],
    retry: false,
  });

  // Current profile state
  const profile = profileQuery.data?.profile;
  const isKycVerified = profile?.kycStatus === "verified";
  const isNdaSigned = profile?.ndaSigned || false;
  const hasBankAccount = profile?.bankAccountName ? true : false;

  // Mutation for updating profile
  const updateProfile = useMutation({
    mutationFn: (data: ProfileFormValues) => {
      return apiRequest(`/api/investor/profile`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your investor profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/investor/profile"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was an error updating your profile. Please try again.",
        variant: "destructive",
      });
      console.error("Profile update error:", error);
    },
  });

  // NDA agreement mutation
  const signNda = useMutation({
    mutationFn: () => {
      return apiRequest(`/api/investor/sign-nda`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "NDA Signed",
        description: "You have successfully signed the NDA agreement.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/investor/profile"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was an error signing the NDA. Please try again.",
        variant: "destructive",
      });
      console.error("NDA signing error:", error);
    },
  });

  // KYC verification mutation
  const submitKycVerification = useMutation({
    mutationFn: () => {
      return apiRequest(`/api/investor/kyc/submit`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "KYC Verification Submitted",
        description: "Your KYC verification has been submitted for review.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/investor/profile"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was an error submitting your KYC verification. Please try again.",
        variant: "destructive",
      });
      console.error("KYC verification error:", error);
    },
  });

  // Connect bank account mutation
  const connectBankAccount = useMutation({
    mutationFn: () => {
      return apiRequest(`/api/investor/connect-bank`, {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      // If there's a redirect URL in the response, redirect the user
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast({
          title: "Bank Connection Initiated",
          description: "Please follow the steps to connect your bank account.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/investor/profile"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was an error connecting your bank account. Please try again.",
        variant: "destructive",
      });
      console.error("Bank connection error:", error);
    },
  });

  // Setup react-hook-form
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: profile?.fullName || user?.name || "",
      phoneNumber: profile?.phoneNumber || "",
      address: profile?.address || "",
      city: profile?.city || "",
      state: profile?.state || "",
      zipCode: profile?.zipCode || "",
      investorType: profile?.investorType || "individual",
      entityName: profile?.entityName || "",
      entityType: profile?.entityType || "",
      accreditedInvestorStatus: profile?.accreditedInvestorStatus || false,
      investmentExperience: profile?.investmentExperience || "",
      investmentGoals: profile?.investmentGoals || "",
      riskTolerance: profile?.riskTolerance || "",
      investmentHorizon: profile?.investmentHorizon || "",
      agreeToTerms: profile?.agreeToTerms || false,
    },
  });

  // Watch the investorType field to conditionally render entity fields
  const watchInvestorType = form.watch("investorType");

  // Handle form submission
  function onSubmit(data: ProfileFormValues) {
    updateProfile.mutate(data);
  }

  // Get verification status for UI display
  const getVerificationStepStatus = (step: string) => {
    if (step === "profile") {
      return profile ? "complete" : "incomplete";
    } else if (step === "kyc") {
      if (profile?.kycStatus === "verified") return "verified";
      if (profile?.kycStatus === "pending") return "pending";
      if (profile?.kycStatus === "rejected") return "rejected";
      return "incomplete";
    } else if (step === "nda") {
      return isNdaSigned ? "complete" : "incomplete";
    } else if (step === "bank") {
      return profile?.bankAccountName ? "complete" : "incomplete";
    }
    return "incomplete";
  };

  // Get status badge color
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "verified":
      case "complete":
        return "default";
      case "pending":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Get status badge text
  const getStatusBadgeText = (status: string) => {
    switch (status) {
      case "verified":
      case "complete":
        return "Completed";
      case "pending":
        return "Pending";
      case "rejected":
        return "Rejected";
      default:
        return "Incomplete";
    }
  };

  // Loading state
  if (profileQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="animate-pulse bg-muted h-8 w-1/3 rounded"></CardTitle>
            <CardDescription className="animate-pulse bg-muted h-4 w-2/3 rounded"></CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="animate-pulse bg-muted h-4 w-1/4 rounded"></div>
                  <div className="animate-pulse bg-muted h-10 w-full rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Investor Profile</h1>
        <p className="text-muted-foreground">
          Manage your investor profile and verification
        </p>
      </div>

      {/* Verification Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Progress</CardTitle>
          <CardDescription>
            Complete all steps to fully verify your investor account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {/* Profile Step */}
            <div 
              className={`flex flex-col space-y-2 rounded-md border p-4 ${getVerificationStepStatus("profile") === "complete" ? "border-green-200 bg-green-50" : "border-gray-200"}`}
              onClick={() => setActiveTab("profile")}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">1. Profile</span>
                <Badge variant={getStatusBadgeVariant(getVerificationStepStatus("profile"))}>
                  {getStatusBadgeText(getVerificationStepStatus("profile"))}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Complete your basic profile information
              </p>
              {getVerificationStepStatus("profile") === "complete" && (
                <CheckCircle2 className="h-5 w-5 text-green-600 self-end" />
              )}
            </div>

            {/* KYC Step */}
            <div 
              className={`flex flex-col space-y-2 rounded-md border p-4 ${
                getVerificationStepStatus("kyc") === "verified" 
                  ? "border-green-200 bg-green-50" 
                  : getVerificationStepStatus("kyc") === "pending"
                  ? "border-blue-200 bg-blue-50"
                  : getVerificationStepStatus("kyc") === "rejected"
                  ? "border-red-200 bg-red-50"
                  : "border-gray-200"
              }`}
              onClick={() => setActiveTab("kyc")}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">2. KYC Verification</span>
                <Badge variant={getStatusBadgeVariant(getVerificationStepStatus("kyc"))}>
                  {getStatusBadgeText(getVerificationStepStatus("kyc"))}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Verify your identity
              </p>
              {getVerificationStepStatus("kyc") === "verified" && (
                <CheckCircle2 className="h-5 w-5 text-green-600 self-end" />
              )}
              {getVerificationStepStatus("kyc") === "pending" && (
                <CircleAlert className="h-5 w-5 text-blue-600 self-end" />
              )}
              {getVerificationStepStatus("kyc") === "rejected" && (
                <AlertCircle className="h-5 w-5 text-red-600 self-end" />
              )}
            </div>

            {/* NDA Step */}
            <div 
              className={`flex flex-col space-y-2 rounded-md border p-4 ${getVerificationStepStatus("nda") === "complete" ? "border-green-200 bg-green-50" : "border-gray-200"}`}
              onClick={() => setActiveTab("nda")}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">3. NDA Agreement</span>
                <Badge variant={getStatusBadgeVariant(getVerificationStepStatus("nda"))}>
                  {getStatusBadgeText(getVerificationStepStatus("nda"))}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Sign the non-disclosure agreement
              </p>
              {getVerificationStepStatus("nda") === "complete" && (
                <CheckCircle2 className="h-5 w-5 text-green-600 self-end" />
              )}
            </div>

            {/* Bank Step */}
            <div 
              className={`flex flex-col space-y-2 rounded-md border p-4 ${getVerificationStepStatus("bank") === "complete" ? "border-green-200 bg-green-50" : "border-gray-200"}`}
              onClick={() => setActiveTab("bank")}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">4. Bank Account</span>
                <Badge variant={getStatusBadgeVariant(getVerificationStepStatus("bank"))}>
                  {getStatusBadgeText(getVerificationStepStatus("bank"))}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your bank account
              </p>
              {getVerificationStepStatus("bank") === "complete" && (
                <CheckCircle2 className="h-5 w-5 text-green-600 self-end" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="kyc">KYC Verification</TabsTrigger>
          <TabsTrigger value="nda">NDA Agreement</TabsTrigger>
          <TabsTrigger value="bank">Bank Account</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Investor Profile</CardTitle>
              <CardDescription>
                Update your profile information. This is required for investments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    {/* Personal Information Section */}
                    <div>
                      <h3 className="text-lg font-medium">Personal Information</h3>
                      <Separator className="my-2" />
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John Doe" {...field} />
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
                                <Input placeholder="(555) 123-4567" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Address Section */}
                    <div>
                      <h3 className="text-lg font-medium">Address</h3>
                      <Separator className="my-2" />
                      <div className="grid gap-4">
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Street Address</FormLabel>
                              <FormControl>
                                <Input placeholder="123 Main St" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid gap-4 md:grid-cols-3">
                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>City</FormLabel>
                                <FormControl>
                                  <Input placeholder="New York" {...field} />
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
                                  <Input placeholder="NY" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="zipCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ZIP Code</FormLabel>
                                <FormControl>
                                  <Input placeholder="10001" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Investor Type Section */}
                    <div>
                      <h3 className="text-lg font-medium">Investor Information</h3>
                      <Separator className="my-2" />
                      <div className="grid gap-4">
                        <FormField
                          control={form.control}
                          name="investorType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Investor Type</FormLabel>
                              <div className="flex space-x-4">
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <input
                                      type="radio"
                                      value="individual"
                                      checked={field.value === "individual"}
                                      onChange={() => field.onChange("individual")}
                                      className="h-4 w-4"
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    Individual
                                  </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <input
                                      type="radio"
                                      value="entity"
                                      checked={field.value === "entity"}
                                      onChange={() => field.onChange("entity")}
                                      className="h-4 w-4"
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    Entity
                                  </FormLabel>
                                </FormItem>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Entity-specific fields */}
                        {watchInvestorType === "entity" && (
                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                              control={form.control}
                              name="entityName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Entity Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="ABC Investments LLC" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="entityType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Entity Type</FormLabel>
                                  <FormControl>
                                    <select
                                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                      {...field}
                                    >
                                      <option value="">Select Entity Type</option>
                                      <option value="llc">LLC</option>
                                      <option value="corporation">Corporation</option>
                                      <option value="partnership">Partnership</option>
                                      <option value="trust">Trust</option>
                                      <option value="other">Other</option>
                                    </select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        {/* Accredited Investor Status */}
                        <FormField
                          control={form.control}
                          name="accreditedInvestorStatus"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  I certify that I am an accredited investor
                                </FormLabel>
                                <FormDescription>
                                  An accredited investor meets certain income or net worth requirements as defined by the SEC. By checking this box, you are self-certifying your accredited investor status.
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        {/* Investment Experience */}
                        <FormField
                          control={form.control}
                          name="investmentExperience"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Investment Experience</FormLabel>
                              <FormControl>
                                <select
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  {...field}
                                >
                                  <option value="">Select Experience Level</option>
                                  <option value="beginner">Beginner (0-2 years)</option>
                                  <option value="intermediate">Intermediate (3-5 years)</option>
                                  <option value="experienced">Experienced (6-10 years)</option>
                                  <option value="expert">Expert (10+ years)</option>
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Investment Goals */}
                        <FormField
                          control={form.control}
                          name="investmentGoals"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Investment Goals</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Describe your investment goals and objectives"
                                  className="resize-none"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Risk Tolerance */}
                        <FormField
                          control={form.control}
                          name="riskTolerance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Risk Tolerance</FormLabel>
                              <FormControl>
                                <select
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  {...field}
                                >
                                  <option value="">Select Risk Tolerance</option>
                                  <option value="conservative">Conservative</option>
                                  <option value="moderate">Moderate</option>
                                  <option value="aggressive">Aggressive</option>
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Investment Horizon */}
                        <FormField
                          control={form.control}
                          name="investmentHorizon"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Investment Horizon</FormLabel>
                              <FormControl>
                                <select
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  {...field}
                                >
                                  <option value="">Select Investment Horizon</option>
                                  <option value="short_term">Short-term (0-2 years)</option>
                                  <option value="medium_term">Medium-term (3-5 years)</option>
                                  <option value="long_term">Long-term (5+ years)</option>
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Terms Agreement */}
                        <FormField
                          control={form.control}
                          name="agreeToTerms"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  I agree to the terms and conditions
                                </FormLabel>
                                <FormDescription>
                                  By checking this box, you agree to our{" "}
                                  <Link href="/terms-of-service" className="text-primary underline">
                                    Terms of Service
                                  </Link>{" "}
                                  and{" "}
                                  <Link href="/privacy-policy" className="text-primary underline">
                                    Privacy Policy
                                  </Link>
                                  .
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KYC Verification Tab */}
        <TabsContent value="kyc">
          <Card>
            <CardHeader>
              <CardTitle>KYC Verification</CardTitle>
              <CardDescription>
                Verify your identity to access investment opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* KYC Status Alert */}
              {getVerificationStepStatus("kyc") === "verified" ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Verification Successful</AlertTitle>
                  <AlertDescription className="text-green-700">
                    Your identity has been successfully verified. You can now access all investment opportunities.
                  </AlertDescription>
                </Alert>
              ) : getVerificationStepStatus("kyc") === "pending" ? (
                <Alert className="bg-blue-50 border-blue-200">
                  <CircleAlert className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800">Verification Pending</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    Your verification is currently being reviewed. This process typically takes 1-2 business days.
                  </AlertDescription>
                </Alert>
              ) : getVerificationStepStatus("kyc") === "rejected" ? (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800">Verification Failed</AlertTitle>
                  <AlertDescription className="text-red-700">
                    <p>Your verification was not successful. Reason: {profile?.kycRejectionReason || "Verification documents did not match provided information."}</p>
                    <Button className="mt-2" onClick={() => submitKycVerification.mutate()}>
                      Retry Verification
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <p>
                    To complete your KYC verification, we need to verify your identity. This is a regulatory requirement for all investors.
                  </p>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Verification Required</AlertTitle>
                    <AlertDescription>
                      You must complete your profile information before proceeding with KYC verification.
                    </AlertDescription>
                  </Alert>

                  <div className="bg-muted p-4 rounded-md">
                    <h3 className="font-medium mb-2">What you'll need:</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>A valid government-issued photo ID (passport, driver's license)</li>
                      <li>Proof of address (utility bill, bank statement dated within 3 months)</li>
                      <li>Social Security Number or Tax ID</li>
                      <li>A working camera for a quick selfie verification</li>
                    </ul>
                  </div>

                  <div className="mt-6">
                    <Button 
                      disabled={!profile || submitKycVerification.isPending} 
                      onClick={() => submitKycVerification.mutate()}
                    >
                      {submitKycVerification.isPending ? "Submitting..." : "Start Verification"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NDA Agreement Tab */}
        <TabsContent value="nda">
          <Card>
            <CardHeader>
              <CardTitle>NDA Agreement</CardTitle>
              <CardDescription>
                Sign the non-disclosure agreement to access confidential investment documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isNdaSigned ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">NDA Signed</AlertTitle>
                  <AlertDescription className="text-green-700">
                    You have successfully signed the NDA agreement. You can now access all confidential investment documents.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <p>
                    Before accessing confidential investment documents, you must sign our Non-Disclosure Agreement (NDA).
                  </p>

                  {!isKycVerified && (
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-800">KYC Verification Required</AlertTitle>
                      <AlertDescription className="text-amber-700">
                        You must complete KYC verification before signing the NDA agreement.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="border rounded-md p-4 max-h-64 overflow-y-auto">
                    <h3 className="font-bold mb-2">Non-Disclosure Agreement</h3>
                    <p className="text-sm mb-4">
                      This Non-Disclosure Agreement (the "Agreement") is entered into between ShiFi Investment Portal (the "Disclosing Party") and the undersigned investor (the "Recipient").
                    </p>
                    <p className="text-sm mb-2">
                      <strong>1. Confidential Information:</strong> For purposes of this Agreement, "Confidential Information" means any and all non-public information provided by the Disclosing Party to the Recipient, including but not limited to financial data, investment memoranda, business plans, proprietary technology, merchant contracts, and any other information that should reasonably be understood to be confidential.
                    </p>
                    <p className="text-sm mb-2">
                      <strong>2. Recipient's Obligations:</strong> The Recipient agrees to:
                    </p>
                    <ul className="list-disc pl-5 text-sm mb-2">
                      <li>Hold all Confidential Information in strict confidence</li>
                      <li>Not disclose Confidential Information to any third party</li>
                      <li>Use Confidential Information solely for the purpose of evaluating potential investments</li>
                      <li>Take reasonable measures to protect the confidentiality of all Confidential Information</li>
                    </ul>
                    <p className="text-sm mb-2">
                      <strong>3. Term:</strong> This Agreement shall remain in effect for a period of 2 years from the date of acceptance.
                    </p>
                    <p className="text-sm">
                      <strong>4. Electronic Signature:</strong> By clicking "Sign NDA Agreement" below, the Recipient acknowledges that they have read, understand, and agree to be bound by the terms of this Agreement, and that their electronic signature shall have the same legal effect as a handwritten signature.
                    </p>
                  </div>

                  <div className="mt-6">
                    <Button 
                      disabled={!isKycVerified || signNda.isPending} 
                      onClick={() => signNda.mutate()}
                    >
                      {signNda.isPending ? "Signing..." : "Sign NDA Agreement"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Account Tab */}
        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <CardTitle>Bank Account</CardTitle>
              <CardDescription>
                Connect your bank account for investments and distributions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasBankAccount ? (
                <div className="space-y-4">
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Bank Account Connected</AlertTitle>
                    <AlertDescription className="text-green-700">
                      Your bank account has been successfully connected. You can now make investments and receive distributions.
                    </AlertDescription>
                  </Alert>

                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2">Connected Account</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-sm text-muted-foreground">Bank Name:</div>
                      <div className="text-sm font-medium">{profile?.bankName}</div>
                      <div className="text-sm text-muted-foreground">Account Name:</div>
                      <div className="text-sm font-medium">{profile?.bankAccountName}</div>
                      <div className="text-sm text-muted-foreground">Account Type:</div>
                      <div className="text-sm font-medium">{profile?.bankAccountType}</div>
                      <div className="text-sm text-muted-foreground">Last 4 Digits:</div>
                      <div className="text-sm font-medium">XXXX-{profile?.bankAccountLast4}</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <Button 
                      variant="outline" 
                      onClick={() => connectBankAccount.mutate()}
                    >
                      Update Bank Account
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => toast({
                        title: "Feature Not Available",
                        description: "Removing a bank account is currently not available. Please contact support for assistance.",
                      })}
                    >
                      Remove Bank Account
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p>
                    Connect your bank account to make investments and receive distributions. We use secure bank connections through our trusted partner.
                  </p>

                  {!isKycVerified && (
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-800">KYC Verification Required</AlertTitle>
                      <AlertDescription className="text-amber-700">
                        You must complete KYC verification before connecting a bank account.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="bg-muted p-4 rounded-md">
                    <h3 className="font-medium mb-2">Bank Connection Benefits:</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Securely invest in offerings</li>
                      <li>Receive quarterly interest payments</li>
                      <li>Receive principal at maturity</li>
                      <li>No need to manually initiate payments</li>
                    </ul>
                  </div>

                  <div className="mt-6">
                    <Button 
                      disabled={!isKycVerified || connectBankAccount.isPending} 
                      onClick={() => connectBankAccount.mutate()}
                    >
                      {connectBankAccount.isPending ? "Connecting..." : "Connect Bank Account"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}