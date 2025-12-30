import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, firstValueFrom } from 'rxjs';
import { map, catchError, timeout, retry } from 'rxjs/operators';
import { CatastroData, CatastroLookupResponse } from '../models';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class CatastroService {
  // URL directa del Catastro
  private readonly CATASTRO_URL = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR';

  constructor(
    private http: HttpClient,
    private api: ApiService
  ) {}

  async getParcelByCoordinates(latitude: number, longitude: number): Promise<any> {
    // Intentar primero con el backend (que no tiene problemas de CORS)
    try {
      const response = await firstValueFrom(
        this.api.get<any>(`/catastro/lookup?lat=${latitude}&lon=${longitude}`).pipe(
          timeout(10000),
          retry(1)
        )
      );
      if (response.success && response.catastro) {
        return response.catastro;
      }
      throw new Error('No se encontraron datos catastrales');
    } catch (error: any) {
      console.warn('Backend catastro failed:', error?.message || error);
      // No usar fallback externo que falla con 403
      // Simplemente lanzar error con mensaje amigable
      throw new Error('Catastro no disponible. Intenta de nuevo más tarde.');
    }
  }

  async getParcelByReference(ref: string): Promise<any> {
    // For now, return mock data - implement backend endpoint later
    return {
      referenciaCatastral: ref,
      direccion: 'Direccion no disponible',
      municipio: '',
      provincia: ''
    };
  }

  lookupByCoordinates(latitude: number, longitude: number): Observable<CatastroLookupResponse> {
    return this.api.get<CatastroLookupResponse>(
      `/catastro/lookup?lat=${latitude}&lon=${longitude}`
    ).pipe(
      timeout(10000),
      catchError(error => {
        console.error('Error consultando Catastro:', error);
        return of({
          success: false,
          error: 'Catastro no disponible'
        });
      })
    );
  }

  private extractMunicipio(direccion: string): string {
    const match = direccion.match(/\.\s*([^(]+)\s*\(/);
    return match ? match[1].trim() : '';
  }

  private extractProvincia(direccion: string): string {
    const match = direccion.match(/\(([^)]+)\)/);
    return match ? match[1].trim() : '';
  }

  formatReferencia(ref: string): string {
    if (ref.length < 14) return ref;
    return `${ref.slice(0, 5)} ${ref.slice(5, 7)} ${ref.slice(7, 12)} ${ref.slice(12, 14)} ${ref.slice(14)}`;
  }

  getViewerUrl(referenciaCatastral: string): string {
    return `https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=${referenciaCatastral}`;
  }
}
