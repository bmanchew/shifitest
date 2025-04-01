# Frontend Optimization Plan

## Overview

This document outlines a comprehensive plan for optimizing the frontend architecture of the ShiFi platform. The plan focuses on three main areas of improvement:

1. Implementing React Query caching effectively
2. Limiting React Context usage to essential state
3. Implementing proper route guards with @tanstack/react-router

## Current Assessment

After reviewing the frontend codebase, we've identified the following areas for improvement:

1. **React Query Usage**: React Query is partially implemented but not fully utilized for caching and state management. The current implementation sets `staleTime: Infinity`, which prevents automatic refetching, and we're not taking advantage of advanced caching features.

2. **Context Overuse**: The application uses React Context (particularly `AuthContext`) for global state management, but may be overusing it for state that could be managed locally or through React Query.

3. **Routing Concerns**: The app uses `wouter` for routing, but lacks consistent route guards for authentication and authorization. Role-based access control is handled inconsistently across the application.

## Implementation Plan

### 1. Enhanced React Query Implementation

#### 1.1 Query Client Configuration

Update the query client configuration in `client/src/lib/queryClient.ts` to implement more effective caching:

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      staleTime: 60000, // 1 minute instead of Infinity
      cacheTime: 900000, // 15 minutes
      refetchOnWindowFocus: true, 
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        // Don't retry on 401, 403, or 404
        if (
          error instanceof Error && 
          error.message && 
          (error.message.includes('401') || 
           error.message.includes('403') ||
           error.message.includes('404'))
        ) {
          return false;
        }
        // Retry other errors up to 2 times
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
```

#### 1.2 Implement Query Key Factory

Create a query key factory to ensure consistent query key structures:

```typescript
// client/src/lib/queryKeys.ts
export const queryKeys = {
  auth: {
    current: ['auth', 'current'],
    user: (id: number) => ['auth', 'user', id],
  },
  merchant: {
    list: ['merchants'],
    detail: (id: number) => ['merchants', id],
    contracts: (id: number) => ['merchants', id, 'contracts'],
    dashboard: (id: number) => ['merchants', id, 'dashboard'],
  },
  contract: {
    list: ['contracts'],
    detail: (id: number) => ['contracts', id],
    payments: (id: number) => ['contracts', id, 'payments'],
  },
  investor: {
    offerings: ['investor', 'offerings'],
    offering: (id: number) => ['investor', 'offerings', id],
    investments: ['investor', 'investments'],
    investment: (id: number) => ['investor', 'investments', id],
  },
  // Add more query keys for other entity types
};
```

#### 1.3 Create Custom Hooks for Common Data Fetching Patterns

Implement custom hooks that leverage React Query for common data fetching operations:

```typescript
// client/src/hooks/use-contracts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

export function useContract(id: number) {
  return useQuery({
    queryKey: queryKeys.contract.detail(id),
    enabled: !!id,
  });
}

export function useContractPayments(contractId: number) {
  return useQuery({
    queryKey: queryKeys.contract.payments(contractId),
    enabled: !!contractId,
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ contractId, data }: { contractId: number, data: any }) => {
      return apiRequest('PATCH', `/api/contracts/${contractId}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contract.detail(variables.contractId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.contract.list,
      });
    },
  });
}
```

### 2. Context Usage Optimization

#### 2.1 Refactor AuthContext

Simplify the `AuthContext` to contain only essential auth state:

```typescript
// client/src/context/AuthContext.tsx (simplified)
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check for existing auth on load
  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    setIsLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Fetch CSRF token first
      await fetchCsrfToken();

      const data = await apiRequest<{success: boolean; user: AuthUser}>(
        "POST", 
        "/api/auth/login", 
        { email, password }
      );

      if (!data.user) {
        throw new Error("Invalid response format - missing user data");
      }

      setUser(data.user);
      storeUserData(data.user);
      
      // Clear and refetch queries after login
      queryClient.clear();
      
      // Redirect based on role
      const homeRoute = getUserHomeRoute(data.user);
      setLocation(homeRoute);
      
      toast({
        title: "Login Successful",
        description: `Welcome, ${data.user.firstName || data.user.name || "User"}!`,
      });
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetchCsrfToken();
      await apiRequest("POST", "/api/auth/logout");
      
      // Clear user state
      setUser(null);
      clearUserData();
      clearCsrfToken();
      
      // Clear all cached queries
      queryClient.clear();
      
      // Redirect to home
      setLocation("/");
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      console.error("Error during logout:", error);
      
      // Handle logout failure by clearing local state anyway
      setUser(null);
      clearUserData();
      clearCsrfToken();
      queryClient.clear();
      setLocation("/");
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

#### 2.2 Move User Profile Data to React Query

Extract user profile data management from context into React Query:

```typescript
// client/src/hooks/use-profile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from './use-auth';

export function useProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.auth.user(user?.id || 0),
    enabled: !!user,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (profileData: any) => {
      return apiRequest('PATCH', `/api/users/${user?.id}/profile`, profileData);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.auth.user(user.id),
        });
      }
    },
  });
}
```

### 3. Implement Route Guards with @tanstack/react-router

#### 3.1 Install @tanstack/react-router

Replace `wouter` with `@tanstack/react-router` for improved type safety and route guards.

```bash
npm install @tanstack/react-router
```

#### 3.2 Implement Route Configuration

Create a type-safe route configuration:

```typescript
// client/src/router.tsx
import { Route, Router, RouterContext, Outlet } from '@tanstack/react-router';
import { useAuth } from '@/hooks/use-auth';
import { Suspense, lazy } from 'react';
import { Spinner } from '@/components/ui/spinner';

// Lazy-loaded components
const Login = lazy(() => import('@/pages/Login'));
const NotFound = lazy(() => import('@/pages/not-found'));

// Admin pages
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
// ... other imports

// Route components with guards
function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <Spinner size="lg" className="mx-auto my-8" />;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <Outlet />;
}

function AdminRoute() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <Spinner size="lg" className="mx-auto my-8" />;
  }
  
  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" />;
  }
  
  return <Outlet />;
}

function MerchantRoute() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <Spinner size="lg" className="mx-auto my-8" />;
  }
  
  if (!user || user.role !== 'merchant') {
    return <Navigate to="/login" />;
  }
  
  return <Outlet />;
}

// ... similar route guards for investor and customer

// Create route tree
const rootRoute = new Route({
  component: AppRoot,
});

const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
});

const loginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});

// Protected route parent
const protectedRoute = new Route({
  getParentRoute: () => rootRoute,
  component: ProtectedRoute,
});

// Admin routes
const adminRoute = new Route({
  getParentRoute: () => protectedRoute,
  component: AdminRoute,
  path: 'admin',
});

const adminDashboardRoute = new Route({
  getParentRoute: () => adminRoute,
  path: 'dashboard',
  component: () => (
    <Suspense fallback={<Spinner size="lg" className="mx-auto my-8" />}>
      <AdminDashboard />
    </Suspense>
  ),
});

// ... define other routes similarly

// Create router
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  protectedRoute.addChildren([
    adminRoute.addChildren([
      adminDashboardRoute,
      // ... other admin routes
    ]),
    // ... merchant, investor, customer routes
  ]),
]);

export const router = new Router({ routeTree });

// Router components
export function AppRoot() {
  return (
    <>
      <Toaster />
      <Outlet />
    </>
  );
}

export function Navigate({ to }: { to: string }) {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate({ to });
  }, [to, navigate]);
  
  return <Spinner size="sm" className="mx-auto my-4" />;
}
```

#### 3.3 Implement Router Provider

Update `AppWrapper.tsx` to use the new router:

```typescript
// client/src/AppWrapper.tsx
import { AuthProvider } from "./context/AuthContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { AppConfigContext } from './context/AppConfigContext';
import { APP_DOMAIN, API_URL } from './env';

export default function AppWrapper() {
  return (
    <AppConfigContext.Provider value={{ apiBaseUrl: API_URL, appDomain: APP_DOMAIN }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </AppConfigContext.Provider>
  );
}
```

## Implementation Strategy

We recommend implementing these changes in the following phases:

### Phase 1: React Query Enhancements
- Update the query client configuration for better caching
- Create the query key factory
- Implement custom query hooks for common data fetching patterns
- Update one feature (e.g., Contracts) to use the new pattern

### Phase 2: Context Optimization
- Refactor the AuthContext to focus on authentication concerns
- Move profile and user-related data to React Query
- Create custom hooks for various slice data that don't require context

### Phase 3: Routing
- Install @tanstack/react-router
- Create route definitions with guards
- Migrate high-priority pages first
- Complete migration of all pages

## Impact and Benefits

The proposed changes will result in the following benefits:

1. **Improved Performance**:
   - More efficient data fetching and caching
   - Reduced unnecessary re-renders
   - Better state management leading to improved UI responsiveness

2. **Enhanced Developer Experience**:
   - Clearer separation of concerns
   - More predictable state management
   - Type-safe routing with @tanstack/react-router

3. **Better User Experience**:
   - Faster page loads due to intelligent caching
   - More responsive UI due to optimized rendering
   - Consistent authentication flows and access control

4. **Code Maintainability**:
   - Reduced complexity in global state
   - Standardized patterns for data fetching
   - Clear, typed route definitions

## Conclusion

This optimization plan addresses the key areas of the frontend architecture that need improvement. By implementing these changes, we'll create a more performant, maintainable, and developer-friendly frontend codebase that follows best practices for React applications.

The incremental implementation approach allows us to make these improvements without disrupting the existing functionality, ensuring a smooth transition to the enhanced architecture.