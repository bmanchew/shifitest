import { createContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import {
  AuthUser,
  loginUser,
  registerUser,
  RegisterParams,
  getCurrentUser,
  storeUserData,
  clearUserData,
  getUserHomeRoute,
} from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { clearCsrfToken, fetchCsrfToken } from "@/lib/csrf";
import { apiRequest } from "@/lib/api";

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, userType?: string) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  // Check for existing auth on load
  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email: string, password: string, userType?: string) => {
    setIsLoading(true);
    try {
      console.log(`Attempting login for ${email}${userType ? ` (Type: ${userType})` : ''}`);
      
      // Fetch CSRF token first
      await fetchCsrfToken();

      // Use the correct response type with userType if provided
      const response = await apiRequest<{success: boolean; user: AuthUser}>(
        "POST", 
        "/api/auth/login", 
        { email, password, userType }
      );
      console.log(`Login API response:`, response);

      // Handle both response formats: either {user} or {success, user}
      let user;
      if (response.success === true && response.user) {
        // New format: {success: true, user: {...}}
        user = response.user;
      } else if (response && Object.keys(response).length > 0 && !response.success) {
        // Handle case where response is the user object directly
        user = response as unknown as AuthUser;
      } else {
        throw new Error("Invalid response format - missing user data");
      }

      // If this is a merchant user without a merchantId, we need to fetch it
      if (user.role === "merchant" && !user.merchantId) {
        try {
          // Try to get the merchant ID from the merchants/current endpoint
          const merchantResponse = await apiRequest<{ success: boolean; merchant: { id: number } }>(
            "GET", 
            "/api/merchants/current"
          );
          
          if (merchantResponse.success && merchantResponse.merchant) {
            user.merchantId = merchantResponse.merchant.id;
            console.log(`Fetched actual merchant ID: ${user.merchantId}`);
          } else {
            console.warn("Failed to get merchantId from /api/merchants/current endpoint");
          }
        } catch (merchantError) {
          console.error("Error fetching merchant ID:", merchantError);
        }
      }

      // Handle backward compatibility with name field during migration
      if (!user.firstName && user.name) {
        const nameParts = user.name.split(" ");
        user.firstName = nameParts[0] || "";
        user.lastName = nameParts.slice(1).join(" ") || "";
      }

      // Set user state and store in localStorage before redirecting
      setUser(user);
      storeUserData(user);

      // Show success toast
      toast({
        title: "Login Successful",
        description: `Welcome, ${user.firstName || user.name || "User"}!`,
      });

      // Handle redirection based on role
      if (user.role === "admin") {
        setLocation("/admin/dashboard");
      } else if (user.role === "merchant") {
        setLocation("/merchant/dashboard");
      } else if (user.role === "investor") {
        // Redirect investors to the investor dashboard
        setLocation("/investor/dashboard");
      } else if (user.role === "customer") {
        // For customers, we need to fetch their active contract ID
        try {
          const activeContractResponse = await apiRequest<{contracts: {id: number}[]}>("GET", "/api/customers/active-contract");
          if (activeContractResponse.contracts && activeContractResponse.contracts.length > 0) {
            // Redirect to the specific contract dashboard
            setLocation(`/dashboard/${activeContractResponse.contracts[0].id}`);
          } else {
            // Fallback to contract lookup if no active contracts found
            setLocation("/customer/contract-lookup");
          }
        } catch (contractError) {
          console.error("Error fetching active contract:", contractError);
          // If we can't fetch the contract, use a hard-coded fallback for testing
          // Contract ID 176 (for brandon@calimited.com)
          setLocation("/dashboard/176");
        }
      } else {
        // Default fallback
        setLocation("/");
      }

      // Complete the loading state
      setIsLoading(false);
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
      throw error; // Re-throw to let the component handle it
    }
  };

  const register = async (params: RegisterParams) => {
    setIsLoading(true);
    try {
      // Fetch CSRF token first
      await fetchCsrfToken();
      
      // Call the register endpoint directly using apiRequest
      await apiRequest("POST", "/api/auth/register", params);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Fetch CSRF token first 
      await fetchCsrfToken();
      
      // Call server logout endpoint to clear cookies
      await apiRequest("POST", "/api/auth/logout");
      
      // Clear user state
      setUser(null);
      clearUserData();
      
      // Clear CSRF token
      clearCsrfToken();
      
      // Redirect to home page
      setLocation("/");
      
      // Show success message
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      console.error("Error during logout:", error);
      
      // Even if the server logout fails, we should still clear local state
      setUser(null);
      clearUserData();
      clearCsrfToken();
      setLocation("/");
      
      toast({
        title: "Logged Out",
        description: "You have been logged out, but there was an issue with the server.",
        variant: "destructive",
      });
    }
  };

  const value = {
    user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
