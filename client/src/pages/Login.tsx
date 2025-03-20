import { useState } from "react";
import { useLocation } from "wouter";
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

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("Attempting login with:", email);

      // Make the login API call directly to see the response
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(`Login failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Login API response:", data);

      if (!data.user) {
        throw new Error("Invalid response format - missing user data");
      }

      // Now call the auth context login method with the user data
      await login(email, password);

      // If we get here, login was successful
      console.log("Login successful");

      // Redirect based on user role
      if (data.user.role === "admin") {
        setLocation("/admin");
      } else if (data.user.role === "merchant") {
        setLocation("/merchant");
      } else if (data.user.role === "customer") {
        setLocation("/customer");
      } else {
        setLocation("/");
      }
    } catch (error) {
      console.error("Login failed:", error);
      toast({
        title: "Login Failed",
        description:
          error instanceof Error
            ? error.message
            : "Invalid email or password. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-6 items-center">
        <Card className="w-full lg:w-1/2 max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-2">
              <div className="bg-primary text-white p-2 rounded-md">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className="ml-2 text-2xl font-bold">ShiFi</span>
            </div>
            <CardTitle className="text-2xl font-semibold text-center">
              Log in to your account
            </CardTitle>
            <CardDescription className="text-center">
              Enter your email and password to access your account
            </CardDescription>
          </CardHeader>
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

              {/* <div className="text-sm text-gray-500">
                <p>Demo accounts:</p>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Admin: admin@shifi.com / admin123</li>
                  <li>Merchant: merchant@techsolutions.com / merchant123</li>
                </ul>
              </div> */}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Log in"}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <div className="lg:w-1/2 flex items-center justify-center p-8">
          <img 
            src="/ShiFiMidesk.png" 
            alt="Unlock More Revenue With ShiFi Financing" 
            className="h-auto max-w-full w-4/5 rounded-lg shadow-lg" 
            onError={(e) => {
              console.error("Image failed to load:", e);
              const imgElement = e.currentTarget;
              // Try using the absolute URL if the relative path fails
              if (imgElement.src.endsWith('/ShiFiMidesk.png')) {
                const baseUrl = window.location.origin;
                imgElement.src = `${baseUrl}/ShiFiMidesk.png`;
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
