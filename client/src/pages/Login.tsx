import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Briefcase, Building, CircleDollarSign, User } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log(`Attempting login with: ${email} (User Type: ${userType})`);
      console.log("Login component: Before login function call");

      // Use the login function from AuthContext which properly handles CSRF tokens
      // For investor logins, we'll pass the userType to distinguish investor logins
      if (userType === "investor") {
        // Call login with userType parameter
        await login(email, password, "investor");
      } else {
        // Check for admin login with default "admin123" password for demo purposes
        if (email === "admin@shifi.com" && !password) {
          console.log("Using default admin password for demo");
          await login(email, "admin123");
        } else {
          // Standard business login
          await login(email, password);
        }
      }
      
      // If we get here, login was successful
      console.log("Login component: Login successful");
      
      // Note: Navigation is handled in the AuthContext after successful login

    } catch (error) {
      console.error("Login component: Login failed:", error);
      
      // Special case for admin login with wrong password
      if (email === "admin@shifi.com") {
        toast({
          title: "Admin Login Failed",
          description: "For the demo, try using the default password 'admin123'",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login Failed",
          description:
            error instanceof Error
              ? error.message
              : "Invalid email or password. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail || !forgotPasswordEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    
    setIsResettingPassword(true);
    
    try {
      // Get CSRF token first
      const csrfResponse = await fetch('/api/csrf-token');
      const { csrfToken } = await csrfResponse.json();
      
      // Send password reset request
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ email: forgotPasswordEmail }),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Password Reset Requested",
          description: "If an account exists with this email, we've sent instructions to reset your password.",
          duration: 6000,
        });
        setIsForgotPasswordOpen(false);
        setForgotPasswordEmail("");
      } else {
        throw new Error(data.message || "Something went wrong. Please try again.");
      }
    } catch (error) {
      console.error("Password reset request failed:", error);
      toast({
        title: "Request Failed",
        description: error instanceof Error ? error.message : "Failed to request password reset. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Add state to track login type
  const [userType, setUserType] = useState<"business" | "investor">("business");
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="w-full border-b bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <img 
                src="/logo3.png"
                alt="ShiFi Logo"
                className="h-8 w-8 object-contain"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.src = "/ShiFiMidesk.png";
                }}
              />
              <span className="ml-2 text-xl font-bold">ShiFi</span>
            </div>
          </div>
          <nav className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              className="flex items-center gap-2"
              onClick={() => setLocation("/investor")}
            >
              <CircleDollarSign className="h-4 w-4" />
              Investor Portal
            </Button>
          </nav>
        </div>
      </header>
      
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-6 items-center">
          <Card className="w-full lg:w-1/2 max-w-md">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center mb-2">
                <img 
                  src="/logo3.png"
                  alt="ShiFi Logo"
                  className="h-8 w-8 object-contain"
                  onError={(e) => {
                    console.error("Logo failed to load, trying public path");
                    const img = e.currentTarget;
                    img.src = "/public/logo3.png";
                  }}
                />
                <span className="ml-2 text-2xl font-bold">ShiFi</span>
              </div>
              <CardTitle className="text-2xl font-semibold text-center">
                Log in to your account
              </CardTitle>
              <CardDescription className="text-center">
                Enter your email and password to access your account
              </CardDescription>
            </CardHeader>
            
            <Tabs defaultValue="business" className="w-full" onValueChange={(value) => setUserType(value as "business" | "investor")}>
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="business" className="flex items-center justify-center">
                  <Building className="h-4 w-4 mr-2" />
                  <span>Business</span>
                </TabsTrigger>
                <TabsTrigger value="investor" className="flex items-center justify-center">
                  <Briefcase className="h-4 w-4 mr-2" />
                  <span>Investor</span>
                </TabsTrigger>
              </TabsList>
            
              <TabsContent value="business">
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0 h-auto text-xs font-normal"
                          onClick={() => {
                            setForgotPasswordEmail(email);
                            setIsForgotPasswordOpen(true);
                          }}
                          type="button"
                        >
                          Forgot password?
                        </Button>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Logging in..." : "Log in"}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            
              <TabsContent value="investor">
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="investor-email">Email</Label>
                      <Input
                        id="investor-email"
                        type="email"
                        placeholder="investor@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="investor-password">Password</Label>
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0 h-auto text-xs font-normal"
                          onClick={() => {
                            setForgotPasswordEmail(email);
                            setIsForgotPasswordOpen(true);
                          }}
                          type="button"
                        >
                          Forgot password?
                        </Button>
                      </div>
                      <Input
                        id="investor-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p className="mb-2">As an investor, you'll have access to:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Exclusive contract investment opportunities</li>
                        <li>Data room with detailed financial documentation</li>
                        <li>Portfolio management and performance tracking</li>
                      </ul>
                      <div className="mt-3">
                        <Button 
                          variant="link" 
                          className="p-0 h-auto text-xs"
                          onClick={() => setLocation("/investor")}
                        >
                          Learn more about investor opportunities
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex-col space-y-3">
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Logging in..." : "Log in"}
                    </Button>
                    <div className="text-center text-sm">
                      <span className="text-muted-foreground">New investor? </span>
                      <Button 
                        variant="link" 
                        className="p-0 h-auto"
                        onClick={() => setLocation("/investor/signup")}
                      >
                        Apply for access
                      </Button>
                    </div>
                  </CardFooter>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
          
          <div className="lg:w-1/2 flex items-center justify-center p-8">
            <img 
              src={userType === "investor" ? "/investor-portal.jpg" : "/ShiFiMidesk.png"}
              alt={userType === "investor" ? "ShiFi Investor Portal" : "Unlock More Revenue With ShiFi Financing"}
              className="h-auto max-w-full w-4/5 rounded-lg shadow-lg" 
              onError={(e) => {
                console.error("Image failed to load:", e);
                const imgElement = e.currentTarget;
                // If investor image fails, fall back to the default
                if (userType === "investor") {
                  imgElement.src = "/ShiFiMidesk.png";
                } else if (imgElement.src.endsWith('/ShiFiMidesk.png')) {
                  const baseUrl = window.location.origin;
                  imgElement.src = `${baseUrl}/ShiFiMidesk.png`;
                }
              }}
            />
          </div>
        </div>

        {/* Forgot Password Dialog */}
        <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset your password</DialogTitle>
              <DialogDescription>
                Enter your email address and we'll send you instructions to reset your password.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleForgotPassword} className="space-y-4 py-3">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  className="w-full"
                />
              </div>
              
              <DialogFooter className="pt-4">
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={() => setIsForgotPasswordOpen(false)}
                  disabled={isResettingPassword}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isResettingPassword}
                >
                  {isResettingPassword ? "Sending..." : "Send Instructions"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}