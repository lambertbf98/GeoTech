import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CatastroData, CatastroLookupResponse } from '../models';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class CatastroService {
  // URL del servicio OVC del Catastro
  private readonly CATASTRO_URL = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR';

  constructor(
    private http: HttpClient,
    private api: ApiService
  ) {}

  /**
   * Consulta datos catastrales por coordenadas usando el backend
   * (Recomendado para producción - evita problemas de CORS)
   */
  lookupByCoordinates(latitude: number, longitude: number): Observable<CatastroLookupResponse> {
    return this.api.get<CatastroLookupResponse>(
      `/catastro/lookup?lat=${latitude}&lon=${longitude}`
    );
  }

  /**
   * Consulta directa al Catastro (puede tener problemas de CORS en navegador)
   * Útil para testing y cuando el backend no está disponible
   */
  lookupDirectly(latitude: number, longitude: number): Observable<CatastroLookupResponse> {
    // El Catastro usa coordenadas en sistema de referencia EPSG:4326
    // y requiere el SRS especificado
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

      // Verificar si hay error
      const error = doc.querySelector('err');
      if (error) {
        return {
          success: false,
          error: error.textContent || 'Error en la consulta'
        };
      }

      // Extraer datos
      const rc = doc.querySelector('rc');
      const ldt = doc.querySelector('ldt');

      if (!rc) {
        return {
          success: false,
          error: 'No se encontraron datos catastrales para esta ubicación'
        };
      }

      // Construir referencia catastral completa
      const pc1 = rc.querySelector('pc1')?.textContent || '';
      const pc2 = rc.querySelector('pc2')?.textContent || '';
      const car = rc.querySelector('car')?.textContent || '';
      const cc1 = rc.querySelector('cc1')?.textContent || '';
      const cc2 = rc.querySelector('cc2')?.textContent || '';

      const referenciaCatastral = `${pc1}${pc2}${car}${cc1}${cc2}`;

      // Extraer dirección
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
    // Intentar extraer el municipio de la dirección
    // El formato típico es: "CALLE NOMBRE NUM. MUNICIPIO (PROVINCIA)"
    const match = direccion.match(/\.\s*([^(]+)\s*\(/);
    return match ? match[1].trim() : '';
  }

  private extractProvincia(direccion: string): string {
    // Extraer provincia entre paréntesis
    const match = direccion.match(/\(([^)]+)\)/);
    return match ? match[1].trim() : '';
  }

  /**
   * Formatea la referencia catastral para mostrar
   */
  formatReferencia(ref: string): string {
    if (ref.length < 14) return ref;

    // Formato: XXXXX XX XXXXX XX XX
    return `${ref.slice(0, 5)} ${ref.slice(5, 7)} ${ref.slice(7, 12)} ${ref.slice(12, 14)} ${ref.slice(14)}`;
  }

  /**
   * Genera URL para ver la parcela en el visor del Catastro
   */
  getViewerUrl(referenciaCatastral: string): string {
    return `https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=${referenciaCatastral}`;
  }
}
