import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Trash2, Loader, ImageIcon, Copy, Check, Search, FolderOpen } from 'lucide-react';
import { imageLibraryService, LibraryImage } from '@/services/imageLibraryService';

interface ImageLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImageLibrary: React.FC<ImageLibraryProps> = ({ isOpen, onClose }) => {
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    const result = await imageLibraryService.listImages();
    setImages(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [isOpen, fetchImages]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)
    );

    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadErrors([]);
    const { uploaded, errors } = await imageLibraryService.uploadImages(
      validFiles,
      (current, total) => setUploadProgress({ current, total })
    );

    if (errors.length > 0) {
      setUploadErrors(errors);
    }

    if (uploaded.length > 0) {
      await fetchImages();
    }

    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDelete = async (fileName: string) => {
    setDeletingImage(fileName);
    const success = await imageLibraryService.deleteImage(fileName);
    if (success) {
      setImages((prev) => prev.filter((img) => img.name !== fileName));
    }
    setDeletingImage(null);
  };

  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const filteredImages = images.filter((img) =>
    img.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Image Library</h2>
              <p className="text-xs text-gray-500">
                Upload images here, then reference their filename in your CSV import
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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
                <p className="text-sm text-gray-600">
                  Uploading... {uploadProgress.current} / {uploadProgress.total}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <Upload className="h-8 w-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">
                  Drop images here or click to upload
                </p>
                <p className="text-xs text-gray-500">
                  JPG, PNG, WebP, GIF -- filenames become the reference for CSV imports
                </p>
              </div>
            )}
          </div>

          {uploadErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 mb-1">Upload Errors</p>
              <ul className="text-sm text-red-700 space-y-1">
                {uploadErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
              <p className="text-xs text-red-600 mt-2">
                Make sure the "product-images" storage bucket exists in your Supabase project and is set to public.
              </p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">How it works:</span> Upload your product images here. Then in your CSV import,
              put the filename (e.g. <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">my-product.jpg</code>)
              in the <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">image_url</code> column.
              The system will automatically match it to the uploaded image.
            </p>
          </div>

          {!loading && images.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search images..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ImageIcon className="h-12 w-12 mx-auto mb-3" />
              <p className="text-sm font-medium">
                {searchTerm ? 'No images match your search' : 'No images uploaded yet'}
              </p>
              <p className="text-xs mt-1">
                {searchTerm ? 'Try a different search term' : 'Upload images above to get started'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredImages.map((img) => (
                <div
                  key={img.name}
                  className="group relative border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="aspect-square bg-gray-100">
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyName(img.name);
                      }}
                      className="p-2 bg-white rounded-full hover:bg-blue-50 transition-colors"
                      title="Copy filename"
                    >
                      {copiedName === img.name ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(img.name);
                      }}
                      disabled={deletingImage === img.name}
                      className="p-2 bg-white rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Delete image"
                    >
                      {deletingImage === img.name ? (
                        <Loader className="h-4 w-4 text-gray-400 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-600" />
                      )}
                    </button>
                  </div>

                  <div className="p-2 bg-white border-t border-gray-100">
                    <p
                      className="text-xs font-mono text-gray-700 truncate"
                      title={img.name}
                    >
                      {img.name}
                    </p>
                    <p className="text-[10px] text-gray-400">{formatSize(img.size)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && images.length > 0 && (
            <p className="text-xs text-gray-500 text-center">
              {images.length} image{images.length !== 1 ? 's' : ''} in library
            </p>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageLibrary;
