import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface ClaudeDescriptionResponse {
  description: string;
  photo: {
    id: string;
    aiDescription: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ClaudeService {

  constructor(private api: ApiService) {}

  async analyzeImage(imagePath: string): Promise<string> {
    // For local development, return a placeholder
    // In production, this would upload the image and get Claude's analysis
    try {
      const response = await firstValueFrom(
        this.api.post<{ description: string }>('/claude/analyze', { imagePath })
      );
      return response.description;
    } catch (error) {
      console.error('Error analyzing image:', error);
      return 'Descripcion no disponible en modo offline';
    }
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
