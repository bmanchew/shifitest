import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

interface Document {
  id: number;
  contractId: number;
  contractNumber: string;
  signedAt: string;
  documentUrl: string;
  status: string;
  accessible: boolean | null;
  contentType: string | null;
}

const ThanksRogerDocumentTest: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest('/api/admin/thanksroger-test/documents');
      if (response.success && response.documents) {
        setDocuments(response.documents);
      } else {
        setError('Failed to fetch documents: ' + (response.message || 'Unknown error'));
        toast({
          title: 'Error',
          description: 'Failed to fetch document data',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Error fetching documents: ' + (err instanceof Error ? err.message : String(err)));
      toast({
        title: 'Error',
        description: 'Failed to connect to the server',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyDocumentUrl = async (documentId: number) => {
    // Find the document
    const documentIndex = documents.findIndex(doc => doc.id === documentId);
    if (documentIndex === -1) return;

    // Update document status to show verification in progress
    const updatedDocuments = [...documents];
    updatedDocuments[documentIndex] = {
      ...updatedDocuments[documentIndex],
      accessible: null,
      contentType: null
    };
    setDocuments(updatedDocuments);

    try {
      const response = await apiRequest(`/api/admin/thanksroger-test/verify-document/${documentId}`);
      
      if (response.success) {
        // Update document with verification results
        const newDocuments = [...documents];
        newDocuments[documentIndex] = {
          ...newDocuments[documentIndex],
          accessible: response.accessible,
          contentType: response.contentType || null
        };
        setDocuments(newDocuments);
        
        toast({
          title: response.accessible ? 'Document Accessible' : 'Document Inaccessible',
          description: response.accessible 
            ? `Document verified with content type: ${response.contentType}` 
            : `Document URL could not be accessed: ${response.error || 'Unknown error'}`,
          variant: response.accessible ? 'default' : 'destructive',
        });
      } else {
        toast({
          title: 'Verification Failed',
          description: response.message || 'Unknown error occurred during verification',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error verifying document URL:', err);
      toast({
        title: 'Error',
        description: 'Failed to connect to the server for verification',
        variant: 'destructive',
      });
    }
  };

  const openDocument = (url: string) => {
    window.open(url, '_blank');
  };
  
  const refreshData = () => {
    fetchDocuments();
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Thanks Roger Document Test</CardTitle>
          <CardDescription>
            Verify document URLs retrieved from Thanks Roger API after signatures
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading documents...</span>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 p-4 rounded-md text-destructive">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="bg-muted p-4 rounded-md">
              <p>No signed documents found with Thanks Roger URLs.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Try signing some documents first or check your Thanks Roger API integration.
              </p>
            </div>
          ) : (
            <Table>
              <TableCaption>
                Signed documents with Thanks Roger URLs
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract #</TableHead>
                  <TableHead>Signed At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Document URL</TableHead>
                  <TableHead>Accessible</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.contractNumber}</TableCell>
                    <TableCell>{new Date(doc.signedAt).toLocaleString()}</TableCell>
                    <TableCell>{doc.status}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      <span title={doc.documentUrl}>{doc.documentUrl}</span>
                    </TableCell>
                    <TableCell>
                      {doc.accessible === null ? (
                        <span className="text-muted-foreground">Not checked</span>
                      ) : doc.accessible ? (
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                          <span className="text-green-500">Yes</span>
                          {doc.contentType && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({doc.contentType})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <XCircle className="h-4 w-4 text-destructive mr-1" />
                          <span className="text-destructive">No</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => verifyDocumentUrl(doc.id)}
                        >
                          Verify
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDocument(doc.documentUrl)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={refreshData}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              'Refresh Data'
            )}
          </Button>
          
          <Button
            onClick={() => {
              toast({
                title: 'Integration Status',
                description: documents.some(doc => doc.accessible) 
                  ? 'Thanks Roger document integration is working correctly!' 
                  : 'No accessible documents found. Check Thanks Roger API or document URLs.',
              });
            }}
          >
            Check Integration Status
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ThanksRogerDocumentTest;