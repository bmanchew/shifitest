import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";

export type AuthUser = Omit<User, "password"> & {
  merchantId?: number;
};

export interface AuthResult {
  user: AuthUser;
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  try {
    const response = await apiRequest("POST", "/api/auth/login", {
      email,
      password,
    });
    
    const data = await response.json();
    
    if (!data.user) {
      throw new Error("Invalid response from server");
    }
    
    return data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // In a real application, this would make an API request to validate the session
    // or check a JWT token, etc.
    
    // For demo purposes, we'll check local storage
    const userData = localStorage.getItem("finpay_user");
    if (!userData) {
      return null;
    }
    
    return JSON.parse(userData);
  } catch (error) {
    console.error("Failed to get current user:", error);
    return null;
  }
}

export function storeUserData(user: AuthUser): void {
  localStorage.setItem("finpay_user", JSON.stringify(user));
}

export function clearUserData(): void {
  localStorage.removeItem("finpay_user");
}

export function getUserHomeRoute(user: AuthUser): string {
  switch (user.role) {
    case "admin":
      return "/admin/dashboard";
    case "merchant":
      return "/merchant/dashboard";
    case "customer":
      return "/customer/dashboard";
    default:
      return "/";
  }
}
