import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { fetchCsrfToken } from "@/lib/csrf";

export default function AdminAuthDebug() {
  const { user } = useAuth();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [csrfStatus, setCsrfStatus] = useState<string>("Not checked");
  const [verifyTokenStatus, setVerifyTokenStatus] = useState<string>("Not checked");
  const [adminMerchantsStatus, setAdminMerchantsStatus] = useState<string>("Not checked");
  const [localStorageData, setLocalStorageData] = useState<string | null>(null);
  
  // Get data from localStorage on component mount
  useEffect(() => {
    try {
      const userData = localStorage.getItem("shifi_user");
      setLocalStorageData(userData);
    } catch (error) {
      console.error("Error accessing localStorage:", error);
      setLocalStorageData("Error accessing localStorage");
    }
  }, []);

  // Check CSRF token
  const checkCsrfToken = async () => {
    try {
      setCsrfStatus("Checking...");
      const token = await fetchCsrfToken();
      setCsrfToken(token);
      setCsrfStatus("Valid");
    } catch (error) {
      console.error("Error fetching CSRF token:", error);
      setCsrfStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Verify JWT token with server
  const verifyToken = async () => {
    try {
      setVerifyTokenStatus("Checking...");
      const response = await apiRequest("GET", "/api/auth/verify-token");
      setVerifyTokenStatus(`Valid: ${JSON.stringify(response)}`);
    } catch (error) {
      console.error("Error verifying token:", error);
      setVerifyTokenStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Test admin merchants endpoint
  const testAdminMerchants = async () => {
    try {
      setAdminMerchantsStatus("Checking...");
      const response = await apiRequest("GET", "/api/admin/merchants");
      setAdminMerchantsStatus(`Success: Found ${response.merchants ? response.merchants.length : 0} merchants`);
    } catch (error) {
      console.error("Error accessing admin merchants:", error);
      setAdminMerchantsStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="container py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Admin Authentication Debug Tool</h1>
      
      {/* User Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current User Information</CardTitle>
          <CardDescription>Details about the currently authenticated user</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div>
              <div className="grid grid-cols-2 gap-2">
                <div className="font-medium">ID:</div>
                <div>{user.id}</div>
                <div className="font-medium">Email:</div>
                <div>{user.email}</div>
                <div className="font-medium">Name:</div>
                <div>{user.firstName} {user.lastName}</div>
                <div className="font-medium">Role:</div>
                <div>{user.role}</div>
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Not authenticated</AlertTitle>
              <AlertDescription>
                No user is currently authenticated according to the AuthContext.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* LocalStorage Data */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>LocalStorage Data</CardTitle>
          <CardDescription>User data stored in browser localStorage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-32">
            <pre>{localStorageData || "No data found"}</pre>
          </div>
        </CardContent>
      </Card>
      
      {/* Authentication Tests */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication Tests</CardTitle>
          <CardDescription>Run tests to verify authentication components</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="font-medium">CSRF Token:</span>
              <span className={csrfStatus === "Valid" ? "text-green-600" : csrfStatus.includes("Error") ? "text-red-600" : "text-gray-500"}>
                {csrfStatus}
              </span>
            </div>
            <Button onClick={checkCsrfToken} variant="outline" size="sm">Check CSRF Token</Button>
            {csrfToken && (
              <div className="mt-2 bg-gray-100 p-2 rounded-md text-xs overflow-auto">
                <code>{csrfToken}</code>
              </div>
            )}
          </div>
          
          <Separator />
          
          <div>
            <div className="flex justify-between mb-2">
              <span className="font-medium">JWT Token Verification:</span>
              <span className={verifyTokenStatus.includes("Valid") ? "text-green-600" : verifyTokenStatus.includes("Error") ? "text-red-600" : "text-gray-500"}>
                {verifyTokenStatus === "Not checked" ? "Not checked" : verifyTokenStatus.includes("Valid") ? "Valid" : "Invalid"}
              </span>
            </div>
            <Button onClick={verifyToken} variant="outline" size="sm">Verify JWT Token</Button>
            {verifyTokenStatus !== "Not checked" && verifyTokenStatus !== "Checking..." && (
              <div className="mt-2 bg-gray-100 p-2 rounded-md text-xs overflow-auto">
                <code>{verifyTokenStatus}</code>
              </div>
            )}
          </div>
          
          <Separator />
          
          <div>
            <div className="flex justify-between mb-2">
              <span className="font-medium">Admin Merchants API:</span>
              <span className={adminMerchantsStatus.includes("Success") ? "text-green-600" : adminMerchantsStatus.includes("Error") ? "text-red-600" : "text-gray-500"}>
                {adminMerchantsStatus === "Not checked" ? "Not checked" : adminMerchantsStatus.includes("Success") ? "Success" : "Failed"}
              </span>
            </div>
            <Button onClick={testAdminMerchants} variant="outline" size="sm">Test Admin Merchants API</Button>
            {adminMerchantsStatus !== "Not checked" && adminMerchantsStatus !== "Checking..." && (
              <div className="mt-2 bg-gray-100 p-2 rounded-md text-xs overflow-auto">
                <code>{adminMerchantsStatus}</code>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-gray-500">
            Use these tools to debug authentication issues. If all tests pass but you still have problems, check server logs for more details.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}