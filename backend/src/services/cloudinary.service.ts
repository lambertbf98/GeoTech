// @ts-nocheck
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export interface UploadResult {
  url: string;
  publicId: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

export class CloudinaryService {
  /**
   * Sube una imagen en base64 a Cloudinary
   */
  async uploadImage(base64Image: string, folder: string = 'geotech'): Promise<UploadResult> {
    try {
      // Asegurar que tenga el prefijo correcto
      let imageData = base64Image;
      if (!imageData.startsWith('data:')) {
        imageData = `data:image/jpeg;base64,${imageData}`;
      }

      const result = await cloudinary.uploader.upload(imageData, {
        folder,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      });

      // Generar URL de thumbnail
      const thumbnailUrl = cloudinary.url(result.public_id, {
        width: 200,
        height: 200,
        crop: 'fill',
        quality: 'auto:low',
        fetch_format: 'auto'
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        thumbnailUrl,
        width: result.width,
        height: result.height
      };
    } catch (error: any) {
      console.error('Error uploading to Cloudinary:', error?.message || error);
      throw new Error('Error al subir imagen: ' + (error?.message || 'desconocido'));
    }
  }

  /**
   * Elimina una imagen de Cloudinary
   */
  async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (error: any) {
      console.error('Error deleting from Cloudinary:', error?.message || error);
      return false;
    }
  }

  /**
   * Genera URL optimizada para una imagen
   */
  getOptimizedUrl(publicId: string, options?: { width?: number; height?: number }): string {
    return cloudinary.url(publicId, {
      width: options?.width,
      height: options?.height,
      crop: options?.width || options?.height ? 'fill' : undefined,
      quality: 'auto',
      fetch_format: 'auto'
    });
  }

  /**
   * Verifica si Cloudinary está configurado
   */
  isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }
}

export const cloudinaryService = new CloudinaryService();
