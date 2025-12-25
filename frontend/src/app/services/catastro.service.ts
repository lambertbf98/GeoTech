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
  private readonly CATASTRO_URL = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR';

  constructor(
    private http: HttpClient,
    private api: ApiService
  ) {}

  async getParcelByCoordinates(latitude: number, longitude: number): Promise<any> {
    const response = await firstValueFrom(this.lookupByCoordinates(latitude, longitude));
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

    const url = `${this.CATASTRO_URL}?SRS=${params.SRS}&Coordenada_X=${params.Coordenada_X}&Coordenada_Y=${params.Coordenada_Y}`;

    return this.http.get(url, { responseType: 'text' }).pipe(
      map(xmlResponse => this.parseXmlResponse(xmlResponse)),
      catchError(error => {
        console.error('Error consultando Catastro:', error);
        return of({
          success: false,
          error: 'Error al consultar el Catastro'
        });
      })
    );
  }

  private parseXmlResponse(xml: string): CatastroLookupResponse {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      const error = doc.querySelector('err');
      if (error) {
        return {
          success: false,
          error: error.textContent || 'Error en la consulta'
        };
      }

      const rc = doc.querySelector('rc');
      const ldt = doc.querySelector('ldt');

      if (!rc) {
        return {
          success: false,
          error: 'No se encontraron datos catastrales para esta ubicacion'
        };
      }

      const pc1 = rc.querySelector('pc1')?.textContent || '';
      const pc2 = rc.querySelector('pc2')?.textContent || '';
      const car = rc.querySelector('car')?.textContent || '';
      const cc1 = rc.querySelector('cc1')?.textContent || '';
      const cc2 = rc.querySelector('cc2')?.textContent || '';

      const referenciaCatastral = `${pc1}${pc2}${car}${cc1}${cc2}`;
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
