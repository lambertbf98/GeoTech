import { Injectable } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import JSZip from 'jszip';

export interface KmlPlacemark {
  name: string;
  description?: string;
  type: 'point' | 'polygon' | 'line';
  coordinates: { lat: number; lng: number; alt?: number }[];
  imageUrl?: string;
  style?: {
    color?: string;
    width?: number;
    fillColor?: string;
    fillOpacity?: number;
  };
}

export interface KmlDocument {
  name: string;
  placemarks: KmlPlacemark[];
  images: Map<string, string>; // filename -> base64
}

export interface ProjectExportData {
  name: string;
  description?: string;
  location?: string;
  createdAt: string;
  photos: {
    id: string;
    url: string;
    base64?: string;
    description?: string;
    aiDescription?: string;
    latitude?: number;
    longitude?: number;
    timestamp?: string;
  }[];
  zones?: {
    name: string;
    description?: string;
    coordinates: { lat: number; lng: number }[];
  }[];
  paths?: {
    name: string;
    description?: string;
    coordinates: { lat: number; lng: number }[];
  }[];
  markers?: {
    name: string;
    description?: string;
    aiDescription?: string;
    coordinate: { lat: number; lng: number };
    photos?: {
      id: string;
      base64?: string;
      notes?: string;
      aiDescription?: string;
    }[];
  }[];
  measurements?: {
    type: 'distance' | 'area';
    value: number;
    points: { lat: number; lng: number }[];
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class KmlService {

  constructor() {}

  /**
   * Parse a KML string and extract placemarks
   */
  parseKml(kmlString: string): KmlDocument {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlString, 'text/xml');

    const documentName = doc.querySelector('Document > name')?.textContent || 'Sin nombre';
    const placemarks: KmlPlacemark[] = [];
    const images = new Map<string, string>();

    // Parse all Placemarks
    const placemarkElements = doc.querySelectorAll('Placemark');
    placemarkElements.forEach(pm => {
      const placemark = this.parsePlacemark(pm);
      if (placemark) {
        placemarks.push(placemark);
      }
    });

    return { name: documentName, placemarks, images };
  }

  /**
   * Parse a KMZ file (ZIP containing KML and images)
   */
  async parseKmz(kmzData: ArrayBuffer): Promise<KmlDocument> {
    const zip = await JSZip.loadAsync(kmzData);

    // Find the KML file
    let kmlContent = '';
    const images = new Map<string, string>();

    for (const [filename, file] of Object.entries(zip.files)) {
      if (filename.endsWith('.kml')) {
        kmlContent = await (file as JSZip.JSZipObject).async('string');
      } else if (this.isImageFile(filename)) {
        const base64 = await (file as JSZip.JSZipObject).async('base64');
        const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = this.getMimeType(ext);
        images.set(filename, `data:${mimeType};base64,${base64}`);
      }
    }

    if (!kmlContent) {
      throw new Error('No se encontró archivo KML en el KMZ');
    }

    const kmlDoc = this.parseKml(kmlContent);
    kmlDoc.images = images;

    // Replace image references with base64 data
    kmlDoc.placemarks.forEach(pm => {
      if (pm.imageUrl && !pm.imageUrl.startsWith('data:')) {
        const imagePath = pm.imageUrl.replace(/^files\//, '');
        for (const [filename, base64] of images) {
          if (filename.includes(imagePath) || filename.endsWith(imagePath)) {
            pm.imageUrl = base64;
            break;
          }
        }
      }
    });

    return kmlDoc;
  }

  /**
   * Generate KML string from project data
   */
  generateKml(data: ProjectExportData): string {
    const timestamp = new Date().toISOString();

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document>
  <name>${this.escapeXml(data.name)}</name>
  <description>Generado por GeoTech el ${new Date().toLocaleDateString('es-ES')}</description>

  <!-- Estilos -->
  <Style id="photoStyle">
    <IconStyle>
      <scale>1.2</scale>
      <Icon>
        <href>http://maps.google.com/mapfiles/kml/shapes/camera.png</href>
      </Icon>
    </IconStyle>
  </Style>
  <Style id="zoneStyle">
    <LineStyle>
      <color>ff0000ff</color>
      <width>3</width>
    </LineStyle>
    <PolyStyle>
      <color>400000ff</color>
    </PolyStyle>
  </Style>
  <Style id="pathStyle">
    <LineStyle>
      <color>ff00aaff</color>
      <width>3</width>
    </LineStyle>
  </Style>
  <Style id="measureStyle">
    <LineStyle>
      <color>ff00ff00</color>
      <width>2</width>
    </LineStyle>
    <PolyStyle>
      <color>4000ff00</color>
    </PolyStyle>
  </Style>
  <Style id="markerStyle">
    <IconStyle>
      <scale>1.2</scale>
      <Icon>
        <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
      </Icon>
    </IconStyle>
    <LabelStyle>
      <scale>0.9</scale>
    </LabelStyle>
  </Style>

  <Folder>
    <name>${this.escapeXml(data.name)}</name>
    <open>1</open>
`;

    // Add photos as placemarks
    if (data.photos && data.photos.length > 0) {
      kml += `    <Folder>
      <name>Fotos</name>
`;
      data.photos.forEach((photo, index) => {
        if (photo.latitude && photo.longitude) {
          const photoName = `Foto ${index + 1}`;

          // Build rich description with image, notes and AI description
          let descriptionHtml = '';

          // Incrustar imagen como data URL directamente en el HTML
          if (photo.base64) {
            let imgSrc = photo.base64;
            // Si no tiene prefijo data:, añadirlo
            if (!imgSrc.startsWith('data:') && !imgSrc.startsWith('http')) {
              imgSrc = `data:image/jpeg;base64,${imgSrc}`;
            }
            descriptionHtml += `<img style="max-width:500px;max-height:400px;border-radius:8px;" src="${imgSrc}"/><br/>`;
          }

          // Notes
          if (photo.description) {
            descriptionHtml += `<p style="background:rgba(16,185,129,0.25);padding:10px;border-radius:6px;margin:8px 0;border-left:3px solid #10b981;color:#a7f3d0;">
              <strong style="color:#34d399;">Notas:</strong><br/>${this.escapeXml(photo.description)}
            </p>`;
          }

          // AI Description
          if (photo.aiDescription) {
            descriptionHtml += `<p style="background:rgba(245,158,11,0.2);padding:10px;border-radius:6px;margin:8px 0;border-left:3px solid #f59e0b;color:#fde68a;">
              <strong style="color:#fbbf24;">Analisis IA:</strong><br/>${this.escapeXml(photo.aiDescription)}
            </p>`;
          }

          kml += `      <Placemark>
        <name>${this.escapeXml(photoName)}</name>
        <description><![CDATA[${descriptionHtml}]]></description>
        <styleUrl>#photoStyle</styleUrl>
        <Point>
          <coordinates>${photo.longitude},${photo.latitude},0</coordinates>
        </Point>
      </Placemark>
`;
        }
      });
      kml += `    </Folder>
`;
    }

    // Add zones as polygons
    if (data.zones && data.zones.length > 0) {
      kml += `    <Folder>
      <name>Zonas de estudio</name>
`;
      data.zones.forEach((zone, index) => {
        const coords = zone.coordinates.map(c => `${c.lng},${c.lat},0`).join(' ');
        // Close the polygon
        const firstCoord = zone.coordinates[0];
        const closedCoords = `${coords} ${firstCoord.lng},${firstCoord.lat},0`;

        kml += `      <Placemark>
        <name>${this.escapeXml(zone.name || `Zona ${index + 1}`)}</name>
        <styleUrl>#zoneStyle</styleUrl>
        <Polygon>
          <tessellate>1</tessellate>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${closedCoords}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
`;
      });
      kml += `    </Folder>
`;
    }

    // Add paths as lines
    if (data.paths && data.paths.length > 0) {
      kml += `    <Folder>
      <name>Viales</name>
`;
      data.paths.forEach((path, index) => {
        const coords = path.coordinates.map(c => `${c.lng},${c.lat},0`).join(' ');

        kml += `      <Placemark>
        <name>${this.escapeXml(path.name || `Vial ${index + 1}`)}</name>
        <styleUrl>#pathStyle</styleUrl>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${coords}</coordinates>
        </LineString>
      </Placemark>
`;
      });
      kml += `    </Folder>
`;
    }

    // Add markers as points
    if (data.markers && data.markers.length > 0) {
      kml += `    <Folder>
      <name>Puntos de interés</name>
`;
      data.markers.forEach((marker, index) => {
        // Build rich description with photos, notes and AI descriptions
        let descriptionHtml = '';

        // Marker description
        if (marker.description) {
          descriptionHtml += `<p><strong>Descripcion:</strong> ${this.escapeXml(marker.description)}</p>`;
        }

        // AI description at marker level - dark theme
        if (marker.aiDescription) {
          descriptionHtml += `<div style="background:rgba(245,158,11,0.2);padding:10px;border-radius:6px;margin:8px 0;border-left:3px solid #f59e0b;color:#fde68a;">
            <strong style="color:#fbbf24;">Analisis IA:</strong><br/>${this.escapeXml(marker.aiDescription)}
          </div>`;
        }

        // Photos with their notes and AI descriptions
        if (marker.photos && marker.photos.length > 0) {
          descriptionHtml += `<hr/><h4>Fotos (${marker.photos.length}):</h4>`;
          marker.photos.forEach((photo, photoIndex) => {
            descriptionHtml += `<div style="margin:10px 0;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:10px;">`;

            // Photo image - handle both URLs and base64
            if (photo.base64) {
              let imgSrc = photo.base64;
              // Check if it's a URL (http/https or blob)
              if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://') || imgSrc.startsWith('blob:')) {
                // It's a URL, use directly
                descriptionHtml += `<img src="${imgSrc}" style="max-width:400px;max-height:300px;border-radius:4px;"/><br/>`;
              } else if (imgSrc.startsWith('data:')) {
                // It's already a data URL
                descriptionHtml += `<img src="${imgSrc}" style="max-width:400px;max-height:300px;border-radius:4px;"/><br/>`;
              } else {
                // Assume it's raw base64
                descriptionHtml += `<img src="data:image/jpeg;base64,${imgSrc}" style="max-width:400px;max-height:300px;border-radius:4px;"/><br/>`;
              }
            }

            // Photo notes - dark theme
            if (photo.notes) {
              descriptionHtml += `<p style="background:rgba(16,185,129,0.25);padding:10px;border-radius:6px;margin:8px 0;border-left:3px solid #10b981;color:#a7f3d0;">
                <strong style="color:#34d399;">Notas:</strong><br/>${this.escapeXml(photo.notes)}
              </p>`;
            }

            // Photo AI description - dark theme
            if (photo.aiDescription) {
              descriptionHtml += `<p style="background:rgba(245,158,11,0.2);padding:10px;border-radius:6px;margin:8px 0;border-left:3px solid #f59e0b;color:#fde68a;">
                <strong style="color:#fbbf24;">Analisis IA:</strong><br/>${this.escapeXml(photo.aiDescription)}
              </p>`;
            }

            descriptionHtml += `</div>`;
          });
        }

        kml += `      <Placemark>
        <name>${this.escapeXml(marker.name || `Punto ${index + 1}`)}</name>
        <description><![CDATA[${descriptionHtml}]]></description>
        <styleUrl>#markerStyle</styleUrl>
        <Point>
          <coordinates>${marker.coordinate.lng},${marker.coordinate.lat},0</coordinates>
        </Point>
      </Placemark>
`;
      });
      kml += `    </Folder>
`;
    }

    // Add measurements
    if (data.measurements && data.measurements.length > 0) {
      kml += `    <Folder>
      <name>Mediciones</name>
`;
      data.measurements.forEach((m, index) => {
        const coords = m.points.map(p => `${p.lng},${p.lat},0`).join(' ');
        const valueStr = m.type === 'distance'
          ? `${m.value.toFixed(2)} m`
          : `${m.value.toFixed(0)} m²`;

        if (m.type === 'distance') {
          kml += `      <Placemark>
        <name>Distancia ${index + 1}: ${valueStr}</name>
        <styleUrl>#measureStyle</styleUrl>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${coords}</coordinates>
        </LineString>
      </Placemark>
`;
        } else {
          const firstCoord = m.points[0];
          const closedCoords = `${coords} ${firstCoord.lng},${firstCoord.lat},0`;
          kml += `      <Placemark>
        <name>Área ${index + 1}: ${valueStr}</name>
        <styleUrl>#measureStyle</styleUrl>
        <Polygon>
          <tessellate>1</tessellate>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${closedCoords}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
`;
        }
      });
      kml += `    </Folder>
`;
    }

    kml += `  </Folder>
</Document>
</kml>`;

    return kml;
  }

  /**
   * Generate KMZ file (ZIP with KML and images)
   */
  async generateKmz(data: ProjectExportData): Promise<Blob> {
    const zip = new JSZip();

    // Generate KML
    const kml = this.generateKml(data);
    zip.file('doc.kml', kml);

    // Add images
    const filesFolder = zip.folder('files');
    if (filesFolder && data.photos) {
      for (const photo of data.photos) {
        if (photo.base64 && photo.latitude && photo.longitude) {
          // Remove data URL prefix if present
          let base64Data = photo.base64;
          if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
          }
          filesFolder.file(`${photo.id}.jpg`, base64Data, { base64: true });
        }
      }
    }

    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  /**
   * Read a KML/KMZ file from a File object
   */
  async readFile(file: File): Promise<KmlDocument> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'kmz') {
      const buffer = await file.arrayBuffer();
      return this.parseKmz(buffer);
    } else if (extension === 'kml') {
      const text = await file.text();
      return this.parseKml(text);
    } else {
      throw new Error('Formato no soportado. Use archivos KML o KMZ.');
    }
  }

  /**
   * Download KMZ file
   */
  async downloadKmz(data: ProjectExportData, filename: string): Promise<void> {
    const blob = await this.generateKmz(data);

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.kmz') ? filename : `${filename}.kmz`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Save KMZ to device filesystem (for mobile)
   */
  async saveKmzToDevice(data: ProjectExportData, filename: string): Promise<string> {
    const blob = await this.generateKmz(data);
    const base64 = await this.blobToBase64(blob);

    const result = await Filesystem.writeFile({
      path: filename.endsWith('.kmz') ? filename : `${filename}.kmz`,
      data: base64.split(',')[1],
      directory: Directory.Documents
    });

    return result.uri;
  }

  // ==================== Private Methods ====================

  private parsePlacemark(element: Element): KmlPlacemark | null {
    const name = element.querySelector('name')?.textContent || 'Sin nombre';
    const descriptionEl = element.querySelector('description');
    let description = descriptionEl?.textContent || '';
    let imageUrl: string | undefined;

    // Extract image URL from description if present
    const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) {
      imageUrl = imgMatch[1];
      // Remove HTML tags from description for clean text
      description = description.replace(/<[^>]+>/g, '').trim();
    }

    // Check for Point
    const point = element.querySelector('Point coordinates');
    if (point) {
      const coords = this.parseCoordinates(point.textContent || '');
      if (coords.length > 0) {
        return {
          name,
          description: description || undefined,
          type: 'point',
          coordinates: coords,
          imageUrl
        };
      }
    }

    // Check for Polygon
    const polygon = element.querySelector('Polygon outerBoundaryIs LinearRing coordinates');
    if (polygon) {
      const coords = this.parseCoordinates(polygon.textContent || '');
      const style = this.parseStyle(element);
      if (coords.length > 0) {
        return {
          name,
          description: description || undefined,
          type: 'polygon',
          coordinates: coords,
          style
        };
      }
    }

    // Check for LineString
    const line = element.querySelector('LineString coordinates');
    if (line) {
      const coords = this.parseCoordinates(line.textContent || '');
      const style = this.parseStyle(element);
      if (coords.length > 0) {
        return {
          name,
          description: description || undefined,
          type: 'line',
          coordinates: coords,
          style
        };
      }
    }

    return null;
  }

  private parseCoordinates(coordString: string): { lat: number; lng: number; alt?: number }[] {
    const coords: { lat: number; lng: number; alt?: number }[] = [];
    const pairs = coordString.trim().split(/\s+/);

    for (const pair of pairs) {
      const parts = pair.split(',');
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        const alt = parts.length > 2 ? parseFloat(parts[2]) : undefined;

        if (!isNaN(lat) && !isNaN(lng)) {
          coords.push({ lat, lng, alt });
        }
      }
    }

    return coords;
  }

  private parseStyle(element: Element): KmlPlacemark['style'] | undefined {
    // Try to get inline style or referenced style
    const styleUrl = element.querySelector('styleUrl')?.textContent;
    // For now, return default style - could be enhanced to lookup style definitions
    return {
      color: '#ff0000',
      width: 3,
      fillColor: '#ff0000',
      fillOpacity: 0.3
    };
  }

  private isImageFile(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '');
  }

  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp'
    };
    return mimeTypes[extension] || 'image/jpeg';
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
