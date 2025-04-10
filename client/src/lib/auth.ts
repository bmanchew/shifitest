import { apiClient } from "@/lib/api/apiClient";
import { User } from "@shared/schema";

export type AuthUser = Omit<User, "password"> & {
  merchantId?: number;
  token?: string;
  access_token?: string;
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

/**
 * Store user data in cookies instead of localStorage for better security
 * @param user The user data to store
 */
export function storeUserData(user: AuthUser): void {
  // We don't store user data in localStorage/cookies anymore
  // Authentication is handled via HTTP-only cookies set by the server
  console.log("User data storage handled by secure cookies");
}

/**
 * Clear stored user data (for logout)
 */
export function clearUserData(): void {
  // We don't need to clear localStorage as we're using secure cookies now
  console.log("User data clearing handled by server-side cookie removal");
}

/**
 * Determine the proper home route based on user role
 */
export function getUserHomeRoute(user: AuthUser): string {
  if (!user) return "/";
  
  switch (user.role) {
    case "admin":
      return "/admin/dashboard";
    case "merchant":
      return "/merchant/dashboard";
    case "investor":
      return "/investor/dashboard";
    case "customer":
      return "/customer/dashboard";
    default:
      return "/";
  }
}

export async function registerUser(params: RegisterParams): Promise<void> {
  const response = await apiClient.post<void>("/api/auth/register", params);
  if (response.error) {
    throw new Error(response.error);
  }
}

export async function loginUser(email: string, password: string, userType?: string): Promise<AuthResult> {
  const response = await apiClient.post<AuthResult>("/api/auth/login", {
    email,
    password,
    ...(userType ? { userType } : {}),
  });
  
  if (response.error || !response.data?.user) {
    throw new Error(response.error || "Invalid response from server");
  }
  
  return response.data;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // Instead of checking localStorage, make an API call to validate session
    const response = await apiClient.get<{ user: AuthUser }>("/api/auth/me");
    
    if (response.error || !response.data?.user) {
      return null;
    }
    
    return response.data.user;
  } catch (error) {
    console.error("Failed to get current user:", error);
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  await apiClient.post<void>("/api/auth/logout");
}