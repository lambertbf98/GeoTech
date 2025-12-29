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
      // Limpiar cualquier input anterior que pueda haber quedado
      const oldInputs = document.querySelectorAll('input[data-camera-input="true"]');
      oldInputs.forEach(el => el.remove());

      // Create fresh input each time
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.capture = 'environment';
      fileInput.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;';
      fileInput.setAttribute('data-camera-input', 'true');
      document.body.appendChild(fileInput);

      let handled = false;

      const cleanup = () => {
        try {
          fileInput.removeEventListener('change', handleChange);
          fileInput.removeEventListener('cancel', handleCancel);
          if (fileInput.parentNode) {
            fileInput.remove();
          }
        } catch (e) {
          console.warn('Cleanup error:', e);
        }
      };

      // Handle file selection
      const handleChange = async () => {
        if (handled) return;
        handled = true;

        const file = fileInput.files?.[0];

        if (!file) {
          cleanup();
          reject(new Error('No se selecciono ninguna imagen'));
          return;
        }

        try {
          const base64 = await this.fileToBase64(file);
          const webPath = URL.createObjectURL(file);
          cleanup();

          resolve({
            filepath: 'web_' + Date.now() + '.jpeg',
            webviewPath: webPath,
            webPath: webPath,
            base64: base64
          });
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      // Handle cancel - usar focus como fallback
      const handleCancel = () => {
        if (handled) return;
        handled = true;
        cleanup();
        reject(new Error('Captura cancelada'));
      };

      fileInput.addEventListener('change', handleChange);
      fileInput.addEventListener('cancel', handleCancel);

      // Detectar si el usuario cancela el selector de archivos
      // Algunos navegadores no disparan 'cancel', usamos focus como fallback
      const handleFocus = () => {
        setTimeout(() => {
          if (!handled && (!fileInput.files || fileInput.files.length === 0)) {
            handled = true;
            cleanup();
            window.removeEventListener('focus', handleFocus);
            reject(new Error('Captura cancelada'));
          }
        }, 500);
      };
      window.addEventListener('focus', handleFocus);

      // Timeout de seguridad para limpiar si algo falla
      setTimeout(() => {
        if (!handled) {
          handled = true;
          cleanup();
          window.removeEventListener('focus', handleFocus);
          reject(new Error('Tiempo de espera agotado'));
        }
      }, 120000); // 2 minutos

      // Trigger the file picker inmediatamente
      console.log('Abriendo selector de archivos...');

      // Usar setTimeout para dar tiempo al DOM de actualizarse
      setTimeout(() => {
        fileInput.click();
      }, 100);
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
