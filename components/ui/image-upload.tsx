'use client';

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  Image as ImageIcon, 
  AlertCircle, 
  CheckCircle2, 
  Cloud,
  X
} from 'lucide-react';

export interface ImageUploadProps {
  value?: string | null;
  publicId?: string | null;
  onChange: (url: string, publicId?: string) => void;
  onRemove?: () => void;
  purpose?: 'foundation_logo' | 'post_featured_image' | 'general';
  maxSizeMB?: number;
  disabled?: boolean;
  label?: string;
  description?: string;
  aspectRatio?: 'square' | 'video' | 'auto';
  className?: string;
  previewHeight?: string;
}

export function ImageUpload({
  value,
  publicId,
  onChange,
  onRemove,
  purpose = 'general',
  maxSizeMB = 5,
  disabled = false,
  label,
  description,
  aspectRatio = 'square',
  className = '',
  previewHeight = 'h-24'
}: ImageUploadProps) {
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed limit of ${maxSizeMB}MB.`;
    }
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    if (!ALLOWED_EXTS.includes(ext) && !ALLOWED_TYPES.includes(file.type)) {
      return `Unsupported file format. Please upload JPG, PNG, WebP, or SVG.`;
    }
    return null;
  };

  const handleUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setUploading(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', purpose);

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onChange(data.secure_url, data.public_id);
        setSuccessNotice('Image uploaded to cloud storage successfully.');
        setTimeout(() => setSuccessNotice(null), 4000);
      } else {
        const errorData = await res.json().catch(() => ({ detail: 'Failed to upload image' }));
        if (res.status === 503) {
          setErrorMessage('Cloudinary service is not configured on the server. Please verify CLOUDINARY credentials in your environment.');
        } else {
          setErrorMessage(errorData.detail || 'Upload failed. Please check the image and try again.');
        }
      }
    } catch {
      setErrorMessage('Network error occurred while uploading. Please check your connection.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleRemove = () => {
    if (disabled || uploading) return;
    if (onRemove) {
      onRemove();
    } else {
      onChange('', undefined);
    }
    setErrorMessage(null);
    setSuccessNotice(null);
  };

  const getAspectRatioClass = () => {
    if (aspectRatio === 'square') return 'aspect-square max-w-[120px]';
    if (aspectRatio === 'video') return 'aspect-video max-w-[240px]';
    return 'w-auto max-w-[160px]';
  };

  return (
    <div className={`space-y-2 w-full ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-foreground">
          {label}
        </label>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={ALLOWED_EXTS.join(',')}
        disabled={disabled || uploading}
        className="hidden"
        aria-label="Upload image file"
      />

      {/* Main Upload Box / Preview Area */}
      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-card border border-border/60 shadow-xs">
        {/* Preview Frame */}
        <div 
          className={`relative rounded-xl border-2 overflow-hidden flex items-center justify-center shrink-0 transition-all ${getAspectRatioClass()} ${previewHeight} ${
            isDragOver 
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
              : 'border-dashed border-border/80 bg-black/[0.02] dark:bg-white/[0.02]'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {uploading ? (
            <div className="flex flex-col items-center justify-center p-3 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary mb-1" />
              <span className="text-[10px] font-medium text-muted-foreground animate-pulse">Uploading...</span>
            </div>
          ) : value ? (
            <div className="w-full h-full relative group flex items-center justify-center p-1">
              <img
                src={value}
                alt={label || 'Uploaded preview'}
                className="w-full h-full object-contain rounded-lg"
              />
              {publicId && (
                <div 
                  className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-medium text-white flex items-center gap-1 backdrop-blur-xs"
                  title={`Cloudinary Public ID: ${publicId}`}
                >
                  <Cloud className="w-2.5 h-2.5" />
                  <span>Cloud</span>
                </div>
              )}
            </div>
          ) : (
            <div 
              className="flex flex-col items-center justify-center p-3 text-center cursor-pointer text-muted-foreground/60 hover:text-foreground transition-colors w-full h-full"
              onClick={() => !disabled && fileInputRef.current?.click()}
            >
              <ImageIcon className="w-7 h-7 stroke-[1.5] mb-1" />
              <span className="text-[11px] font-medium">No Image</span>
            </div>
          )}
        </div>

        {/* Action Controls and Information */}
        <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
          {description && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
          {!description && (
            <p className="text-[11px] text-muted-foreground">
              Supported formats: JPEG, PNG, WebP, SVG. Maximum file size: {maxSizeMB}MB.
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 text-foreground transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Uploading...</span>
                </>
              ) : value ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Replace Image</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Image</span>
                </>
              )}
            </button>

            {value && !uploading && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="px-3 py-1.5 rounded-lg border border-destructive/20 text-destructive bg-destructive/5 text-xs font-medium hover:bg-destructive/10 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications and Feedback */}
      {errorMessage && (
        <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1 font-medium text-[11px] sm:text-xs leading-relaxed">{errorMessage}</span>
          <button 
            type="button" 
            onClick={() => setErrorMessage(null)} 
            className="text-destructive/70 hover:text-destructive cursor-pointer p-0.5"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successNotice && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="flex-1 font-medium text-[11px] sm:text-xs">{successNotice}</span>
        </div>
      )}
    </div>
  );
}
