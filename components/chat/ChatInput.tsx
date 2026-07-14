'use client';

import React from 'react';
import { Send, Paperclip, X, Loader2, Link as LinkIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Modal, ModalHeader, ModalContent } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { ImageAttachment } from '@/types';
import { FILE_UPLOAD_CONFIG } from '@/config/constants';
import { useToast } from '@/lib/store/toast-store';

interface ChatInputProps {
  onSend: (content: string, images?: ImageAttachment[]) => void;
  onImageUpload?: (files: File[]) => Promise<ImageAttachment[]>;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onImageUpload,
  disabled = false,
  placeholder = 'Type your message...',
}) => {
  const [message, setMessage] = React.useState('');
  const [images, setImages] = React.useState<ImageAttachment[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [showUrlModal, setShowUrlModal] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const { error, success } = useToast();

  const handleSubmit = () => {
    if (!message.trim() && images.length === 0) return;
    if (disabled) return;

    onSend(message, images.length > 0 ? images : undefined);
    setMessage('');
    setImages([]);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate files
    const validFiles = files.filter((file) => {
      if (!FILE_UPLOAD_CONFIG.acceptedTypes.includes(file.type)) {
        error('Invalid file type', `${file.name} is not a supported file format`);
        return false;
      }
      if (file.size > FILE_UPLOAD_CONFIG.maxSize) {
        error('File too large', `${file.name} exceeds the maximum size of 10MB`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    if (images.length + validFiles.length > FILE_UPLOAD_CONFIG.maxFiles) {
      error('Too many files', `You can only upload up to ${FILE_UPLOAD_CONFIG.maxFiles} files`);
      return;
    }

    setIsUploading(true);

    try {
      if (onImageUpload) {
        const newImages = await onImageUpload(validFiles);
        setImages([...images, ...newImages]);
      } else {
        // Default behavior: create data URLs
        const newImages = await Promise.all(
          validFiles.map(
            (file) =>
              new Promise<ImageAttachment>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  resolve({
                    id: `${Date.now()}-${Math.random()}`,
                    url: e.target?.result as string,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    preview: e.target?.result as string,
                  });
                };
                reader.readAsDataURL(file);
              })
          )
        );
        setImages([...images, ...newImages]);
      }
    } catch (err) {
      error('Upload failed', 'Failed to upload files. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (imageId: string) => {
    setImages(images.filter((img) => img.id !== imageId));
  };

  const handleAddImageFromUrl = async () => {
    if (!imageUrl.trim()) {
      error('Invalid URL', 'Please enter a valid image URL');
      return;
    }

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch {
      error('Invalid URL', 'Please enter a valid URL');
      return;
    }

    // Check if it's an image URL (basic check)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const urlLower = imageUrl.toLowerCase();
    const isImageUrl = imageExtensions.some(ext => urlLower.includes(ext)) || 
                       urlLower.includes('imgur.com') || 
                       urlLower.includes('imgbb.com') ||
                       urlLower.includes('cloudinary.com');

    if (!isImageUrl) {
      error('Invalid image URL', 'URL must point to an image file or be from a supported hosting service');
      return;
    }

    if (images.length >= FILE_UPLOAD_CONFIG.maxFiles) {
      error('Too many files', `You can only upload up to ${FILE_UPLOAD_CONFIG.maxFiles} images`);
      return;
    }

    setIsUploading(true);

    try {
      // Create image attachment from URL
      const newImage: ImageAttachment = {
        id: `url-${Date.now()}-${Math.random()}`,
        url: imageUrl,
        name: imageUrl.split('/').pop() || 'image-from-url',
        size: 0, // Unknown size for URL
        type: 'image/unknown',
        preview: imageUrl, // Use URL as preview
      };

      setImages([...images, newImage]);
      setShowUrlModal(false);
      setImageUrl('');
      success('Image added', 'Image from URL added successfully');
    } catch (err) {
      error('Failed to add image', 'Could not add image from URL');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="p-3 sm:p-4">
      {/* Image Previews */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 px-1">
          {images.map((image) => (
            <div key={image.id} className="relative group">
              {image.type.startsWith('image/') ? (
                <img
                  src={image.preview || image.url}
                  alt={image.name}
                  className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-lg border-2 border-border bg-background"
                />
              ) : (
                <div className="h-16 w-16 sm:h-20 sm:w-20 flex flex-col items-center justify-center bg-muted rounded-lg border-2 border-border overflow-hidden">
                  <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground mb-1" />
                  <span className="text-[8px] sm:text-[10px] text-muted-foreground font-medium uppercase px-1 truncate w-full text-center">
                    {image.name.split('.').pop()}
                  </span>
                </div>
              )}
              <button
                onClick={() => removeImage(image.id)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Remove file"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded-b-lg truncate z-10">
                {image.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_UPLOAD_CONFIG.acceptedTypes.join(',')}
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading || images.length >= FILE_UPLOAD_CONFIG.maxFiles}
          title="Upload files from device"
          className="shrink-0 h-10 w-10"
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowUrlModal(true)}
          disabled={disabled || isUploading || images.length >= FILE_UPLOAD_CONFIG.maxFiles}
          title="Add image from URL"
          className="shrink-0 h-10 w-10"
        >
          <LinkIcon className="h-5 w-5" />
        </Button>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[50px] max-h-[200px] resize-none pr-3 py-3 rounded-xl border-2 focus:border-primary transition-colors"
            rows={1}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={disabled || (!message.trim() && images.length === 0)}
          size="icon"
          className="shrink-0 h-10 w-10 rounded-xl"
          title="Send message (Enter)"
        >
          {disabled ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Helper Text */}
      <div className="flex items-center justify-between mt-2 px-1 text-xs text-muted-foreground">
        <span>
          {images.length > 0 && `${images.length}/${FILE_UPLOAD_CONFIG.maxFiles} files • `}
          Press Enter to send, Shift+Enter for new line
        </span>
        {message.length > 0 && (
          <span className={cn(
            "font-mono",
            message.length > 1000 && "text-amber-600 dark:text-amber-400",
            message.length > 2000 && "text-destructive"
          )}>
            {message.length}
          </span>
        )}
      </div>

      {/* Image URL Modal */}
      <Modal isOpen={showUrlModal} onClose={() => setShowUrlModal(false)}>
        <ModalHeader>
          <h3 className="text-lg font-semibold">Add Image from URL</h3>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">
                Image URL
              </label>
              <Input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://i.imgur.com/example.jpg"
                className="w-full"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddImageFromUrl();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">
                💡 You can also upload from device (auto-hosted securely) or use URLs from:
              </p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1 ml-4">
                <li>• Imgur (imgur.com)</li>
                <li>• imgbb (imgbb.com)</li>
                <li>• Cloudinary (cloudinary.com)</li>
                <li>• Supabase Storage</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddImageFromUrl}
                disabled={!imageUrl.trim() || isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Image'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowUrlModal(false);
                  setImageUrl('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
};
