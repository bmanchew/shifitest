import { useState } from "react";
import { UploadDropzone } from "@/components/ui/upload/upload-dropzone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface DocumentUploadProps {
  title: string;
  description: string;
  documentType: string;
  maxFiles?: number;
  acceptedFileTypes?: string;
  onUpload: (files: File[], documentType: string) => Promise<void>;
}

export function DocumentUpload({
  title,
  description,
  documentType,
  maxFiles = 5,
  acceptedFileTypes = ".pdf,.jpg,.jpeg,.png",
  onUpload,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    
    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 300);
    
    try {
      await onUpload(files, documentType);
      setUploadProgress(100);
      
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (error) {
      setError("File upload failed. Please try again.");
      setUploadProgress(0);
      setUploading(false);
      clearInterval(progressInterval);
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-md font-medium">{title}</h4>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <UploadDropzone
        multiple={maxFiles > 1}
        maxFiles={maxFiles}
        onUpload={handleUpload}
        uploading={uploading}
        progress={uploadProgress}
        description={description}
        acceptedFileTypes={acceptedFileTypes}
      />
    </div>
  );
}