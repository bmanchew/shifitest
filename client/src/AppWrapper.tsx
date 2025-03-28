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
  
  // Enable domain redirection from repl.co to replit.dev
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isReplitDev = hostname.endsWith('.replit.dev');
      const isJanewayDev = hostname.includes('janeway.replit.dev');
      
      // Only attempt to redirect if we're not already on a .replit.dev domain
      // and we have a valid APP_DOMAIN
      if (!isReplitDev && !isJanewayDev && APP_DOMAIN) {
        const currentPath = window.location.pathname + window.location.search;
        const newUrl = `${APP_DOMAIN}${currentPath}`;
        console.log(`Redirecting to .replit.dev domain: ${newUrl}`);
        window.location.href = newUrl;
      } else {
        console.log(`Current domain: ${hostname}, no redirection needed`);
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