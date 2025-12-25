import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { CameraService } from './camera.service';

export interface ClaudeDescriptionResponse {
  description: string;
  photo?: {
    id: string;
    aiDescription: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ClaudeService {

  constructor(
    private api: ApiService,
    private cameraService: CameraService
  ) {}

  async analyzeImage(imagePath: string): Promise<string> {
    try {
      // Convert image to base64
      let base64Data: string;
      
      if (imagePath.startsWith('blob:') || imagePath.startsWith('http')) {
        // Fetch the blob/URL and convert to base64
        const response = await fetch(imagePath);
        const blob = await response.blob();
        base64Data = await this.blobToBase64(blob);
      } else {
        // Try to get base64 from camera service (for native paths)
        try {
          base64Data = await this.cameraService.getPhotoBase64(imagePath);
        } catch {
          throw new Error('No se puede acceder a la imagen');
        }
      }

      // Send base64 to backend
      const response = await firstValueFrom(
        this.api.post<{ description: string }>('/claude/analyze', { 
          imageBase64: base64Data 
        })
      );
      return response.description;
    } catch (error: any) {
      console.error('Error analyzing image:', error);
      // Return more specific error message
      if (error.status === 503) {
        return 'IA no configurada en el servidor';
      }
      if (error.status === 0) {
        return 'Error de conexion con el servidor';
      }
      return error.error?.error?.message || 'Error al analizar imagen';
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  }

  describePhoto(photoId: string): Observable<ClaudeDescriptionResponse> {
    return this.api.post<ClaudeDescriptionResponse>('/claude/describe', { photoId });
  }

  describePhotoWithContext(
    photoId: string,
    context: string
  ): Observable<ClaudeDescriptionResponse> {
    return this.api.post<ClaudeDescriptionResponse>('/claude/describe', {
      photoId,
      context
    });
  }

  getAnalysisTypes(): Array<{ id: string; name: string; prompt: string }> {
    return [
      {
        id: 'general',
        name: 'Descripcion General',
        prompt: 'Describe esta imagen de manera tecnica y profesional.'
      },
      {
        id: 'terrain',
        name: 'Analisis de Terreno',
        prompt: 'Analiza el terreno visible en esta imagen: tipo de suelo, pendiente, vegetacion, posibles riesgos geologicos.'
      },
      {
        id: 'structure',
        name: 'Estado de Estructura',
        prompt: 'Evalua el estado de la estructura visible: materiales, posibles danos, conservacion general.'
      },
      {
        id: 'hydrology',
        name: 'Analisis Hidrologico',
        prompt: 'Analiza los elementos hidrologicos visibles: cauces, drenajes, posibles zonas de inundacion, estado del agua.'
      },
      {
        id: 'access',
        name: 'Accesibilidad',
        prompt: 'Describe la accesibilidad de la zona: vias de acceso, estado del firme, posibles obstaculos.'
      },
      {
        id: 'environmental',
        name: 'Impacto Ambiental',
        prompt: 'Identifica elementos relevantes para un estudio de impacto ambiental: vegetacion, fauna, elementos protegidos.'
      }
    ];
  }
}
