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

export interface ProjectReportInput {
  projectName: string;
  projectLocation?: string;
  zones?: { name: string; description?: string }[];
  paths?: { name: string; description?: string }[];
  photos?: {
    description?: string;
    aiDescription?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
  }[];
  measurements?: { type: string; value: number; location?: string }[];
}

export interface GeneratedReport {
  summary: string;
  photoDescriptions: string[];
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

      if (imagePath.startsWith('data:image')) {
        // Ya es base64, extraer solo la parte de datos
        base64Data = imagePath;
      } else if (imagePath.startsWith('blob:') || imagePath.startsWith('http')) {
        // Fetch the blob/URL and convert to base64
        const response = await fetch(imagePath);
        const blob = await response.blob();
        base64Data = await this.blobToBase64(blob);
      } else {
        // Try to get base64 from camera service (for native paths)
        try {
          const rawBase64 = await this.cameraService.getPhotoBase64(imagePath);
          base64Data = `data:image/jpeg;base64,${rawBase64}`;
        } catch {
          throw new Error('NO_IMAGE_ACCESS');
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
      // Lanzar error en lugar de devolver string para que no se guarde como descripción
      if (error.message === 'NO_IMAGE_ACCESS') {
        throw new Error('No se puede acceder a la imagen');
      }
      if (error.status === 503) {
        throw new Error('IA no configurada en el servidor');
      }
      if (error.status === 0) {
        throw new Error('Sin conexión al servidor');
      }
      throw new Error(error.error?.error?.message || 'Error al analizar imagen');
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

  /**
   * Genera un informe técnico completo usando IA
   */
  async generateProjectReport(input: ProjectReportInput): Promise<GeneratedReport> {
    try {
      const prompt = this.buildReportPrompt(input);

      const response = await firstValueFrom(
        this.api.post<{ summary: string; photoDescriptions: string[] }>('/claude/generate-report', {
          prompt,
          projectData: input
        })
      );

      return response;
    } catch (error: any) {
      console.error('Error generating report:', error);
      // Si el backend falla, generar un resumen básico local
      return this.generateLocalReport(input);
    }
  }

  private buildReportPrompt(input: ProjectReportInput): string {
    let prompt = `Eres un ingeniero civil especialista en análisis de terrenos, viales, caminos rurales y obras de infraestructura.
Tu tarea es generar un informe técnico profesional de visita a campo.

PROYECTO: ${input.projectName}
UBICACIÓN: ${input.projectLocation || 'No especificada'}

`;

    if (input.zones && input.zones.length > 0) {
      prompt += `\nZONAS DE ESTUDIO IDENTIFICADAS:\n`;
      input.zones.forEach((z, i) => {
        prompt += `- ${z.name}${z.description ? ': ' + z.description : ''}\n`;
      });
    }

    if (input.paths && input.paths.length > 0) {
      prompt += `\nVIALES/CAMINOS ANALIZADOS:\n`;
      input.paths.forEach((p, i) => {
        prompt += `- ${p.name}${p.description ? ': ' + p.description : ''}\n`;
      });
    }

    if (input.photos && input.photos.length > 0) {
      prompt += `\nDOCUMENTACIÓN FOTOGRÁFICA (${input.photos.length} fotos):\n`;
      input.photos.forEach((photo, i) => {
        prompt += `Foto ${i + 1}:\n`;
        if (photo.location) prompt += `  - Ubicación: ${photo.location}\n`;
        if (photo.aiDescription) prompt += `  - Análisis: ${photo.aiDescription}\n`;
        if (photo.description) prompt += `  - Notas: ${photo.description}\n`;
      });
    }

    if (input.measurements && input.measurements.length > 0) {
      prompt += `\nMEDICIONES REALIZADAS:\n`;
      input.measurements.forEach((m, i) => {
        const unit = m.type === 'distance' ? 'm' : 'm²';
        prompt += `- ${m.type === 'distance' ? 'Distancia' : 'Área'}: ${m.value.toFixed(2)} ${unit}${m.location ? ' en ' + m.location : ''}\n`;
      });
    }

    prompt += `
INSTRUCCIONES:
1. Genera un RESUMEN EJECUTIVO (2-3 párrafos) que sintetice:
   - Estado general de los viales/caminos analizados
   - Principales observaciones técnicas
   - Recomendaciones de actuación si las hubiera

2. El resumen debe ser profesional, técnico y conciso.
3. Usa terminología de ingeniería civil.
4. Si hay problemas identificados (drenaje, anchura, estado del firme, etc.), menciónalos claramente.

Responde SOLO con el resumen, sin encabezados ni formatos adicionales.`;

    return prompt;
  }

  /**
   * Genera un informe básico cuando el backend no está disponible
   */
  private generateLocalReport(input: ProjectReportInput): GeneratedReport {
    let summary = `Informe de visita técnica al proyecto "${input.projectName}"`;

    if (input.projectLocation) {
      summary += ` ubicado en ${input.projectLocation}`;
    }
    summary += '.\n\n';

    if (input.paths && input.paths.length > 0) {
      summary += `Se han analizado ${input.paths.length} vial(es): ${input.paths.map(p => p.name).join(', ')}. `;
    }

    if (input.zones && input.zones.length > 0) {
      summary += `Se han delimitado ${input.zones.length} zona(s) de estudio: ${input.zones.map(z => z.name).join(', ')}. `;
    }

    if (input.photos && input.photos.length > 0) {
      summary += `Se ha realizado documentación fotográfica con ${input.photos.length} fotografía(s) georreferenciada(s). `;

      const photosWithAI = input.photos.filter(p => p.aiDescription);
      if (photosWithAI.length > 0) {
        summary += '\n\nObservaciones principales:\n';
        photosWithAI.slice(0, 3).forEach((p, i) => {
          summary += `- ${p.aiDescription}\n`;
        });
      }
    }

    if (input.measurements && input.measurements.length > 0) {
      const distances = input.measurements.filter(m => m.type === 'distance');
      const areas = input.measurements.filter(m => m.type === 'area');

      if (distances.length > 0 || areas.length > 0) {
        summary += '\n\nMediciones realizadas: ';
        if (distances.length > 0) {
          const totalDist = distances.reduce((sum, d) => sum + d.value, 0);
          summary += `${distances.length} mediciones de distancia (total: ${totalDist.toFixed(2)} m). `;
        }
        if (areas.length > 0) {
          const totalArea = areas.reduce((sum, a) => sum + a.value, 0);
          summary += `${areas.length} mediciones de área (total: ${totalArea.toFixed(0)} m²).`;
        }
      }
    }

    return {
      summary,
      photoDescriptions: input.photos?.map(p => p.aiDescription || p.description || '') || []
    };
  }
}
