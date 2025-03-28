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
  
  // Domain handling - don't redirect, just log information
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const origin = window.location.origin;
      
      // Log the domain information for debugging
      console.log(`Current hostname: ${hostname}`);
      console.log(`Current origin: ${origin}`);
      console.log(`APP_DOMAIN from env: ${APP_DOMAIN}`);
      console.log(`API_URL from env: ${API_URL}`);
      
      // Don't redirect - just use the current domain
      // This prevents issues with Replit webview
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