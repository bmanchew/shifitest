import { useState } from 'react';
import { AccreditationVerification } from '../components/investor/AccreditationVerification';
import { toast } from '../components/ui/use-toast';

export default function AccreditationDemo() {
  const [verificationMethod, setVerificationMethod] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{type: string, method: string, count: number}[]>([]);
  
  const handleVerificationSubmit = async (method: string, data: any) => {
    console.log('Verification submitted:', { method, data });
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setVerificationMethod(method);
    
    toast({
      title: 'Verification Submitted',
      description: `Your ${getMethodLabel(method)} verification information has been submitted successfully.`,
    });
    
    return Promise.resolve();
  };
  
  const handleDocumentUpload = async (files: File[], type: string, method: string) => {
    console.log('Documents uploaded:', { files, type, method });
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setUploadedFiles(prev => [
      ...prev, 
      { type, method, count: files.length }
    ]);
    
    toast({
      title: 'Files Uploaded',
      description: `${files.length} file(s) uploaded for ${getMethodLabel(method)} verification.`,
    });
    
    return Promise.resolve();
  };
  
  const getMethodLabel = (method: string): string => {
    switch (method) {
      case 'income': return 'Income-Based';
      case 'net_worth': return 'Net Worth';
      case 'professional': return 'Professional Certification';
      case 'third_party': return 'Third-Party';
      default: return method;
    }
  };
  
  return (
    <div className="container py-8">
      <AccreditationVerification 
        onVerificationSubmit={handleVerificationSubmit}
        onDocumentUpload={handleDocumentUpload}
      />
      
      {/* Debug info - would be removed in production */}
      {(verificationMethod || uploadedFiles.length > 0) && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-2">Debug Information</h3>
          
          {verificationMethod && (
            <div className="mb-4">
              <p className="text-sm font-medium">Verification Method:</p>
              <p className="text-sm bg-white p-2 rounded border">{getMethodLabel(verificationMethod)}</p>
            </div>
          )}
          
          {uploadedFiles.length > 0 && (
            <div>
              <p className="text-sm font-medium">Uploaded Documents:</p>
              <ul className="text-sm bg-white p-2 rounded border">
                {uploadedFiles.map((fileInfo, index) => (
                  <li key={index} className="mb-1">
                    {fileInfo.count} file(s) for {getMethodLabel(fileInfo.method)} ({fileInfo.type})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}