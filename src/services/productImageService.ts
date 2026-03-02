import { supabase } from './supabase';
import { imageLibraryService } from './imageLibraryService';

const BUCKET = 'product-images-library';

export interface ProductImage {
  id: string;
  productId: number;
  url: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
}

class ProductImageService {
  async uploadImage(
    file: File,
    productId: number,
    options?: { altText?: string; isPrimary?: boolean }
  ): Promise<ProductImage | null> {
    const bucketCheck = await imageLibraryService.ensureBucket();
    if (!bucketCheck.ok) {
      throw new Error(bucketCheck.error || 'Storage bucket not available');
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const path = `${productId}/${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      throw new Error(uploadError.message);
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    if (options?.isPrimary) {
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId);
    }

    const { data: existing } = await supabase
      .from('product_images')
      .select('sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        image_url: publicUrl,
        alt_text: options?.altText || '',
        sort_order: nextOrder,
        is_primary: options?.isPrimary ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving image record:', error);
      throw new Error(error.message);
    }

    if (options?.isPrimary) {
      await supabase
        .from('products')
        .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', productId);
    }

    return {
      id: data.id,
      productId: data.product_id,
      url: data.image_url,
      altText: data.alt_text,
      sortOrder: data.sort_order,
      isPrimary: data.is_primary,
    };
  }

  async getImages(productId: number): Promise<ProductImage[]> {
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching product images:', error);
      return [];
    }

    return (data || []).map((img: any) => ({
      id: img.id,
      productId: img.product_id,
      url: img.image_url,
      altText: img.alt_text || '',
      sortOrder: img.sort_order,
      isPrimary: img.is_primary,
    }));
  }

  async setPrimaryImage(imageId: string, productId: number): Promise<boolean> {
    await supabase
      .from('product_images')
      .update({ is_primary: false })
      .eq('product_id', productId);

    const { error } = await supabase
      .from('product_images')
      .update({ is_primary: true })
      .eq('id', imageId);

    if (error) {
      console.error('Error setting primary image:', error);
      return false;
    }

    const { data: img } = await supabase
      .from('product_images')
      .select('image_url')
      .eq('id', imageId)
      .maybeSingle();

    if (img) {
      await supabase
        .from('products')
        .update({ image_url: img.image_url, updated_at: new Date().toISOString() })
        .eq('id', productId);
    }

    return true;
  }

  async deleteImage(imageId: string, productId: number): Promise<boolean> {
    const { data: img } = await supabase
      .from('product_images')
      .select('image_url, is_primary')
      .eq('id', imageId)
      .maybeSingle();

    if (!img) return false;

    const url = img.image_url;
    const bucketUrl = supabase.storage.from(BUCKET).getPublicUrl('').data.publicUrl;
    if (url.startsWith(bucketUrl)) {
      const path = url.replace(bucketUrl + '/', '');
      await supabase.storage.from(BUCKET).remove([path]);
    }

    const { error } = await supabase.from('product_images').delete().eq('id', imageId);
    if (error) {
      console.error('Error deleting image record:', error);
      return false;
    }

    if (img.is_primary) {
      const { data: remaining } = await supabase
        .from('product_images')
        .select('id, image_url')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })
        .limit(1);

      if (remaining && remaining.length > 0) {
        await this.setPrimaryImage(remaining[0].id, productId);
      } else {
        await supabase
          .from('products')
          .update({ image_url: '', updated_at: new Date().toISOString() })
          .eq('id', productId);
      }
    }

    return true;
  }

  async reorderImages(
    productId: number,
    imageIds: string[]
  ): Promise<boolean> {
    for (let i = 0; i < imageIds.length; i++) {
      const { error } = await supabase
        .from('product_images')
        .update({ sort_order: i })
        .eq('id', imageIds[i]);

      if (error) {
        console.error('Error reordering images:', error);
        return false;
      }
    }
    return true;
  }
}

export const productImageService = new ProductImageService();
