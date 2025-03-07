import { createContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { 
  AuthUser, 
  loginUser, 
  getCurrentUser, 
  storeUserData, 
  clearUserData, 
  getUserHomeRoute 
} from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
      const { user } = await loginUser(email, password);

      // For demo purposes, handle merchant user special case
      // In a real app, the backend would return the merchantId
      if (user.role === "merchant" && !user.merchantId) {
        user.merchantId = 1; // Default to first merchant for demo
      }

      // Handle backward compatibility with name field during migration
      if (!user.firstName && user.name) {
        const nameParts = user.name.split(' ');
        user.firstName = nameParts[0] || '';
        user.lastName = nameParts.slice(1).join(' ') || '';
      }

      setUser(user);
      storeUserData(user);

      // Redirect based on user role
      setLocation(getUserHomeRoute(user));

      // Use firstName for greeting if available, otherwise fall back to name
      const displayName = user.firstName || user.name || 'User';
      toast({
        title: "Login Successful",
        description: `Welcome back, ${displayName}!`,
      });

      // Important - we need to set loading to false after successful login
      setIsLoading(false);
    } catch (error) {
      console.error("Login error:", error);
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
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}