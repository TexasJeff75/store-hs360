import React, { useState, useRef } from 'react';
import { Upload, X, Star, Trash2, Loader, Image as ImageIcon } from 'lucide-react';
import { productImageService, ProductImage } from '@/services/productImageService';

interface ImageUploaderProps {
  productId: number | null;
  images: ProductImage[];
  onImagesChange: (images: ProductImage[]) => void;
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  productId,
  images,
  onImagesChange,
  pendingFiles = [],
  onPendingFilesChange,
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)
    );

    if (validFiles.length === 0) return;

    if (!productId) {
      onPendingFilesChange?.([...pendingFiles, ...validFiles]);
      return;
    }

    setUploading(true);
    try {
      const newImages: ProductImage[] = [];
      for (const file of validFiles) {
        const isPrimary = images.length === 0 && newImages.length === 0;
        const uploaded = await productImageService.uploadImage(file, productId, {
          isPrimary,
          altText: file.name.replace(/\.[^.]+$/, ''),
        });
        if (uploaded) newImages.push(uploaded);
      }
      onImagesChange([...images, ...newImages]);
    } catch (err) {
      console.error('Error uploading images:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleSetPrimary = async (imageId: string) => {
    if (!productId) return;
    const success = await productImageService.setPrimaryImage(imageId, productId);
    if (success) {
      const updated = images.map((img) => ({
        ...img,
        isPrimary: img.id === imageId,
      }));
      onImagesChange(updated);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!productId) return;
    const success = await productImageService.deleteImage(imageId, productId);
    if (success) {
      onImagesChange(images.filter((img) => img.id !== imageId));
    }
  };

  const removePendingFile = (index: number) => {
    const updated = pendingFiles.filter((_, i) => i !== index);
    onPendingFilesChange?.(updated);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-sm text-gray-600">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              Drop images here or click to upload
            </p>
            <p className="text-xs text-gray-500">JPG, PNG, WebP, GIF up to 5MB</p>
          </div>
        )}
      </div>

      {pendingFiles.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-700 mb-2">
            {pendingFiles.length} file(s) will be uploaded after saving the product
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {pendingFiles.map((file, idx) => (
              <div key={idx} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={() => removePendingFile(idx)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                img.isPrimary ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
              }`}
            >
              <div className="aspect-square bg-gray-100">
                <img
                  src={img.url}
                  alt={img.altText}
                  className="w-full h-full object-cover"
                />
              </div>

              {img.isPrimary && (
                <div className="absolute top-1 left-1 bg-blue-600 text-white rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center space-x-1">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  <span>Primary</span>
                </div>
              )}

              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                {!img.isPrimary && (
                  <button
                    onClick={() => handleSetPrimary(img.id)}
                    className="p-2 bg-white rounded-full hover:bg-blue-50 transition-colors"
                    title="Set as primary"
                  >
                    <Star className="h-4 w-4 text-blue-600" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(img.id)}
                  className="p-2 bg-white rounded-full hover:bg-red-50 transition-colors"
                  title="Delete image"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && pendingFiles.length === 0 && (
        <div className="text-center py-4 text-gray-400">
          <ImageIcon className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No images yet</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
