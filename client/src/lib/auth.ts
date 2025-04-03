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
    // First check if we have user data in local storage
    const userData = localStorage.getItem("shifi_user");
    let user: AuthUser | null = null;

    if (userData) {
      // Parse the existing user data from localStorage
      user = JSON.parse(userData);
    }

    // Attempt to validate the session and get fresh merchant data
    if (user?.role === 'merchant' && !user.merchantId) {
      console.log("Merchant user found without merchantId, attempting to fetch from API");
      
      try {
        // First try the merchants/current endpoint
        const merchantResponse = await apiRequest<{ success: boolean; data?: { id: number }; merchant?: { id: number } }>(
          "GET", 
          "/api/merchants/current"
        );
        
        if (merchantResponse.success) {
          if (merchantResponse.data?.id) {
            console.log(`Successfully retrieved merchant ID from data.id: ${merchantResponse.data.id}`);
            
            // Update the local user data with merchant information
            user = {
              ...user,
              merchantId: merchantResponse.data.id
            };
            
            // Store the updated user data
            storeUserData(user);
          } else if (merchantResponse.merchant?.id) {
            console.log(`Successfully retrieved merchant ID from merchant.id: ${merchantResponse.merchant.id}`);
            
            // Update the local user data with merchant information
            user = {
              ...user,
              merchantId: merchantResponse.merchant.id
            };
            
            // Store the updated user data
            storeUserData(user);
          } else {
            console.warn("Merchant endpoint returned success but no valid ID found in response", merchantResponse);
          }
        } else {
          console.warn("Failed to get merchant data from /api/merchants/current, trying alternative endpoint");
          
          // Fallback to the merchant-dashboard endpoint
          const dashboardResponse = await apiRequest<{ success: boolean; merchant: any }>(
            "GET", 
            "/api/merchant-dashboard/current"
          );
          
          if (dashboardResponse.success && dashboardResponse.merchant) {
            console.log(`Successfully retrieved merchant ID from dashboard endpoint: ${dashboardResponse.merchant.id}`);
            
            // Update the local user data with merchant information
            user = {
              ...user,
              merchantId: dashboardResponse.merchant.id
            };
            
            // Store the updated user data
            storeUserData(user);
          }
        }
      } catch (error) {
        console.warn("Failed to get current merchant data:", error);
        // We'll continue with the existing user data even if the merchant API call fails
      }
    }
    
    return user;
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
