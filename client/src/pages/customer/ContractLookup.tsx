
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Spinner } from "../../components/ui/spinner";

export default function ContractLookup() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContract = async () => {
      if (!contractId) {
        setError("No contract ID provided");
        setLoading(false);
        return;
      }

      try {
        console.log(`Looking up contract: ${contractId}`);
        
        // Attempt to fetch the contract
        const response = await fetch(`/api/contracts/${contractId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Contract fetch error:", errorData);
          
          if (response.status === 404) {
            setError("This contract couldn't be found. It may have expired or been cancelled.");
          } else {
            setError("There was a problem loading your financing application. Please try again.");
          }
          setLoading(false);
          return;
        }
        
        // Successfully found the contract, redirect to the application page
        console.log("Contract found, redirecting to application page");
        navigate(`/customer/application/${contractId}`);
        
      } catch (error) {
        console.error("Error in contract lookup:", error);
        setError("Something went wrong. Please try again later.");
        setLoading(false);
      }
    };

    fetchContract();
  }, [contractId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Loading Your Application</CardTitle>
            <CardDescription>Please wait while we retrieve your financing information</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center p-6">
            <Spinner size="lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Application Not Found</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <p className="text-sm text-gray-600 text-center mb-4">
              If you received this link recently, please contact the merchant who sent it to you.
            </p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null; // Shouldn't reach here due to the redirect
}
