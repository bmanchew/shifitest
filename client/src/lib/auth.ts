import { apiRequest } from "@/lib/api";
import { User } from "@shared/schema";
import { fetchCsrfToken } from "./csrf";

export type AuthUser = Omit<User, "password"> & {
  merchantId?: number;
};

export interface AuthResult {
  user: AuthUser;
}

export interface RegisterParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

export async function registerUser(params: RegisterParams): Promise<void> {
  try {
    // First, get a CSRF token to be used for state-changing requests
    await fetchCsrfToken();
    
    // Now make the registration request
    await apiRequest("POST", "/api/auth/register", params);
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
}

export async function loginUser(email: string, password: string, userType?: string): Promise<AuthResult> {
  try {
    // First, get a CSRF token to be used for state-changing requests
    await fetchCsrfToken();
    
    // Now make the login request with userType if provided
    const data = await apiRequest<AuthResult>("POST", "/api/auth/login", {
      email,
      password,
      ...(userType ? { userType } : {}),
    });
    
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
    const userData = localStorage.getItem("shifi_user");
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
  localStorage.setItem("shifi_user", JSON.stringify(user));
}

export function clearUserData(): void {
  localStorage.removeItem("shifi_user");
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
