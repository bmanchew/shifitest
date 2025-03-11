
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchApi } from "@/lib/api";

export default function ContractLookup() {
  const { contractId: urlContractId } = useParams();
  const [contractId, setContractId] = useState(urlContractId || "");
  const [loading, setLoading] = useState(!!urlContractId);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractId.trim()) {
      setError("Please enter a contract number.");
      return;
    }
    
    // Clear any previous errors and set loading state
    setError(null);
    setLoading(true);
    
    // Start the lookup process
    lookupContract(contractId.trim());
  };

  const lookupContract = async (id: string) => {
    try {
      console.log(`Looking up contract: ${id}`);
      
      // Validate the contract ID format first
      if (!id || id === "undefined" || id === "null") {
        setError("Invalid contract format. Please check your SMS and try again with the correct link.");
        console.error(`Invalid contract ID format: ${id}`);
        setLoading(false);
        return;
      }
      
      // Attempt to make a numeric ID for API call
      const numericId = parseInt(id, 10);
      if (isNaN(numericId) || numericId <= 0) {
        setError("Contract ID must be a valid positive number. Please check your SMS link.");
        console.error(`Invalid numeric contract ID: ${id} parsed as ${numericId}`);
        setLoading(false);
        return;
      }

      // Fetch the contract to verify it exists
      const response = await fetchApi(`/contracts/${numericId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError("This contract couldn't be found. It may have expired or been cancelled.");
          console.error(`Contract ${numericId} not found (404)`);
        } else {
          setError("There was a problem loading your financing application. Please try again.");
          console.error(`Error loading contract ${numericId}: ${response.status}`);
        }
        setLoading(false);
        return;
      }

      // Contract found, get the data
      const contract = await response.json();
      console.log("Contract found:", contract);
      
      // Successfully found the contract, redirecting to the application page with the valid ID
      toast({
        title: "Contract Found",
        description: `Loading application for contract ${contract.contractNumber}`,
      });
      
      // Use the numeric ID for consistency
      navigate(`/apply/${numericId}`);
    } catch (error) {
      console.error("Error in contract lookup:", error);
      setError("Something went wrong. Please try again later.");
      setLoading(false);
    }
  };

  // Auto-lookup if contract ID is in the URL
  useEffect(() => {
    if (urlContractId) {
      lookupContract(urlContractId);
    }
  }, []);

  return (
    <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Find Your Application</CardTitle>
          <CardDescription>
            Enter your contract number to continue with your financing application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter contract number (e.g. SHI-0001)"
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                disabled={loading}
                className="w-full"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Looking up contract..." : "Continue Application"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-500">
            Need help? Contact customer support at (555) 123-4567
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
