import React from 'react';
import { X, FileText, Maximize2, Loader2, AlertCircle } from 'lucide-react';
import { ImageAttachment } from '@/types';
import { useUIStore } from '@/lib/store/ui-store';

interface ChatImagePreviewProps {
  images: ImageAttachment[];
  onRemoveImage: (id: string) => void;
  imageClassName?: string;
  buttonClassName?: string;
}

export const ChatImagePreview: React.FC<ChatImagePreviewProps> = ({
  images,
  onRemoveImage,
  imageClassName = "h-32 max-w-[180px] object-cover rounded-xl border-2 border-gray-200/50 dark:border-white/10 shadow-sm",
  buttonClassName = "absolute -top-2 -right-2 w-6 h-6 bg-gray-800/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
}) => {
  const ui = useUIStore();

  if (!images || images.length === 0) return null;

  return (
    <div className="flex gap-3 mb-3 overflow-x-auto pb-2 pt-2 px-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10">
      {images.map((img) => (
        <div key={img.id} className="relative group shrink-0">
          {img.type?.startsWith('image/') && img.uploadStatus !== 'uploading' ? (
            <div 
              className="relative cursor-pointer"
              onClick={() => ui.setAnnotatingImage(img)}
            >
              <img
                src={img.preview || img.url}
                alt={img.name}
                className={imageClassName}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                <Maximize2 className="text-white w-6 h-6" />
              </div>
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center bg-muted overflow-hidden ${imageClassName}`}>
              {img.uploadStatus === 'uploading' ? (
                <Loader2 className="h-8 w-8 text-muted-foreground mb-1 animate-spin" />
              ) : img.uploadStatus === 'error' ? (
                <AlertCircle className="h-8 w-8 text-destructive mb-1" />
              ) : (
                <FileText className="h-8 w-8 text-muted-foreground mb-1" />
              )}
              <span className="text-xs text-muted-foreground font-medium uppercase px-2 truncate w-full text-center">
                {img.name.split('.').pop()}
              </span>
            </div>
          )}

          {/* Status overlay — Fase D: R2 uploads for video/audio/documents
              (and large images) are async, so the user needs to know a
              file is still in flight or failed before they hit send. */}
          {img.uploadStatus === 'uploading' && (
            <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] text-center py-0.5 rounded-b-xl">
              Mengunggah...
            </div>
          )}
          {img.uploadStatus === 'error' && (
            <div className="absolute inset-x-0 bottom-0 bg-red-600/80 text-white text-[10px] text-center py-0.5 rounded-b-xl truncate px-1" title={img.uploadError}>
              {img.uploadError || 'Gagal'}
            </div>
          )}

          <button
            onClick={() => onRemoveImage(img.id)}
            className={buttonClassName}
          >
            <X size={14} className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
