import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface CapturedPhoto {
  filepath: string;
  webviewPath: string;
  base64?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CameraService {

  constructor() {}

  async takePhoto(): Promise<CapturedPhoto> {
    // Solicitar permisos y tomar foto
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 90,
      width: 1920,
      height: 1080,
      correctOrientation: true,
      saveToGallery: false
    });

    // Guardar la foto en el sistema de archivos local
    const savedPhoto = await this.savePicture(capturedPhoto);

    return savedPhoto;
  }

  async pickFromGallery(): Promise<CapturedPhoto> {
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
      quality: 90,
      width: 1920,
      height: 1080,
      correctOrientation: true
    });

    const savedPhoto = await this.savePicture(capturedPhoto);

    return savedPhoto;
  }

  private async savePicture(photo: Photo): Promise<CapturedPhoto> {
    // Convertir la foto a base64
    const base64Data = await this.readAsBase64(photo);

    // Generar nombre de archivo único
    const fileName = `geotech_${new Date().getTime()}.jpeg`;

    // Guardar el archivo
    const savedFile = await Filesystem.writeFile({
      path: `photos/${fileName}`,
      data: base64Data,
      directory: Directory.Data,
      recursive: true
    });

    return {
      filepath: savedFile.uri,
      webviewPath: photo.webPath || '',
      base64: base64Data
    };
  }

  private async readAsBase64(photo: Photo): Promise<string> {
    // Fetch la foto y convertir a blob
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();

    return await this.convertBlobToBase64(blob) as string;
  }

  private convertBlobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const result = reader.result as string;
        // Eliminar el prefijo "data:image/jpeg;base64,"
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }

  async deletePhoto(filepath: string): Promise<void> {
    try {
      await Filesystem.deleteFile({
        path: filepath,
        directory: Directory.Data
      });
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  }

  async getPhotoBase64(filepath: string): Promise<string> {
    const file = await Filesystem.readFile({
      path: filepath,
      directory: Directory.Data
    });

    return file.data as string;
  }
}
