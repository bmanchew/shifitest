import React, { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CurrencyDollarIcon, CheckCircleIcon, BanknotesIcon, ArrowRightIcon, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';

// Validation schema for the investment purchase form
const purchaseFormSchema = z.object({
  amount: z
    .number()
    .min(10000, { message: 'Minimum investment is $10,000' })
    .max(1000000, { message: 'Maximum investment is $1,000,000' }),
  agreedToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and conditions'
  })
});

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

export default function InvestmentPurchase() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Form setup
  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      amount: 10000,
      agreedToTerms: false
    }
  });

  // Fetch offering details
  const offeringQuery = useQuery({
    queryKey: ['/api/investor/offerings', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/investor/offerings/${id}`);
      return response;
    }
  });

  // Fetch investor profile for bank account information
  const profileQuery = useQuery({
    queryKey: ['/api/investor/profile'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/investor/profile');
      return response.profile;
    }
  });

  // Mutation for purchasing an investment
  const purchaseMutation = useMutation({
    mutationFn: async (data: PurchaseFormValues) => {
      const response = await apiRequest('POST', '/api/investor/investments', {
        offeringId: parseInt(id as string),
        amount: data.amount,
        agreementNumber: `INV-${Date.now()}`
      });
      return response;
    },
    onSuccess: (data) => {
      setPurchaseComplete(true);
      setTransactionId(data.investment.id);
      queryClient.invalidateQueries({ queryKey: ['/api/investor/investments'] });
      
      toast({
        title: 'Investment Successful',
        description: 'Your investment has been processed successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Investment Failed',
        description: error instanceof Error ? error.message : 'Failed to process investment. Please try again.',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: PurchaseFormValues) => {
    // Check if user has a bank account connected
    const hasLinkedAccount = profileQuery.data?.linkedAccounts?.length > 0;
    
    if (!hasLinkedAccount) {
      toast({
        title: 'Bank Account Required',
        description: 'Please connect a bank account before investing.',
        variant: 'destructive',
      });
      return;
    }
    
    purchaseMutation.mutate(data);
  };

  if (offeringQuery.isLoading || profileQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (offeringQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <h2 className="text-2xl font-bold text-destructive mb-4">Error Loading Investment Offering</h2>
        <p className="text-muted-foreground mb-6">We couldn't load the investment details. Please try again.</p>
        <Button onClick={() => offeringQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  const offering = offeringQuery.data.offering;
  
  if (purchaseComplete) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <Card className="border-2 border-primary/10 bg-primary/5">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircleIcon className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">Investment Successful!</CardTitle>
            <CardDescription>
              Your investment has been processed successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-background p-6 shadow-sm">
              <h3 className="text-xl font-semibold mb-4">Transaction Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Investment ID:</span>
                  <span className="font-medium">{transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Investment Offering:</span>
                  <span className="font-medium">{offering.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Invested:</span>
                  <span className="font-medium">${form.getValues().amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium text-green-600">Processing</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg bg-background p-6 shadow-sm">
              <h3 className="text-xl font-semibold mb-4">Next Steps</h3>
              <p className="text-muted-foreground mb-4">
                Your investment is now being processed. Here's what happens next:
              </p>
              <ol className="space-y-2 list-decimal pl-5">
                <li>Funds will be transferred from your connected bank account within 1-2 business days</li>
                <li>Once funds are received, your investment will be active</li>
                <li>You'll receive a confirmation email with your investment details</li>
                <li>You can track your investment status from your dashboard</li>
              </ol>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => setLocation('/investor/offerings')}
            >
              Browse More Offerings
            </Button>
            <Button 
              onClick={() => setLocation('/investor/dashboard')}
            >
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Invest in {offering.name}</h1>
        <p className="text-muted-foreground mt-2">
          Complete this form to invest in {offering.name}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Investment Details</CardTitle>
              <CardDescription>
                Enter the amount you would like to invest
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Investment Amount</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                              <CurrencyDollarIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <Input
                              type="number"
                              placeholder="10000"
                              className="pl-10"
                              {...field}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                field.onChange(isNaN(value) ? 0 : value);
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Minimum investment is ${offering.minimumInvestment.toLocaleString()}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Annual Return Rate:</span>
                      <span className="font-medium">{offering.interestRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Term Length:</span>
                      <span className="font-medium">{offering.termMonths} months</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Total Return:</span>
                      <span className="font-medium text-primary">
                        ${(form.getValues().amount * (offering.interestRate / 100) * (offering.termMonths / 12)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <h3 className="font-medium mb-3">Payment Method</h3>
                    {profileQuery.data?.linkedAccounts?.length > 0 ? (
                      <div className="flex items-center space-x-3 p-2 rounded border bg-background">
                        <div className="rounded-full bg-primary/10 p-2">
                          <BanknotesIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {profileQuery.data.linkedAccounts[0].accountName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {profileQuery.data.linkedAccounts[0].accountType} •••• 
                            {profileQuery.data.linkedAccounts[0].accountId.slice(-4)}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setLocation('/investor/connect-bank')}>
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col space-y-3">
                        <p className="text-sm text-muted-foreground">
                          You don't have any bank accounts connected yet.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setLocation('/investor/connect-bank')}
                          className="w-fit"
                        >
                          Connect Bank Account
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="agreedToTerms"
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
                            I agree to the investment terms and conditions
                          </FormLabel>
                          <FormDescription>
                            By checking this box, you agree to the investment terms, privacy policy, and risk disclosures.
                          </FormDescription>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={purchaseMutation.isPending}
                  >
                    {purchaseMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Complete Investment
                        <ArrowRightIcon className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Investment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium">{offering.name}</h3>
                <p className="text-sm text-muted-foreground">{offering.description}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Type:</span>
                  <span className="text-sm font-medium">{offering.type === 'fixed_term_15_2yr' ? '15% Fixed (2yr)' : '18% Fixed (4yr)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Interest Rate:</span>
                  <span className="text-sm font-medium">{offering.interestRate}% APY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Term:</span>
                  <span className="text-sm font-medium">{offering.termMonths} months</span>
                </div>
                {offering.type === 'fixed_term_18_4yr' && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Deferred Interest:</span>
                    <span className="text-sm font-medium">First 24 months</span>
                  </div>
                )}
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Your investment is secured by tokenized merchant contracts on the blockchain.</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setLocation(`/investor/offerings/${id}`)}
                >
                  View Offering Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}