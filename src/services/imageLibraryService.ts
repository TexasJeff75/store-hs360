import { supabase } from './supabase';

const BUCKET = 'product-images';
const LIBRARY_PREFIX = 'library';

export interface LibraryImage {
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

class ImageLibraryService {
  private bucketReady = false;

  async ensureBucket(): Promise<{ ok: boolean; error?: string }> {
    if (this.bucketReady) return { ok: true };

    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.id === BUCKET);

    if (!exists) {
      const { error } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 10485760,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      });

      if (error) {
        return {
          ok: false,
          error: `Storage bucket "${BUCKET}" does not exist. Please create it in your Supabase Dashboard: Storage > New Bucket > name it "product-images" and enable "Public bucket".`,
        };
      }
    }

    this.bucketReady = true;
    return { ok: true };
  }

  async listImages(): Promise<LibraryImage[]> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(LIBRARY_PREFIX, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
      console.error('Error listing library images:', error);
      return [];
    }

    return (data || [])
      .filter((f) => f.name && !f.name.startsWith('.'))
      .map((f) => {
        const path = `${LIBRARY_PREFIX}/${f.name}`;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return {
          name: f.name,
          url: urlData.publicUrl,
          size: f.metadata?.size || 0,
          createdAt: f.created_at || '',
        };
      });
  }

  async uploadImages(
    files: File[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{ uploaded: string[]; errors: string[] }> {
    const uploaded: string[] = [];
    const errors: string[] = [];

    const bucketCheck = await this.ensureBucket();
    if (!bucketCheck.ok) {
      errors.push(bucketCheck.error || 'Storage bucket not available');
      return { uploaded, errors };
    }

    for (let i = 0; i < files.length; i++) {
      onProgress?.(i + 1, files.length);

      const file = files[i];
      const fileName = file.name.replace(/\s+/g, '-');
      const path = `${LIBRARY_PREFIX}/${fileName}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });

      if (error) {
        errors.push(`${file.name}: ${error.message}`);
      } else {
        uploaded.push(fileName);
      }
    }

    return { uploaded, errors };
  }

  async deleteImage(fileName: string): Promise<boolean> {
    const path = `${LIBRARY_PREFIX}/${fileName}`;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      console.error('Error deleting library image:', error);
      return false;
    }
    return true;
  }

  getPublicUrl(fileName: string): string {
    const path = `${LIBRARY_PREFIX}/${fileName}`;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  resolveImageUrl(value: string): string {
    if (!value) return '';

    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    const cleaned = value.replace(/\s+/g, '-');
    const path = `${LIBRARY_PREFIX}/${cleaned}`;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
}

export const imageLibraryService = new ImageLibraryService();
