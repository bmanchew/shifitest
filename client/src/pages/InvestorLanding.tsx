import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  ChevronRight, 
  Shield, 
  TrendingUp, 
  DollarSign, 
  CalendarClock, 
  BarChart3,
  CheckCircle2,
  Wallet,
  Info,
  Lock,
  FileCheck,
  BadgeCheck,
  Calendar,
  ArrowUpRight
} from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// Schema for contact form
const contactFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  phone: z.string().min(10, { message: 'Please enter a valid phone number' }),
  investmentAmount: z.string().min(1, { message: 'Please enter an investment amount' }),
  investmentGoals: z.string().optional(),
  isAccredited: z.boolean().default(false),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms',
  }),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function InvestorLanding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('15-percent');
  
  // Initialize form
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      investmentAmount: '',
      investmentGoals: '',
      isAccredited: false,
      agreeToTerms: false,
    },
  });
  
  // Form submission handler
  const onSubmit = async (data: ContactFormValues) => {
    try {
      // Submit form data to the backend
      const response = await fetch('/api/investor/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          investmentAmount: data.investmentAmount,
          investmentGoals: data.investmentGoals || 'Not specified',
          isAccredited: data.isAccredited,
          agreeToTerms: data.agreeToTerms
        }),
      });
      
      const result = await response.json();
      
      // Debug the API response
      console.log('API Response:', {
        ok: response.ok,
        status: response.status,
        result,
        hasUserId: !!result.userId,
        hasToken: !!result.token
      });
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit application');
      }
      
      // Redirect to the next step or clear form
      if (result.userId && result.token) {
        // Store the authentication token in localStorage
        localStorage.setItem('investorToken', result.token);
        localStorage.setItem('investorUserId', result.userId.toString());
        
        toast({
          title: "Application approved!",
          description: "Setting up your account and redirecting to the investor portal...",
        });
        
        // Redirect to the investor signup/onboarding page with forced navigation
        console.log('Redirecting to /investor/signup...');
        
        // Try both methods to ensure the redirect happens
        setTimeout(() => {
          // Method 1: Use setLocation from wouter
          setLocation('/investor/signup');
          
          // Method 2: Direct navigation as fallback
          setTimeout(() => {
            window.location.href = '/investor/signup';
          }, 300);
        }, 800);
      } else {
        // Only clear the form if we're not redirecting
        form.reset();
      }
    } catch (error) {
      console.error('Application submission error:', error);
      toast({
        title: "Error submitting application",
        description: error instanceof Error ? error.message : "Please try again or contact us directly.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-primary/5 py-20 lg:py-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4 px-3 py-1 border-primary/30 bg-primary/10">
              For Accredited Investors Only | Regulation D 506(c)
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Earn <span className="text-primary">15-18% APY</span> With ShiFi's Private Credit Fund
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Access stable, high-yield returns backed by consumer debt contracts with predictable quarterly payouts and robust risk protections.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => document.getElementById('get-started')?.scrollIntoView({ behavior: 'smooth' })}>
                Get Started <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => window.open('https://calendly.com/shififund/30min', '_blank')}>
                Schedule a Call <Calendar className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-card/70 backdrop-blur">
              <CardHeader className="pb-2">
                <TrendingUp className="h-6 w-6 text-primary mb-2" />
                <CardTitle className="text-xl">High Yield</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Earn 15-18% APY with consistent quarterly payouts over 2-3 year terms.</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card/70 backdrop-blur">
              <CardHeader className="pb-2">
                <Shield className="h-6 w-6 text-primary mb-2" />
                <CardTitle className="text-xl">Risk Protected</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Multiple security layers including personal guarantees and insurance coverage.</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card/70 backdrop-blur">
              <CardHeader className="pb-2">
                <BarChart3 className="h-6 w-6 text-primary mb-2" />
                <CardTitle className="text-xl">Low Volatility</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Stable returns from consumer debt contracts, independent of market fluctuations.</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card/70 backdrop-blur">
              <CardHeader className="pb-2">
                <CalendarClock className="h-6 w-6 text-primary mb-2" />
                <CardTitle className="text-xl">Shorter Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Shorter 2-3 year investment cycles with quarterly distributions.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Investment Options Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Premium Investment Options</h2>
            <p className="text-xl text-muted-foreground">
              Choose the investment plan that aligns with your financial goals
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <Tabs defaultValue="15-percent" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="15-percent">15% APY (2 Year)</TabsTrigger>
                <TabsTrigger value="18-percent">18% APY (3 Year)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="15-percent" className="space-y-4">
                <Card className="border-primary/30">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-3xl font-bold flex items-center">
                      15% APY
                      <Badge className="ml-3 bg-primary/20 text-primary">2 Year Term</Badge>
                    </CardTitle>
                    <CardDescription className="text-lg pt-2">
                      Ideal for investors seeking consistent quarterly returns with moderate time commitment
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    <div className="flex justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Minimum Investment</p>
                        <p className="text-2xl font-bold">$100,000</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payout Frequency</p>
                        <p className="text-2xl font-bold">Quarterly</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total ROI</p>
                        <p className="text-2xl font-bold">30%</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">Example Returns ($1,000,000 Investment):</h4>
                      <ul className="space-y-3">
                        <li className="flex items-start">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Quarterly payouts of $162,500</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Net payout: $1,300,000 (30% ROI, 20% IRR)</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Fully collateralized and protected investment</span>
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button className="w-full" size="lg" onClick={() => document.getElementById('get-started')?.scrollIntoView({ behavior: 'smooth' })}>
                      Invest at 15% APY <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              <TabsContent value="18-percent" className="space-y-4">
                <Card className="border-primary/30">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-3xl font-bold flex items-center">
                      18% APY
                      <Badge className="ml-3 bg-primary/20 text-primary">3 Year Term</Badge>
                    </CardTitle>
                    <CardDescription className="text-lg pt-2">
                      Premium option for investors seeking higher returns with compounded interest growth
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    <div className="flex justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Minimum Investment</p>
                        <p className="text-2xl font-bold">$250,000</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payout Frequency</p>
                        <p className="text-2xl font-bold">Quarterly</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total ROI</p>
                        <p className="text-2xl font-bold">54%</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">Example Returns ($1,000,000 Investment):</h4>
                      <ul className="space-y-3">
                        <li className="flex items-start">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Final year quarterly payouts of $385,000</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Net payout: $1,540,000 (54% ROI, 16% IRR)</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                          <span>Compounded interest for accelerated growth</span>
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button className="w-full" size="lg" onClick={() => document.getElementById('get-started')?.scrollIntoView({ behavior: 'smooth' })}>
                      Invest at 18% APY <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>
      
      {/* How It Works Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How ShiFi Generates Returns</h2>
            <p className="text-xl text-muted-foreground">
              Our model creates value for investors through strategic acquisition of consumer debt at discounted rates
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 flex items-center justify-center bg-primary/10 text-primary rounded-full mb-4">
                  <DollarSign className="h-6 w-6" />
                </div>
                <CardTitle>Strategic Acquisition</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  ShiFi purchases consumer debt contracts at significant discounts (e.g., a $10,000 contract for $7,000) while collecting 100% of repayments.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="w-12 h-12 flex items-center justify-center bg-primary/10 text-primary rounded-full mb-4">
                  <BadgeCheck className="h-6 w-6" />
                </div>
                <CardTitle>Robust Underwriting</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our thorough vetting process ensures only high-quality professional development businesses and borrowers are selected, maintaining a low-default portfolio.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="w-12 h-12 flex items-center justify-center bg-primary/10 text-primary rounded-full mb-4">
                  <Wallet className="h-6 w-6" />
                </div>
                <CardTitle>Contractual Returns</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Retail Installment Contracts (RICs) provide legally binding repayment schedules, creating predictable cash flows independent of market conditions.
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="bg-muted/30 rounded-lg p-8 max-w-3xl mx-auto">
            <div className="flex items-start">
              <Info className="h-6 w-6 text-primary mr-3 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-medium mb-2">Proven Track Record</h3>
                <p className="mb-4">
                  Our strategic partnership pilot has already demonstrated exceptional results:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                    <span>Over $2.6 million in contracts funded in under 6 months</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                    <span>Extremely low 1% default rate</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                    <span>Consistent on-time payments from borrowers</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Risk Mitigation Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Multi-Layered Risk Protection</h2>
            <p className="text-xl text-muted-foreground">
              ShiFi employs comprehensive safeguards to protect your investment capital
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center">
                  <Lock className="h-5 w-5 text-primary mr-2" />
                  Personal Guaranty
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Business owners are held personally accountable for debt repayment, adding an additional layer of security.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 text-primary mr-2" />
                  Diversification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Origination caps ensure capital is deployed across multiple businesses and industries to reduce concentration risk.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center">
                  <BadgeCheck className="h-5 w-5 text-primary mr-2" />
                  Identity Verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Real-time KYC checks with driver's license and facial recognition technology prevent fraud at the source.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 text-primary mr-2" />
                  Financial Verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Advanced credit and income verification using Plaid for bank data and Pinwheel for payroll verification.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 text-primary mr-2" />
                  Insurance Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Each contract is bonded with Chubb Insurance for capital protection against business closures.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center">
                  <FileCheck className="h-5 w-5 text-primary mr-2" />
                  Recourse Provisions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  First payment and client satisfaction recourse provisions ensure immediate action on defaults or service failures.
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center">
            <Button variant="outline" onClick={() => window.open('https://calendly.com/shififund/30min', '_blank')}>
              Schedule a Call to Learn More <Calendar className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
      
      {/* Process Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple Investment Process</h2>
            <p className="text-xl text-muted-foreground">
              Our streamlined investor experience makes it easy to get started
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-muted" aria-hidden="true" />
              
              <div className="space-y-12">
                <div className="relative flex items-start">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary text-lg font-semibold z-10">
                    1
                  </div>
                  <div className="ml-6 mt-1">
                    <h3 className="text-xl font-medium mb-2">Register and Verify</h3>
                    <p className="text-muted-foreground mb-3">
                      Sign an NDA and complete our seamless KYC verification process to access the investor portal.
                    </p>
                  </div>
                </div>
                
                <div className="relative flex items-start">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary text-lg font-semibold z-10">
                    2
                  </div>
                  <div className="ml-6 mt-1">
                    <h3 className="text-xl font-medium mb-2">Review and Select</h3>
                    <p className="text-muted-foreground mb-3">
                      Access the data room for key documents including financials, PPM, and portfolio performance, then choose your investment option.
                    </p>
                  </div>
                </div>
                
                <div className="relative flex items-start">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary text-lg font-semibold z-10">
                    3
                  </div>
                  <div className="ml-6 mt-1">
                    <h3 className="text-xl font-medium mb-2">Sign Digitally</h3>
                    <p className="text-muted-foreground mb-3">
                      Promissory notes are automatically generated and signed digitally through our secure platform.
                    </p>
                  </div>
                </div>
                
                <div className="relative flex items-start">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary text-lg font-semibold z-10">
                    4
                  </div>
                  <div className="ml-6 mt-1">
                    <h3 className="text-xl font-medium mb-2">Fund Seamlessly</h3>
                    <p className="text-muted-foreground mb-3">
                      Transfer your investment easily through direct ACH using our secure Plaid integration.
                    </p>
                  </div>
                </div>
                
                <div className="relative flex items-start">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary text-lg font-semibold z-10">
                    5
                  </div>
                  <div className="ml-6 mt-1">
                    <h3 className="text-xl font-medium mb-2">Track and Manage</h3>
                    <p className="text-muted-foreground mb-3">
                      Access your dashboard to track investment status, view signed documents, and monitor quarterly returns.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Get Started Section */}
      <section id="get-started" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <h2 className="text-3xl font-bold mb-6">Ready to Get Started?</h2>
                <p className="text-lg mb-6">
                  Complete this form to begin your investment journey with ShiFi. Our team will contact you promptly to guide you through the next steps.
                </p>
                
                <div className="mb-8">
                  <h3 className="text-xl font-medium mb-3">Why Invest with ShiFi?</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Access to a rapidly expanding $607 billion professional development market</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Early mover advantage with low competition in the space</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Team with proven track record in scaling professional development businesses</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                      <span>Lower-risk profile with shorter-term notes and multiple protections</span>
                    </li>
                  </ul>
                </div>
                
                <div className="p-4 border rounded-lg bg-background">
                  <div className="flex items-start">
                    <Info className="h-5 w-5 text-primary mr-2 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium">Regulatory Notice</h4>
                      <p className="text-sm text-muted-foreground">
                        Investments offered under Regulation D Rule 506(c). Available to accredited investors only. Past performance does not guarantee future results.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Investor Application</CardTitle>
                    <CardDescription>
                      Complete this form to begin your investment journey
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John Smith" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="john@example.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="phone"
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
                        
                        <FormField
                          control={form.control}
                          name="investmentAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estimated Investment Amount ($)</FormLabel>
                              <FormControl>
                                <Input placeholder="100000" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="investmentGoals"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Investment Goals (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="What are your investment objectives?" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="isAccredited"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel>Accredited Investor Status</FormLabel>
                                <p className="text-sm text-muted-foreground">
                                  I certify that I meet the requirements of an accredited investor
                                </p>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="agreeToTerms"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  I agree to the terms and conditions and understand this is for preliminary qualification only
                                </FormLabel>
                                <FormMessage />
                              </div>
                            </FormItem>
                          )}
                        />
                      
                        <Button type="submit" className="w-full">Submit Application</Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Contact Section */}
      <section className="py-12 bg-primary/5 border-t">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-medium mb-4">Ready to discuss your investment options?</h2>
          <p className="mb-6 text-muted-foreground">
            Contact us directly or schedule a call with our investment team
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button variant="outline" onClick={() => window.location.href = 'mailto:paul@shilohfinance.com'}>
              Email: paul@shilohfinance.com
            </Button>
            <Button onClick={() => window.open('https://calendly.com/shififund/30min', '_blank')}>
              Schedule a Call <Calendar className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} ShiFi. All rights reserved.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>
                Investment opportunities offered under Regulation D Rule 506(c). Available to accredited investors only.
                Past performance does not guarantee future results. Please read all offering documents carefully.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}