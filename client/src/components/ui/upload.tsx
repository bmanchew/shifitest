import React, { useState, useRef, ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface UploadDropzoneProps {
  onDrop: (acceptedFiles: File[]) => void;
  maxSize?: number;
  maxFiles?: number;
  accept?: Record<string, string[]>;
  disabled?: boolean;
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onDrop,
  maxSize = 5 * 1024 * 1024, // 5MB
  maxFiles = 1,
  accept,
  disabled = false,
}) => {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Convert to array
    const fileArray = Array.from(files);
    
    // Validation
    if (files.length > maxFiles) {
      setError(`Too many files. Maximum allowed is ${maxFiles}.`);
      return;
    }
    
    let hasInvalidSize = false;
    let hasInvalidType = false;
    
    fileArray.forEach(file => {
      if (file.size > maxSize) {
        hasInvalidSize = true;
      }
      
      if (accept) {
        const fileType = file.type;
        let isAccepted = false;
        
        // Check if the file type is in any of the accepted types
        Object.entries(accept).forEach(([mimeType, extensions]) => {
          if (fileType.includes(mimeType.split('/')[0]) || fileType === mimeType) {
            isAccepted = true;
          }
        });
        
        if (!isAccepted) {
          hasInvalidType = true;
        }
      }
    });
    
    if (hasInvalidSize) {
      setError(`File too large. Maximum size is ${formatBytes(maxSize)}.`);
      return;
    }
    
    if (hasInvalidType) {
      setError('Invalid file type.');
      return;
    }
    
    // All validations passed
    setError(null);
    onDrop(fileArray);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div 
        className={`border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[150px] border-muted-foreground/20 hover:border-primary/50 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handleButtonClick}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          multiple={maxFiles > 1}
          accept={accept ? Object.entries(accept).flatMap(([mime, exts]) => exts).join(',') : undefined}
          disabled={disabled}
        />
        <Upload className="w-10 h-10 mb-2 text-muted-foreground" />
        
        <div className="text-center">
          <p className="text-sm font-medium mb-1">
            Click to select files
          </p>
          <p className="text-xs text-muted-foreground">
            {maxFiles > 1 
              ? `Upload up to ${maxFiles} files (max ${formatBytes(maxSize)} each)`
              : `Maximum file size: ${formatBytes(maxSize)}`
            }
          </p>
        </div>
        
        {error && (
          <p className="text-sm text-destructive mt-2">{error}</p>
        )}
      </div>
      
      <div className="flex justify-center mt-2">
        <Button 
          type="button" 
          onClick={handleButtonClick}
          variant="outline"
          size="sm"
          disabled={disabled}
        >
          Browse Files
        </Button>
      </div>
    </div>
  );
};

// Utility function to format bytes
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default UploadDropzone;