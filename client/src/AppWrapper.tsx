import { AuthProvider } from "./context/AuthContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import { createContext, useContext } from "react";

// Create app configuration context
interface AppConfig {
  apiBaseUrl: string;
  appDomain: string;
}

// Get environment variables with fallbacks
const apiBaseUrl = import.meta.env.VITE_API_URL || '';
const appDomain = import.meta.env.VITE_APP_DOMAIN || '';

// Create the context with default values
export const AppConfigContext = createContext<AppConfig>({
  apiBaseUrl,
  appDomain
});

// Hook to use the app configuration
export const useAppConfig = () => useContext(AppConfigContext);

export default function AppWrapper() {
  // Log the configuration for debugging
  console.log("App configuration:", { apiBaseUrl, appDomain });
  
  return (
    <AppConfigContext.Provider value={{ apiBaseUrl, appDomain }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </AppConfigContext.Provider>
  );
}