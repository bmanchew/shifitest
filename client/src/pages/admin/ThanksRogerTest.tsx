import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';

// Define types for API responses
interface ConnectivityResponse {
  success: boolean;
  message: string;
  baseConnectivity: {
    success: boolean;
    message: string;
    details?: any;
  };
  authConnectivity: {
    success: boolean;
    message: string;
    details?: any;
  } | null;
  authConnectivityHeadOnly: {
    success: boolean;
    message: string;
    details?: any;
  } | null;
  apiKeyPresent: boolean;
}

interface TemplateTestResponse {
  success: boolean;
  message: string;
  agreement?: {
    id: number;
    programId: number;
    programName: string;
    filename: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    uploadedAt: string;
    merchantId: number;
    merchantName: string;
    hasExternalTemplateId: boolean;
    externalTemplateId?: string;
    externalTemplateName?: string;
  };
  templateDetails?: any;
  error?: any;
}

function ThanksRogerTest() {
  const [connectivityResult, setConnectivityResult] = useState<ConnectivityResponse | null>(null);
  const [templateResult, setTemplateResult] = useState<TemplateTestResponse | null>(null);
  const [loading, setLoading] = useState<{ connectivity: boolean; template: boolean }>({
    connectivity: false,
    template: false,
  });
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: '',
  });
  const { toast } = useToast();

  // Test basic connectivity
  const testConnectivity = async () => {
    setLoading(prev => ({ ...prev, connectivity: true }));
    try {
      const result = await apiRequest<ConnectivityResponse>('/api/connectivity-check/thanksroger');
      setConnectivityResult(result);
      toast({
        title: result.success ? 'Connectivity Check Successful' : 'Connectivity Issues Detected',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error testing connectivity:', error);
      setErrorDialog({
        open: true,
        title: 'Connectivity Test Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoading(prev => ({ ...prev, connectivity: false }));
    }
  };

  // Test template creation/retrieval
  const testTemplates = async () => {
    setLoading(prev => ({ ...prev, template: true }));
    try {
      const result = await apiRequest<TemplateTestResponse>('/api/admin/thanksroger-test/test-thanksroger');
      setTemplateResult(result);
      toast({
        title: result.success ? 'Template Test Successful' : 'Template Test Failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error testing templates:', error);
      setErrorDialog({
        open: true,
        title: 'Template Test Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoading(prev => ({ ...prev, template: false }));
    }
  };

  // Run connectivity test on component mount
  useEffect(() => {
    testConnectivity();
  }, []);

  // Helper function to render API test result with proper status indicators
  const renderApiStatus = (status: boolean | undefined) => {
    if (status === undefined) return null;
    return status ? (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Success
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        Failed
      </span>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Thanks Roger API Integration Tests</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Connectivity Test Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              API Connectivity
              {connectivityResult && renderApiStatus(connectivityResult.success)}
            </CardTitle>
            <CardDescription>
              Test basic connectivity to the Thanks Roger API
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading.connectivity ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : connectivityResult ? (
              <div className="space-y-4">
                <div>
                  <Label className="font-medium">API Key Present:</Label>
                  <div className="ml-2 mt-1">
                    {connectivityResult.apiKeyPresent ? 
                      <span className="text-green-600">Yes</span> : 
                      <span className="text-red-600">No</span>
                    }
                  </div>
                </div>
                
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="base-connectivity">
                    <AccordionTrigger className="flex justify-between text-sm">
                      <span>Base URL Connectivity {renderApiStatus(connectivityResult.baseConnectivity?.success)}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(connectivityResult.baseConnectivity, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="auth-connectivity">
                    <AccordionTrigger className="flex justify-between text-sm">
                      <span>Templates API Connectivity {renderApiStatus(connectivityResult.authConnectivity?.success)}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(connectivityResult.authConnectivity, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="auth-head-connectivity">
                    <AccordionTrigger className="flex justify-between text-sm">
                      <span>HEAD Request Test {renderApiStatus(connectivityResult.authConnectivityHeadOnly?.success)}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(connectivityResult.authConnectivityHeadOnly, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            ) : (
              <p>No connectivity data available.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={testConnectivity} 
              disabled={loading.connectivity}
              className="w-full"
            >
              {loading.connectivity ? 'Testing...' : 'Test Connectivity Again'}
            </Button>
          </CardFooter>
        </Card>

        {/* Template Test Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Template Operations
              {templateResult && renderApiStatus(templateResult.success)}
            </CardTitle>
            <CardDescription>
              Test creating or retrieving templates from Thanks Roger
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading.template ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : templateResult ? (
              <div className="space-y-4">
                <div>
                  <Label className="font-medium">Status:</Label>
                  <div className="ml-2 mt-1">{templateResult.message}</div>
                </div>
                
                {templateResult.agreement && (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="agreement">
                      <AccordionTrigger className="text-sm">
                        Agreement Details
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 text-sm">
                          <div><strong>Merchant:</strong> {templateResult.agreement.merchantName}</div>
                          <div><strong>Program:</strong> {templateResult.agreement.programName}</div>
                          <div><strong>File:</strong> {templateResult.agreement.originalFilename}</div>
                          <div><strong>Size:</strong> {(templateResult.agreement.fileSize / 1024).toFixed(2)} KB</div>
                          <div><strong>Template ID:</strong> {templateResult.agreement.externalTemplateId || 'None'}</div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    
                    {templateResult.templateDetails && (
                      <AccordionItem value="template">
                        <AccordionTrigger className="text-sm">
                          Template Details
                        </AccordionTrigger>
                        <AccordionContent>
                          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(templateResult.templateDetails, null, 2)}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                    
                    {templateResult.error && (
                      <AccordionItem value="error">
                        <AccordionTrigger className="text-sm">
                          Error Details
                        </AccordionTrigger>
                        <AccordionContent>
                          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(templateResult.error, null, 2)}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                )}
              </div>
            ) : (
              <p>No template test results available. Run a test to see results.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={testTemplates} 
              disabled={loading.template}
              className="w-full"
            >
              {loading.template ? 'Testing...' : 'Test Template Operations'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Error Dialog */}
      <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{errorDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {errorDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>
              Okay
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ThanksRogerTest;