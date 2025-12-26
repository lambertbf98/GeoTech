import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CatastroData, CatastroLookupResponse } from '../models';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class CatastroService {
  // URL directa del Catastro - usar CORS proxy si es necesario
  private readonly CATASTRO_URL = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR';
  // Proxy CORS público para evitar problemas con ngrok
  private readonly CORS_PROXY = 'https://corsproxy.io/?';

  constructor(
    private http: HttpClient,
    private api: ApiService
  ) {}

  async getParcelByCoordinates(latitude: number, longitude: number): Promise<any> {
    // Usar lookupDirectly para consultar directamente la API del Catastro español
    const response = await firstValueFrom(this.lookupDirectly(latitude, longitude));
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'No se encontraron datos catastrales');
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
    );
  }

  lookupDirectly(latitude: number, longitude: number): Observable<CatastroLookupResponse> {
    const params = {
      SRS: 'EPSG:4326',
      Coordenada_X: longitude.toString(),
      Coordenada_Y: latitude.toString()
    };

    // Construir URL del catastro
    const catastroUrl = `${this.CATASTRO_URL}?SRS=${params.SRS}&Coordenada_X=${params.Coordenada_X}&Coordenada_Y=${params.Coordenada_Y}`;

    // Usar proxy CORS para evitar bloqueos
    const url = `${this.CORS_PROXY}${encodeURIComponent(catastroUrl)}`;

    return this.http.get(url, { responseType: 'text' }).pipe(
      map(xmlResponse => this.parseXmlResponse(xmlResponse)),
      catchError(error => {
        console.error('Error consultando Catastro:', error);
        return of({
          success: false,
          error: 'Error al consultar el Catastro. Verifica tu conexion.'
        });
      })
    );
  }

  private parseXmlResponse(xml: string): CatastroLookupResponse {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      // Check for errors
      const cuerr = doc.querySelector('cuerr');
      if (cuerr && cuerr.textContent !== '0') {
        const errMsg = doc.querySelector('des')?.textContent || 'Error en la consulta';
        return { success: false, error: errMsg };
      }

      // The structure is: coordenadas > coord > pc > pc1, pc2
      const coord = doc.querySelector('coord');
      const pc = coord?.querySelector('pc');
      const ldt = coord?.querySelector('ldt');

      if (!pc) {
        return {
          success: false,
          error: 'No se encontraron datos catastrales para esta ubicacion'
        };
      }

      const pc1 = pc.querySelector('pc1')?.textContent || '';
      const pc2 = pc.querySelector('pc2')?.textContent || '';

      // La referencia catastral completa es pc1 + pc2
      const referenciaCatastral = `${pc1}${pc2}`;
      const direccion = ldt?.textContent || '';

      return {
        success: true,
        data: {
          referenciaCatastral,
          direccion,
          municipio: this.extractMunicipio(direccion),
          provincia: this.extractProvincia(direccion)
        }
      };
    } catch (error) {
      console.error('Error parsing XML:', error);
      return {
        success: false,
        error: 'Error al procesar la respuesta del Catastro'
      };
    }
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
