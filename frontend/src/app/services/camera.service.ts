import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export interface CapturedPhoto {
  filepath: string;
  webviewPath: string;
  webPath?: string;
  base64?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  private fileInput: HTMLInputElement | null = null;

  constructor() {}

  async takePhoto(): Promise<CapturedPhoto> {
    if (!Capacitor.isNativePlatform()) {
      return this.takeWebPhoto();
    }

    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 90,
      width: 1920,
      height: 1080,
      correctOrientation: true,
      saveToGallery: false
    });

    const savedPhoto = await this.savePicture(capturedPhoto);
    return savedPhoto;
  }

  private takeWebPhoto(): Promise<CapturedPhoto> {
    return new Promise((resolve, reject) => {
      if (!this.fileInput) {
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*';
        this.fileInput.capture = 'environment';
      }

      this.fileInput.onchange = async (event: any) => {
        const file = event.target.files[0];
        if (!file) {
          reject(new Error('No se selecciono ninguna imagen'));
          return;
        }

        try {
          const base64 = await this.fileToBase64(file);
          const webPath = URL.createObjectURL(file);

          resolve({
            filepath: 'web_' + Date.now() + '.jpeg',
            webviewPath: webPath,
            webPath: webPath,
            base64: base64
          });
        } catch (error) {
          reject(error);
        }
      };

      this.fileInput.click();
    });
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });
  }

  async pickFromGallery(): Promise<CapturedPhoto> {
    if (!Capacitor.isNativePlatform()) {
      return this.takeWebPhoto();
    }

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
    const base64Data = await this.readAsBase64(photo);
    const fileName = 'geotech_' + new Date().getTime() + '.jpeg';

    const savedFile = await Filesystem.writeFile({
      path: 'photos/' + fileName,
      data: base64Data,
      directory: Directory.Data,
      recursive: true
    });

    return {
      filepath: savedFile.uri,
      webviewPath: photo.webPath || '',
      webPath: photo.webPath || '',
      base64: base64Data
    };
  }

  private async readAsBase64(photo: Photo): Promise<string> {
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
