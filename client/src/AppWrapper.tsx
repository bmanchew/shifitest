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
  
  // Smart domain redirection that avoids loops and handles Janeway environment
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const currentUrl = window.location.href;
      
      // Check if we're in a Janeway environment - never redirect in this case
      if (hostname.includes('janeway.replit.dev')) {
        console.log("In Janeway environment, no redirection needed");
        return;
      }
      
      // Check if we're already on the target domain
      const isOnTargetDomain = currentUrl.startsWith(APP_DOMAIN);
      
      // Only redirect if we have a valid APP_DOMAIN and we're not already there
      if (APP_DOMAIN && !isOnTargetDomain) {
        const currentPath = window.location.pathname + window.location.search;
        const newUrl = `${APP_DOMAIN}${currentPath}`;
        console.log(`Redirecting to target domain: ${newUrl}`);
        window.location.href = newUrl;
      } else {
        console.log("Already on target domain, no redirection needed");
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