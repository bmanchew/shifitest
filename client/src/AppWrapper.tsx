import { AuthProvider } from "./context/AuthContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import { BrowserRouter } from "react-router-dom"; // Added import

export default function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter> {/* Wrapped App with BrowserRouter */}
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}