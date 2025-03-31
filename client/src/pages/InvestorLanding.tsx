import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  FileCheck,
  LineChart,
  LockKeyhole,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";

export default function InvestorLanding() {
  const [_, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState("15_percent");

  const handleLoginClick = () => {
    navigate("/login");
  };

  const investmentOptions = {
    "15_percent": {
      title: "15% APY - 2 Year Term",
      description: "Lower risk option with 15% annual returns over a 2-year term",
      minInvestment: "$50,000",
      term: "24 months",
      returnRate: "15% APY",
      liquidity: "Medium",
      riskLevel: "Low-Medium",
      features: [
        "Quarterly distributions",
        "Tokenized contract ownership",
        "Early redemption options after 12 months (fees apply)",
        "Backed by diversified merchant financing contracts"
      ]
    },
    "18_percent": {
      title: "18% APY - 4 Year Term",
      description: "Higher yield option with 18% annual returns over a 4-year term",
      minInvestment: "$100,000",
      term: "48 months",
      returnRate: "18% APY",
      liquidity: "Low",
      riskLevel: "Medium",
      features: [
        "Quarterly distributions",
        "Tokenized contract ownership",
        "Priority access to future offerings",
        "Enhanced portfolio diversification",
        "Backed by prime merchant financing contracts"
      ]
    }
  };

  const selectedOption = investmentOptions[selectedTab as keyof typeof investmentOptions];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <a className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">ShiFi</span>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  Investor Portal
                </span>
              </a>
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#overview" className="text-sm font-medium hover:text-primary">
              Overview
            </a>
            <a href="#offerings" className="text-sm font-medium hover:text-primary">
              Investment Offerings
            </a>
            <a href="#benefits" className="text-sm font-medium hover:text-primary">
              Benefits
            </a>
            <a href="#process" className="text-sm font-medium hover:text-primary">
              Process
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button onClick={handleLoginClick}>
              Investor Login
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-background to-muted/30">
        <div className="container grid items-center gap-6 px-4 md:px-6 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Invest in Merchant Financing<br />
              <span className="text-primary">Earn 15-18% APY</span>
            </h1>
            <p className="max-w-[600px] text-muted-foreground md:text-xl">
              Diversify your portfolio with high-yielding, tokenized financial contracts backed by established businesses.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={handleLoginClick}>
                Access Portal
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#offerings">
                  View Offerings
                </a>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <img 
              src="/investor-portal.jpg" 
              alt="ShiFi Investment Platform" 
              className="rounded-lg shadow-xl"
              onError={(e) => {
                const img = e.currentTarget;
                img.src = "/ShiFiMidesk.png";
              }}
              width={550}
              height={400}
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="w-full py-12 md:py-18 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center">
              <h3 className="text-3xl font-bold text-primary mb-2">15-18%</h3>
              <p className="text-sm text-muted-foreground">Annual Yield</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <h3 className="text-3xl font-bold text-primary mb-2">$50K+</h3>
              <p className="text-sm text-muted-foreground">Minimum Investment</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <h3 className="text-3xl font-bold text-primary mb-2">2-4</h3>
              <p className="text-sm text-muted-foreground">Year Terms</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <h3 className="text-3xl font-bold text-primary mb-2">Quarterly</h3>
              <p className="text-sm text-muted-foreground">Distributions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section id="overview" className="w-full py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              <span className="text-primary">Why</span> Invest with ShiFi?
            </h2>
            <p className="max-w-[700px] text-muted-foreground md:text-xl">
              ShiFi provides accredited investors access to high-yielding financial contracts typically reserved for institutional investors.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 mt-12 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <CircleDollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Competitive Returns</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our merchant financing contracts provide annual returns of 15-18%, outperforming traditional investment vehicles while maintaining controlled risk exposure.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Secure Investment Structure</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  All investments are secured through tokenized contracts, backed by established businesses with proven revenue streams and verified through our comprehensive underwriting process.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Transparent Performance</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track your investment performance in real-time through our intuitive investor dashboard with detailed analytics and regular reporting.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Investment Offerings Section */}
      <section id="offerings" className="w-full py-12 md:py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center gap-4 text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
              Investment <span className="text-primary">Offerings</span>
            </h2>
            <p className="max-w-[700px] text-muted-foreground md:text-xl">
              Choose the investment option that aligns with your financial goals.
            </p>
          </div>

          <Tabs defaultValue="15_percent" className="w-full" onValueChange={setSelectedTab}>
            <div className="flex justify-center mb-8">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="15_percent">15% APY</TabsTrigger>
                <TabsTrigger value="18_percent">18% APY</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex justify-center">
              <Card className="max-w-3xl w-full">
                <CardHeader>
                  <CardTitle className="text-2xl">{selectedOption.title}</CardTitle>
                  <CardDescription>{selectedOption.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-4">Investment Details</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Minimum Investment:</span>
                          <span className="font-medium">{selectedOption.minInvestment}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Term Length:</span>
                          <span className="font-medium">{selectedOption.term}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Return Rate:</span>
                          <span className="font-medium">{selectedOption.returnRate}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Liquidity:</span>
                          <span className="font-medium">{selectedOption.liquidity}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk Level:</span>
                          <span className="font-medium">{selectedOption.riskLevel}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-4">Key Features</h3>
                      <ul className="space-y-2">
                        {selectedOption.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <ChevronRight className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-center">
                    <Button size="lg" onClick={handleLoginClick}>
                      Invest Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Tabs>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="w-full py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center gap-4 text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
              Investor <span className="text-primary">Benefits</span>
            </h2>
            <p className="max-w-[700px] text-muted-foreground md:text-xl">
              Enjoy these exclusive advantages when you invest with ShiFi
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-2">
                  <LineChart className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Predictable Income</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Fixed returns of 15-18% APY with quarterly distributions provide reliable income you can count on.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Thorough Due Diligence</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Each business in our portfolio undergoes comprehensive verification and financial analysis before being approved.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-2">
                  <LockKeyhole className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Contract Tokenization</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Smart contract technology secures your investment and provides transparent ownership verification.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-2">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Diversification</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Expand your investment portfolio with an alternative asset class that's uncorrelated with traditional markets.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Performance Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track your investments in real-time with our comprehensive investor dashboard and detailed reporting.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-2">
                  <CircleDollarSign className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Inflation Protection</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  High fixed-rate returns help protect your capital against inflation and market volatility.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Investment Process Section */}
      <section id="process" className="w-full py-12 md:py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center gap-4 text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
              Investment <span className="text-primary">Process</span>
            </h2>
            <p className="max-w-[700px] text-muted-foreground md:text-xl">
              A simple and transparent process to start your investment journey
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary mb-4">
                <span className="text-lg font-bold text-primary-foreground">1</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Register</h3>
              <p className="text-muted-foreground">
                Create your investor account and complete the initial verification process.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary mb-4">
                <span className="text-lg font-bold text-primary-foreground">2</span>
              </div>
              <h3 className="text-xl font-bold mb-2">KYC Verification</h3>
              <p className="text-muted-foreground">
                Complete the identity verification and accredited investor qualification.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary mb-4">
                <span className="text-lg font-bold text-primary-foreground">3</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Select Offering</h3>
              <p className="text-muted-foreground">
                Review available investment offerings and choose the option that meets your goals.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary mb-4">
                <span className="text-lg font-bold text-primary-foreground">4</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Invest & Monitor</h3>
              <p className="text-muted-foreground">
                Complete your investment and track performance through your investor dashboard.
              </p>
            </div>
          </div>

          <div className="mt-12 flex justify-center">
            <Button size="lg" onClick={handleLoginClick}>
              Begin Investing
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
              Ready to <span className="text-primary">Start Investing</span>?
            </h2>
            <p className="max-w-[700px] text-muted-foreground md:text-xl">
              Join our growing community of investors earning consistent returns through merchant contract financing.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={handleLoginClick}>
                Access Investor Portal
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-6 md:py-8 border-t">
        <div className="container flex flex-col items-center justify-center gap-4 px-4 md:px-6 text-center">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">ShiFi</span>
            <span className="text-sm text-muted-foreground">
              Investor Portal
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            © 2025 ShiFi Financial Technologies. All rights reserved.
          </div>
          <div className="flex gap-4 text-muted-foreground text-sm">
            <a href="#" className="hover:text-foreground">
              Terms & Conditions
            </a>
            <a href="#" className="hover:text-foreground">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-foreground">
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}