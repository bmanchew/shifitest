import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function NotFound() {
  const [_, setLocation] = useLocation();
  const { user } = useAuth();

  // Redirect to login if requested /login directly and not logged in
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/login' && !user) {
      setLocation('/login');
    }
  }, [user, setLocation]);

  const handleGoHome = () => {
    if (user) {
      // Redirect based on user role
      if (user.role === 'admin') {
        setLocation('/admin/dashboard');
      } else if (user.role === 'merchant') {
        setLocation('/merchant/dashboard');
      } else {
        setLocation('/');
      }
    } else {
      // Not logged in - go to login page
      setLocation('/login');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            The page you're looking for doesn't exist or you may not have permission to view it.
          </p>
          
          <div className="mt-6">
            <Button onClick={handleGoHome} className="w-full">
              {user ? 'Go to Dashboard' : 'Go to Login'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
