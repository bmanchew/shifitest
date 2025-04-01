import { useState, useRef, ChangeEvent } from 'react';
import { Card } from '../card';
import { Button } from '../button';
import { Progress } from '../progress';
import { X, Upload, FileText } from 'lucide-react';
import { formatFileSize, isImageFile, isPdfFile } from '@/lib/format';

export interface UploadDropzoneProps {
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  description?: string;
  acceptedFileTypes?: string;
  uploading?: boolean;
  progress?: number;
  onUpload?: (files: File[]) => void;
}

export function UploadDropzone({
  multiple = false,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB default
  description = 'Drag and drop files here or click to browse',
  acceptedFileTypes = '*',
  uploading = false,
  progress = 0,
  onUpload = () => {}
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // Validate files
  const validateFiles = (fileList: File[]): File[] => {
    setError(null);
    
    // Check file count
    if (!multiple && fileList.length > 1) {
      setError('Only one file can be uploaded at a time');
      return [];
    }
    
    if (multiple && fileList.length > maxFiles) {
      setError(`Maximum ${maxFiles} files can be uploaded at once`);
      return fileList.slice(0, maxFiles);
    }
    
    // Check file types and size
    const validFiles = fileList.filter(file => {
      // Check file size
      if (file.size > maxSize) {
        setError(`File ${file.name} exceeds maximum size of ${formatFileSize(maxSize)}`);
        return false;
      }
      
      // Check file type if specific types are required
      if (acceptedFileTypes !== '*') {
        const acceptedTypes = acceptedFileTypes.split(',');
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (!acceptedTypes.some(type => type.trim() === fileExtension || type.trim() === file.type)) {
          setError(`File ${file.name} has an invalid type. Accepted types: ${acceptedFileTypes}`);
          return false;
        }
      }
      
      return true;
    });
    
    return validFiles;
  };

  // Handle dropped files
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  // Handle files selected via file input
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      processFiles(selectedFiles);
    }
  };

  // Common file processing logic
  const processFiles = (newFiles: File[]) => {
    const validatedFiles = validateFiles(newFiles);
    
    if (validatedFiles.length > 0) {
      setFiles(validatedFiles);
      onUpload(validatedFiles);
    }
  };

  // Handle file removal
  const removeFile = (index: number) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  // Handle click on dropzone to open file dialog
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Component to render file preview
  const FilePreview = ({ file, index }: { file: File, index: number }) => {
    const isImage = isImageFile(file);
    const isPdf = isPdfFile(file);
    
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border mb-2">
        {isImage ? (
          <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded overflow-hidden">
            <img 
              src={URL.createObjectURL(file)} 
              alt={file.name} 
              className="object-cover w-full h-full"
            />
          </div>
        ) : (
          <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded">
            <FileText className="w-4 h-4 text-gray-600" />
          </div>
        )}
        
        <div className="flex-1 truncate">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
        </div>
        
        <button 
          type="button"
          className="text-gray-500 hover:text-gray-700"
          onClick={() => removeFile(index)}
          disabled={uploading}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={acceptedFileTypes}
        className="hidden"
        onChange={handleFileInputChange}
        disabled={uploading}
      />
      
      <Card
        className={`border-2 border-dashed p-6 text-center ${
          isDragging ? 'border-primary bg-primary/5' : 'border-gray-200'
        } ${error ? 'border-red-400' : ''} transition-colors duration-150`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <div className="flex flex-col items-center justify-center">
          <Upload className={`w-10 h-10 mb-2 ${isDragging ? 'text-primary' : 'text-gray-400'}`} />
          <p className="text-sm font-medium mb-1">{description}</p>
          <p className="text-xs text-gray-500 mb-2">
            {multiple ? `Up to ${maxFiles} files, ` : ''}
            Maximum size: {formatFileSize(maxSize)}
            {acceptedFileTypes !== '*' && ` • Accepted types: ${acceptedFileTypes}`}
          </p>
          
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            disabled={uploading}
          >
            Select Files
          </Button>
        </div>
      </Card>
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      
      {files.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Selected Files:</p>
          {files.map((file, index) => (
            <FilePreview key={`${file.name}-${index}`} file={file} index={index} />
          ))}
        </div>
      )}
      
      {uploading && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">
            {progress < 100 ? 'Uploading...' : 'Upload Complete'}
          </p>
          <Progress value={progress} className="h-2" />
          <p className="mt-1 text-xs text-gray-500 text-right">{progress}%</p>
        </div>
      )}
    </div>
  );
}