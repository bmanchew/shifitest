import React, { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { FileText, CheckCircle, AlertCircle, ArrowRightCircle, RefreshCw } from 'lucide-react';

export default function ThanksRogerTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const testThanksRogerAPI = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/thanksroger/test-thanksroger', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const responseData = await response.json();
      setResult(responseData);
      toast({
        title: responseData.success ? 'Success!' : 'Warning',
        description: responseData.message,
        variant: responseData.success ? 'default' : 'destructive'
      });
    } catch (err) {
      console.error('Error testing Thanks Roger API:', err);
      setError(err instanceof Error ? err.message : String(err));
      toast({
        title: 'Error',
        description: `Failed to test Thanks Roger API: ${err instanceof Error ? err.message : String(err)}`,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Thanks Roger API Test</h1>
        <Button 
          onClick={testThanksRogerAPI} 
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <ArrowRightCircle className="h-4 w-4" />
              Test Integration
            </>
          )}
        </Button>
      </div>
      
      <Separator className="my-4" />
      
      <div className="grid gap-4">
        {error && (
          <Card className="border-red-400">
            <CardHeader className="bg-red-50 dark:bg-red-900/20">
              <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Error Testing API
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <pre className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md overflow-auto text-sm">
                {error}
              </pre>
            </CardContent>
          </Card>
        )}
        
        {result && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Agreement Details</CardTitle>
                <CardDescription>
                  Document information from the database
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">ID</div>
                    <div>{result.agreement?.id}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Program</div>
                    <div>{result.agreement?.programName}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Merchant</div>
                    <div>{result.agreement?.merchantName}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">File Name</div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      {result.agreement?.originalFilename}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">MIME Type</div>
                    <div>{result.agreement?.mimeType}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">File Size</div>
                    <div>{result.agreement?.fileSize ? `${Math.round(result.agreement.fileSize / 1024)} KB` : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Has Template?</div>
                    <div>
                      {result.agreement?.hasExternalTemplateId ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" /> Yes
                        </Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Template ID</div>
                    <div>{result.agreement?.externalTemplateId || 'N/A'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {result.templateDetails && (
              <Card>
                <CardHeader>
                  <CardTitle>Thanks Roger Template Details</CardTitle>
                  <CardDescription>
                    Details retrieved from the Thanks Roger API
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md overflow-auto text-sm">
                    {JSON.stringify(result.templateDetails, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </>
        )}
        
        {!result && !error && !isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>Test the Thanks Roger API Integration</CardTitle>
              <CardDescription>
                Click the "Test Integration" button to verify the Thanks Roger API integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                This test will:
              </p>
              <ul className="list-disc pl-5 mt-2 text-muted-foreground">
                <li>Retrieve a program agreement from the database</li>
                <li>If it has a template ID, fetch the template details from Thanks Roger</li>
                <li>If it doesn't have a template ID, create a new template in Thanks Roger</li>
                <li>Display the results of the operation</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={testThanksRogerAPI} 
                disabled={isLoading}
                className="w-full"
              >
                Test Now
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}