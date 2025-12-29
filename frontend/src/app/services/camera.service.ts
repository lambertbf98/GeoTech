import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { ToastController } from '@ionic/angular';

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
  // Flag para debug visual
  private debugMode = true;

  constructor(private toastCtrl: ToastController) {}

  private async debugToast(message: string) {
    if (!this.debugMode) return;
    const toast = await this.toastCtrl.create({
      message: `[CAM] ${message}`,
      duration: 1500,
      position: 'bottom',
      color: 'dark'
    });
    await toast.present();
  }

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
    return new Promise(async (resolve, reject) => {
      await this.debugToast('Iniciando cámara web...');

      // Limpiar cualquier input anterior que pueda haber quedado
      const oldInputs = document.querySelectorAll('input[data-camera-input="true"]');
      oldInputs.forEach(el => el.remove());

      // Create fresh input each time
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.capture = 'environment';
      fileInput.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;';
      fileInput.setAttribute('data-camera-input', 'true');
      document.body.appendChild(fileInput);

      let handled = false;

      const cleanup = () => {
        try {
          if (fileInput.parentNode) {
            fileInput.remove();
          }
        } catch (e) {
          // Ignorar errores de cleanup
        }
      };

      // Handle file selection
      const handleChange = async (event: Event) => {
        await this.debugToast('Evento change detectado');

        if (handled) {
          return;
        }
        handled = true;

        const files = fileInput.files;
        await this.debugToast(`Archivos: ${files?.length || 0}`);

        const file = files?.[0];

        if (!file) {
          await this.debugToast('Sin archivo seleccionado');
          cleanup();
          reject(new Error('No se selecciono ninguna imagen'));
          return;
        }

        await this.debugToast(`Archivo: ${file.name} (${Math.round(file.size/1024)}KB)`);

        try {
          await this.debugToast('Convirtiendo a base64...');
          const base64 = await this.fileToBase64(file);
          await this.debugToast(`Base64: ${base64?.length || 0} chars`);

          const webPath = URL.createObjectURL(file);

          cleanup();

          const result = {
            filepath: 'web_' + Date.now() + '.jpeg',
            webviewPath: webPath,
            webPath: webPath,
            base64: base64
          };
          await this.debugToast('Foto lista!');
          resolve(result);
        } catch (error: any) {
          await this.debugToast(`Error: ${error.message}`);
          cleanup();
          reject(error);
        }
      };

      // Handle cancel
      const handleCancel = async () => {
        await this.debugToast('Cancelado por usuario');
        if (handled) return;
        handled = true;
        cleanup();
        reject(new Error('Captura cancelada'));
      };

      // Usar evento 'input' además de 'change' para mayor compatibilidad
      fileInput.addEventListener('change', handleChange);
      fileInput.addEventListener('input', handleChange);
      fileInput.addEventListener('cancel', handleCancel);

      await this.debugToast('Esperando selección...');

      // Timeout de seguridad
      setTimeout(async () => {
        if (!handled) {
          await this.debugToast('Timeout - sin respuesta');
          handled = true;
          cleanup();
          reject(new Error('Tiempo de espera agotado'));
        }
      }, 180000); // 3 minutos

      // Trigger the file picker
      setTimeout(() => {
        fileInput.click();
      }, 50);
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
