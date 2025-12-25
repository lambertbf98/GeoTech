import { parseStringPromise } from 'xml2js';
import { AppError } from '../middleware/errorHandler';

interface CatastroData {
  referenciaCatastral: string;
  direccion: string;
  superficie?: number;
  uso?: string;
  clase?: string;
  municipio?: string;
  provincia?: string;
}

export class CatastroService {
  private readonly BASE_URL = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR';

  async lookupByCoordinates(latitude: number, longitude: number): Promise<CatastroData> {
    const url = `${this.BASE_URL}?SRS=EPSG:4326&Coordenada_X=${longitude}&Coordenada_Y=${latitude}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new AppError('Error al consultar el Catastro', 502, 'CATASTRO_ERROR');
      }

      const xml = await response.text();
      const data = await this.parseResponse(xml);

      return data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Catastro lookup error:', error);
      throw new AppError('Error al consultar el Catastro', 502, 'CATASTRO_ERROR');
    }
  }

  private async parseResponse(xml: string): Promise<CatastroData> {
    try {
      const result = await parseStringPromise(xml, { explicitArray: false });

      // Navegar por la estructura XML del Catastro
      const consulta = result.consulta_coordenadas || result.Consulta_RCCOOR;

      if (!consulta) {
        throw new AppError('Respuesta inválida del Catastro', 502, 'CATASTRO_PARSE_ERROR');
      }

      // Verificar errores
      const error = consulta.lerr?.err?.des;
      if (error) {
        throw new AppError(`Catastro: ${error}`, 404, 'CATASTRO_NOT_FOUND');
      }

      const coordenadas = consulta.coordenadas?.coord;

      if (!coordenadas) {
        throw new AppError('No se encontraron datos catastrales para esta ubicación', 404, 'CATASTRO_NOT_FOUND');
      }

      // Construir referencia catastral
      const pc = coordenadas.pc;
      const pc1 = pc?.pc1 || '';
      const pc2 = pc?.pc2 || '';

      const referenciaCatastral = `${pc1}${pc2}`;

      // Dirección
      const ldt = coordenadas.ldt || '';

      // Extraer municipio y provincia de la dirección
      const municipio = this.extractMunicipio(ldt);
      const provincia = this.extractProvincia(ldt);

      return {
        referenciaCatastral,
        direccion: ldt,
        municipio,
        provincia
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error parsing Catastro XML:', error);
      throw new AppError('Error al procesar respuesta del Catastro', 502, 'CATASTRO_PARSE_ERROR');
    }
  }

  private extractMunicipio(direccion: string): string {
    // Formato típico: "CALLE NOMBRE NUM. MUNICIPIO (PROVINCIA)"
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

export const catastroService = new CatastroService();
