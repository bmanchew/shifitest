import { apiClient } from "@/lib/api/apiClient";
import { User } from "@shared/schema";

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