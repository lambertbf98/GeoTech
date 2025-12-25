import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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

  /**
   * Solicita una descripción de la imagen al backend que usa Claude API
   * @param photoId ID de la foto a describir
   * @returns Observable con la descripción generada
   */
  describePhoto(photoId: string): Observable<ClaudeDescriptionResponse> {
    return this.api.post<ClaudeDescriptionResponse>('/claude/describe', { photoId });
  }

  /**
   * Solicita una descripción con contexto adicional
   * @param photoId ID de la foto
   * @param context Contexto adicional para la descripción (tipo de obra, materiales, etc.)
   */
  describePhotoWithContext(
    photoId: string,
    context: string
  ): Observable<ClaudeDescriptionResponse> {
    return this.api.post<ClaudeDescriptionResponse>('/claude/describe', {
      photoId,
      context
    });
  }

  /**
   * Tipos de análisis predefinidos para ingeniería civil
   */
  getAnalysisTypes(): Array<{ id: string; name: string; prompt: string }> {
    return [
      {
        id: 'general',
        name: 'Descripción General',
        prompt: 'Describe esta imagen de manera técnica y profesional.'
      },
      {
        id: 'terrain',
        name: 'Análisis de Terreno',
        prompt: 'Analiza el terreno visible en esta imagen: tipo de suelo, pendiente, vegetación, posibles riesgos geológicos.'
      },
      {
        id: 'structure',
        name: 'Estado de Estructura',
        prompt: 'Evalúa el estado de la estructura visible: materiales, posibles daños, conservación general.'
      },
      {
        id: 'hydrology',
        name: 'Análisis Hidrológico',
        prompt: 'Analiza los elementos hidrológicos visibles: cauces, drenajes, posibles zonas de inundación, estado del agua.'
      },
      {
        id: 'access',
        name: 'Accesibilidad',
        prompt: 'Describe la accesibilidad de la zona: vías de acceso, estado del firme, posibles obstáculos.'
      },
      {
        id: 'environmental',
        name: 'Impacto Ambiental',
        prompt: 'Identifica elementos relevantes para un estudio de impacto ambiental: vegetación, fauna, elementos protegidos.'
      }
    ];
  }
}
