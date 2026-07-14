'use client';

import React from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { FILE_UPLOAD_CONFIG } from '@/config/constants';

interface ImageUploadProps {
  onUpload: (files: File[]) => void;
  maxFiles?: number;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onUpload,
  maxFiles = FILE_UPLOAD_CONFIG.maxFiles,
  className,
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': FILE_UPLOAD_CONFIG.acceptedExtensions,
    },
    maxSize: FILE_UPLOAD_CONFIG.maxSize,
    maxFiles,
    onDrop: onUpload,
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          className
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-muted">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          
          <div>
            <p className="text-sm font-medium">
              {isDragActive ? 'Drop images here' : 'Drag & drop images here'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse • Max {maxFiles} files • Up to {FILE_UPLOAD_CONFIG.maxSize / (1024 * 1024)}MB each
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
              ✅ Images uploaded to secure storage (publicly accessible)
            </p>
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground">
            {FILE_UPLOAD_CONFIG.acceptedExtensions.map((ext) => (
              <span key={ext} className="px-2 py-1 bg-muted rounded">
                {ext}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
        Gambar akan diunggah ke layanan hosting pihak ketiga untuk diproses.
        Hindari mengunggah informasi sensitif.
      </p>
    </div>
  );
};

interface ImagePreviewProps {
  images: Array<{ id: string; url: string; name: string; preview?: string }>;
  onRemove: (id: string) => void;
  className?: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ images, onRemove, className }) => {
  if (images.length === 0) return null;

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4', className)}>
      {images.map((image) => (
        <div key={image.id} className="relative group">
          <img
            src={image.preview || image.url}
            alt={image.name}
            className="w-full h-32 object-cover rounded-lg border"
          />
          <button
            onClick={() => onRemove(image.id)}
            className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-xs truncate rounded-b-lg">
            {image.name}
          </div>
        </div>
      ))}
    </div>
  );
};
