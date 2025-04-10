import { fetchCsrfToken } from "../csrf";

export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

export class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string = "";

  private constructor() {}

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    requiresCsrf: boolean = true
  ): Promise<ApiResponse<T>> {
    try {
      // Get CSRF token for state-changing requests
      if (requiresCsrf && (method === "POST" || method === "PUT" || method === "DELETE")) {
        await fetchCsrfToken();
      }

      const url = `${this.baseUrl}${endpoint}`;
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      };

      if (data && (method === "POST" || method === "PUT")) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      const responseData = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: responseData.message || "An error occurred",
          status: response.status,
        };
      }

      return {
        data: responseData,
        error: null,
        status: response.status,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Network error",
        status: 0,
      };
    }
  }

  public async get<T>(endpoint: string, requiresCsrf: boolean = false): Promise<ApiResponse<T>> {
    return this.request<T>("GET", endpoint, undefined, requiresCsrf);
  }

  public async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>("POST", endpoint, data);
  }

  public async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", endpoint, data);
  }

  public async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", endpoint);
  }
}

export const apiClient = ApiClient.getInstance();