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

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => void;
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

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      console.log(`Attempting login for ${email}`);

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Login failed with status: ${response.status}`,
        );
      }

      const data = await response.json();
      console.log(`Login API response:`, data);

      if (!data.user) {
        throw new Error("Invalid response format - missing user data");
      }

      const user = data.user;

      // For demo purposes, handle merchant user special case
      if (user.role === "merchant" && !user.merchantId) {
        user.merchantId = 49; // Default to Shiloh Finance merchant ID (49)
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

      // Complete the loading state
      setIsLoading(false);

      // Return the user data so we can use it in the component
      return user;
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
      throw error; // Re-throw to let the component handle it
    }
  };

  const register = async (params: RegisterParams) => {
    setIsLoading(true);
    try {
      await registerUser(params);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    clearUserData();
    setLocation("/");
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
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
