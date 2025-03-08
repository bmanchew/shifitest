import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";

export type AuthUser = Omit<User, "password"> & {
  merchantId?: number;
};

// Helper function to get full name from first and last name
export function getFullName(user: AuthUser): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  } else if (user.firstName) {
    return user.firstName;
  } else if (user.name) {
    return user.name;
  }
  return '';
}

export interface AuthResult {
  user: AuthUser;
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
  try {
    console.log('Sending login request to API');
    const response = await apiRequest<AuthResult>("POST", "/api/auth/login", {
      email,
      password,
    });

    // apiRequest already returns parsed JSON data, not a Response object
    console.log('Login response:', response);

    if (!response || !response.user) {
      console.error('Login API error: Invalid response format');
      throw new Error('Invalid login response format');
    }

    console.log('Login successful, user role:', response.user?.role);
    return response.user;
  } catch (error) {
    console.error('Login request error:', error);
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