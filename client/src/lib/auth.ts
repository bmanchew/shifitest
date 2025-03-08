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

    console.log('Login response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Login API error:', errorData);
      throw new Error(errorData.message || `Login failed with status ${response.status}`);
    }

    const data = response;
    console.log('Login successful, user role:', data.user?.role);
    return data.user;
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