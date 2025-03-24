import { AuthProvider } from "./context/AuthContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import { createContext, useContext, useEffect } from "react";
import { APP_DOMAIN, API_URL } from './env';

// Create app configuration context
interface AppConfig {
  apiBaseUrl: string;
  appDomain: string;
}

// Create the context with values from our environment module
export const AppConfigContext = createContext<AppConfig>({
  apiBaseUrl: API_URL,
  appDomain: APP_DOMAIN
});

// Hook to use the app configuration
export const useAppConfig = () => useContext(AppConfigContext);

export default function AppWrapper() {
  // Log the configuration for debugging
  console.log("App configuration:", { apiBaseUrl: API_URL, appDomain: APP_DOMAIN });
  
  // Force reload if we're not on the .replit.dev domain
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isReplitDev = hostname.endsWith('.replit.dev');
      
      // Only attempt to redirect if we're not already on a .replit.dev domain
      // and we have a valid Replit ID
      if (!isReplitDev && APP_DOMAIN) {
        const currentPath = window.location.pathname + window.location.search;
        const newUrl = `${APP_DOMAIN}${currentPath}`;
        console.log(`Redirecting to .replit.dev domain: ${newUrl}`);
        window.location.href = newUrl;
      }
    }
  }, []);
  
  return (
    <AppConfigContext.Provider value={{ apiBaseUrl: API_URL, appDomain: APP_DOMAIN }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </AppConfigContext.Provider>
  );
}