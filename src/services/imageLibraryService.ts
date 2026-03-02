import { supabase } from './supabase';

const BUCKET = 'product-image-library';

export interface LibraryImage {
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

class ImageLibraryService {
  async listImages(): Promise<LibraryImage[]> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
      console.error('Error listing library images:', error);
      return [];
    }

    return (data || [])
      .filter((f) => f.name && !f.name.startsWith('.'))
      .map((f) => {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(f.name);
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

    for (let i = 0; i < files.length; i++) {
      onProgress?.(i + 1, files.length);

      const file = files[i];
      const fileName = file.name.toLowerCase().replace(/\s+/g, '-');

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (error) {
        errors.push(`${file.name}: ${error.message}`);
      } else {
        uploaded.push(fileName);
      }
    }

    return { uploaded, errors };
  }

  async deleteImage(fileName: string): Promise<boolean> {
    const { error } = await supabase.storage.from(BUCKET).remove([fileName]);
    if (error) {
      console.error('Error deleting library image:', error);
      return false;
    }
    return true;
  }

  getPublicUrl(fileName: string): string {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  }

  resolveImageUrl(value: string): string {
    if (!value) return '';

    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    const cleaned = value.replace(/\s+/g, '-').toLowerCase();
    return this.getPublicUrl(cleaned);
  }
}

export const imageLibraryService = new ImageLibraryService();
