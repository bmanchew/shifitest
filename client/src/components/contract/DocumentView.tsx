import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { FileText, Download, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface DocumentViewProps {
  contractId: number;
}

const DocumentView: React.FC<DocumentViewProps> = ({ contractId }) => {
  // Fetch contract document using the same endpoint we created earlier
  const { data: documentData, isLoading, error } = useQuery({
    queryKey: ['/api/contracts', contractId, 'document'],
    queryFn: async () => {
      if (!contractId) return null;
      
      try {
        const res = await fetch(`/api/contracts/${contractId}/document`, {
          credentials: 'include',
        });
        
        if (!res.ok) {
          return { success: false, message: 'Document not found' };
        }
        
        return res.json();
      } catch (error) {
        console.error('Error fetching document:', error);
        return { success: false, message: 'Error retrieving document' };
      }
    },
    enabled: !!contractId,
  });

  const handleViewDocument = () => {
    if (documentData && documentData.success && documentData.documentUrl) {
      window.open(documentData.documentUrl, '_blank');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contract Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
            <span className="ml-2 text-sm text-gray-500">Loading document...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract Documents</CardTitle>
        <CardDescription>
          View and manage signed contract documents
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!documentData || !documentData.success ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Document Not Available</AlertTitle>
            <AlertDescription>
              {documentData?.message || 'The signed contract document is not yet available.'}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="border rounded-lg p-4 flex justify-between items-center">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-gray-400 mr-3" />
              <div>
                <p className="font-medium">Signed Financing Contract</p>
                <p className="text-sm text-gray-500">
                  Signed on {documentData.signedAt 
                    ? format(new Date(documentData.signedAt), 'MMM d, yyyy') 
                    : 'Unknown date'}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleViewDocument}>
              <Download className="mr-2 h-4 w-4" />
              View Document
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentView;