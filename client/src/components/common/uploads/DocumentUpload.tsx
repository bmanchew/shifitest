import React, { useState, useRef } from 'react';
import { 
  AlertCircle, 
  FileText, 
  UploadCloud, 
  X, 
  Check, 
  Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DocumentUploadProps {
  label: string;
  description?: string;
  allowedTypes?: string[];
  maxSizeMB?: number;
  onFileSelected: (file: File) => void;
  onFileRemoved?: () => void;
  isUploading?: boolean;
  error?: string;
  className?: string;
}

export function DocumentUpload({
  label,
  description,
  allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'],
  maxSizeMB = 5,
  onFileSelected,
  onFileRemoved,
  isUploading = false,
  error,
  className,
}: DocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      return;
    }

    // Validate file size
    if (file.size > maxSizeBytes) {
      return;
    }

    setSelectedFile(file);
    onFileSelected(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onFileRemoved) {
      onFileRemoved();
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getFileTypeLabel = (): string => {
    return allowedTypes
      .map((type) => {
        if (type === 'image/jpeg') return 'JPEG';
        if (type === 'image/png') return 'PNG';
        if (type === 'application/pdf') return 'PDF';
        return type.split('/')[1].toUpperCase();
      })
      .join(', ');
  };

  return (
    <div className={`${className || ''}`}>
      <div className="mb-2">
        <div className="text-sm font-medium mb-1">{label}</div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {!selectedFile ? (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/20 hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleTriggerFileInput}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept={allowedTypes.join(',')}
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center gap-2">
            <UploadCloud className="h-10 w-10 text-muted-foreground/70" />
            <div className="text-sm font-medium">
              Drag & drop or click to upload
            </div>
            <div className="text-xs text-muted-foreground">
              {getFileTypeLabel()} files up to {maxSizeMB}MB
            </div>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium truncate max-w-[200px]">
                  {selectedFile.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            </div>
            {isUploading ? (
              <div className="ml-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {isUploading && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Uploading...</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}