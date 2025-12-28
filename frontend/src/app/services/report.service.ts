import { Injectable } from '@angular/core';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  PageBreak,
  VerticalAlign,
  TableLayoutType
} from 'docx';
import { saveAs } from 'file-saver';

export interface ReportPhoto {
  id: string;
  base64?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  aiDescription?: string;
  location?: string;
  catastroRef?: string;
}

export interface ReportZone {
  name: string;
  description?: string;
  area?: number;
  areaFormatted?: string;
  perimeter?: number;
  perimeterFormatted?: string;
  vertices?: number;
  dimensions?: string;
}

export interface ReportPath {
  name: string;
  description?: string;
  length?: number;
  lengthFormatted?: string;
  segments?: number;
  dimensions?: string;
}

export interface ReportData {
  projectName: string;
  projectDescription?: string;
  projectLocation?: string;
  createdAt: string;
  technicianName?: string;
  companyName?: string;
  coverImage?: string;
  aiSummary?: string;
  photos: ReportPhoto[];
  zones?: ReportZone[];
  paths?: ReportPath[];
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  // Almacenar el último reporte generado para visualización
  private lastReportHtml: string = '';
  private lastReportData: ReportData | null = null;

  constructor() {}

  /**
   * Genera un documento Word con formato PDD profesional
   */
  async generateReport(data: ReportData): Promise<Blob> {
    this.lastReportData = data;
    const children: any[] = [];

    // ===== PORTADA =====
    children.push(...this.createCoverPage(data));

    // ===== RESUMEN =====
    if (data.aiSummary) {
      children.push(...this.createSummarySection(data.aiSummary));
    }

    // ===== ZONAS Y VIALES (antes de las fotos) =====
    if ((data.zones && data.zones.length > 0) || (data.paths && data.paths.length > 0)) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(...this.createZonesPathsSection(data.zones, data.paths));
    }

    // ===== DOCUMENTACIÓN FOTOGRÁFICA =====
    if (data.photos && data.photos.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(...await this.createPhotosSection(data.photos));
    }

    // ===== OBSERVACIONES =====
    if (data.notes) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(...this.createNotesSection(data.notes));
    }

    // Pie de documento
    children.push(
      new Paragraph({
        spacing: { before: 600 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: '— Documento generado por GeoTech —',
            size: 18,
            color: '999999',
            italics: true
          })
        ]
      })
    );

    // Crear el documento
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 720,  // 0.5 inch
              right: 720,
              bottom: 720,
              left: 720
            }
          }
        },
        children
      }]
    });

    return await Packer.toBlob(doc);
  }

  /**
   * Genera HTML para previsualización en la app
   */
  generateHtmlPreview(data: ReportData): string {
    this.lastReportData = data;

    let html = `
    <div class="report-preview">
      <style>
        .report-preview {
          font-family: 'Segoe UI', Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: white;
          color: #333;
        }
        .report-cover {
          text-align: center;
          padding: 40px 20px;
          border: 2px solid #1a365d;
          margin-bottom: 30px;
        }
        .report-title {
          font-size: 32px;
          font-weight: bold;
          color: #1a365d;
          margin-bottom: 20px;
        }
        .report-info {
          font-size: 14px;
          color: #666;
          margin: 10px 0;
        }
        .report-section {
          margin: 25px 0;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
        }
        .section-title {
          font-size: 20px;
          font-weight: bold;
          color: #1a365d;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 2px solid #1a365d;
        }
        .ai-summary {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          font-style: italic;
          line-height: 1.6;
        }
        .zone-item, .path-item {
          padding: 12px;
          margin: 10px 0;
          background: #f0f4f8;
          border-radius: 8px;
          border-left: 4px solid #1a365d;
        }
        .zone-item strong, .path-item strong {
          color: #1a365d;
          font-size: 16px;
        }
        .zone-metrics, .path-metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed #ccc;
        }
        .metric {
          background: white;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 13px;
        }
        .metric-label {
          color: #666;
          font-size: 11px;
          display: block;
        }
        .metric-value {
          color: #1a365d;
          font-weight: 600;
        }
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }
        .photo-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
        }
        .photo-card img {
          width: 100%;
          height: 200px;
          object-fit: cover;
        }
        .photo-card .photo-details {
          padding: 12px;
          font-size: 13px;
        }
        .photo-card .photo-details p {
          margin: 5px 0;
        }
        .photo-card .coords {
          color: #666;
          font-family: monospace;
        }
        .photo-card .ai-desc {
          background: #e8f4fd;
          padding: 8px;
          border-radius: 4px;
          margin-top: 8px;
        }
        .no-image {
          width: 100%;
          height: 200px;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
        }
        .footer {
          text-align: center;
          color: #999;
          font-size: 12px;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
      </style>

      <!-- Portada -->
      <div class="report-cover">
        <div class="report-title">INFORME VISITA TÉCNICA</div>
        <div class="report-info"><strong>Proyecto:</strong> ${this.escapeHtml(data.projectName)}</div>
        <div class="report-info"><strong>Fecha:</strong> ${this.formatDate(data.createdAt)}</div>
        <div class="report-info"><strong>Ubicación:</strong> ${this.escapeHtml(data.projectLocation || 'No especificada')}</div>
        ${data.technicianName ? `<div class="report-info"><strong>Técnico:</strong> ${this.escapeHtml(data.technicianName)}</div>` : ''}
      </div>
    `;

    // Resumen IA
    if (data.aiSummary) {
      html += `
      <div class="report-section">
        <div class="section-title">Resumen (generado con IA)</div>
        <div class="ai-summary">${this.escapeHtml(data.aiSummary)}</div>
      </div>
      `;
    }

    // Zonas y Viales
    if ((data.zones && data.zones.length > 0) || (data.paths && data.paths.length > 0)) {
      html += `<div class="report-section"><div class="section-title">Zonas y Viales</div>`;

      if (data.zones && data.zones.length > 0) {
        html += `<h4 style="margin: 15px 0 10px;">Zonas de Estudio:</h4>`;
        data.zones.forEach(zone => {
          html += `<div class="zone-item">
            <strong>${this.escapeHtml(zone.name)}</strong>
            ${zone.description ? `<p style="margin: 5px 0; color: #555;">${this.escapeHtml(zone.description)}</p>` : ''}
            ${zone.areaFormatted || zone.perimeterFormatted ? `
              <div class="zone-metrics">
                ${zone.areaFormatted ? `<div class="metric"><span class="metric-label">Área</span><span class="metric-value">${this.escapeHtml(zone.areaFormatted)}</span></div>` : ''}
                ${zone.perimeterFormatted ? `<div class="metric"><span class="metric-label">Perímetro</span><span class="metric-value">${this.escapeHtml(zone.perimeterFormatted)}</span></div>` : ''}
                ${zone.vertices ? `<div class="metric"><span class="metric-label">Vértices</span><span class="metric-value">${zone.vertices}</span></div>` : ''}
                ${zone.dimensions ? `<div class="metric"><span class="metric-label">Dimensiones</span><span class="metric-value">${this.escapeHtml(zone.dimensions)}</span></div>` : ''}
              </div>
            ` : ''}
          </div>`;
        });
      }

      if (data.paths && data.paths.length > 0) {
        html += `<h4 style="margin: 15px 0 10px;">Viales:</h4>`;
        data.paths.forEach(path => {
          html += `<div class="path-item">
            <strong>${this.escapeHtml(path.name)}</strong>
            ${path.description ? `<p style="margin: 5px 0; color: #555;">${this.escapeHtml(path.description)}</p>` : ''}
            ${path.lengthFormatted || path.segments ? `
              <div class="path-metrics">
                ${path.lengthFormatted ? `<div class="metric"><span class="metric-label">Longitud</span><span class="metric-value">${this.escapeHtml(path.lengthFormatted)}</span></div>` : ''}
                ${path.segments ? `<div class="metric"><span class="metric-label">Tramos</span><span class="metric-value">${path.segments}</span></div>` : ''}
                ${path.dimensions ? `<div class="metric"><span class="metric-label">Extensión</span><span class="metric-value">${this.escapeHtml(path.dimensions)}</span></div>` : ''}
              </div>
            ` : ''}
          </div>`;
        });
      }

      html += `</div>`;
    }

    // Fotos
    if (data.photos && data.photos.length > 0) {
      html += `
      <div class="report-section">
        <div class="section-title">Documentación Fotográfica (${data.photos.length} fotos)</div>
        <div class="photo-grid">
      `;

      data.photos.forEach((photo, i) => {
        html += `
        <div class="photo-card">
          ${photo.base64 ? `<img src="${photo.base64}" alt="Foto ${i + 1}">` : '<div class="no-image">Sin imagen</div>'}
          <div class="photo-details">
            <p><strong>Foto ${i + 1}</strong></p>
            ${photo.latitude && photo.longitude ? `<p class="coords">${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}</p>` : ''}
            ${photo.location ? `<p>${this.escapeHtml(photo.location)}</p>` : ''}
            ${photo.timestamp ? `<p>${this.formatDateTime(photo.timestamp)}</p>` : ''}
            ${photo.aiDescription ? `<div class="ai-desc">${this.escapeHtml(photo.aiDescription)}</div>` : ''}
          </div>
        </div>
        `;
      });

      html += `</div></div>`;
    }

    // Observaciones
    if (data.notes) {
      html += `
      <div class="report-section">
        <div class="section-title">Observaciones</div>
        <p>${this.escapeHtml(data.notes)}</p>
      </div>
      `;
    }

    html += `<div class="footer">Documento generado por GeoTech</div></div>`;

    this.lastReportHtml = html;
    return html;
  }

  /**
   * Obtener el último HTML generado
   */
  getLastReportHtml(): string {
    return this.lastReportHtml;
  }

  /**
   * Obtener los últimos datos del reporte
   */
  getLastReportData(): ReportData | null {
    return this.lastReportData;
  }

  /**
   * Crea la página de portada
   */
  private createCoverPage(data: ReportData): Paragraph[] {
    const elements: Paragraph[] = [];

    // Espacio inicial
    elements.push(new Paragraph({ spacing: { before: 400 } }));

    // Título principal
    elements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600, after: 200 },
        children: [
          new TextRun({
            text: 'INFORME VISITA TÉCNICA',
            bold: true,
            size: 56,
            color: '1a365d'
          })
        ]
      })
    );

    // Línea decorativa
    elements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            size: 24,
            color: '1a365d'
          })
        ]
      })
    );

    // Información del proyecto
    const infoItems = [
      { label: 'Proyecto', value: data.projectName },
      { label: 'Fecha', value: this.formatDate(data.createdAt) },
      { label: 'Ubicación', value: data.projectLocation || 'No especificada' },
    ];

    if (data.technicianName) {
      infoItems.push({ label: 'Técnico', value: data.technicianName });
    }

    infoItems.forEach(item => {
      elements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
          children: [
            new TextRun({ text: `${item.label}: `, bold: true, size: 28 }),
            new TextRun({ text: item.value, size: 28 })
          ]
        })
      );
    });

    // Descripción si existe
    if (data.projectDescription) {
      elements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [
            new TextRun({
              text: data.projectDescription,
              size: 24,
              italics: true,
              color: '666666'
            })
          ]
        })
      );
    }

    return elements;
  }

  /**
   * Crea la sección de resumen con IA
   */
  private createSummarySection(summary: string): any[] {
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({ text: 'RESUMEN ', bold: true, size: 32, color: '1a365d' }),
          new TextRun({ text: '(generado con IA)', italics: true, size: 22, color: '666666' })
        ]
      }),
      new Paragraph({
        spacing: { before: 100, after: 200 },
        children: [
          new TextRun({ text: summary, size: 24 })
        ]
      })
    ];
  }

  /**
   * Crea la sección de fotos
   */
  private async createPhotosSection(photos: ReportPhoto[]): Promise<any[]> {
    const elements: any[] = [];

    elements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({ text: `DOCUMENTACIÓN FOTOGRÁFICA (${photos.length} fotos)`, bold: true, size: 32, color: '1a365d' })
        ]
      })
    );

    // Crear tabla de fotos
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];

      // Información de la foto
      const infoChildren: Paragraph[] = [
        new Paragraph({
          children: [new TextRun({ text: `Foto ${i + 1}`, bold: true, size: 24 })]
        })
      ];

      if (photo.latitude && photo.longitude) {
        infoChildren.push(new Paragraph({
          spacing: { before: 80 },
          children: [
            new TextRun({ text: 'Coordenadas: ', bold: true, size: 20 }),
            new TextRun({ text: `${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}`, size: 20 })
          ]
        }));
      }

      if (photo.location) {
        infoChildren.push(new Paragraph({
          spacing: { before: 80 },
          children: [
            new TextRun({ text: 'Ubicación: ', bold: true, size: 20 }),
            new TextRun({ text: photo.location, size: 20 })
          ]
        }));
      }

      if (photo.timestamp) {
        infoChildren.push(new Paragraph({
          spacing: { before: 80 },
          children: [
            new TextRun({ text: 'Fecha: ', bold: true, size: 20 }),
            new TextRun({ text: this.formatDateTime(photo.timestamp), size: 20 })
          ]
        }));
      }

      if (photo.aiDescription || photo.description) {
        infoChildren.push(new Paragraph({
          spacing: { before: 100 },
          children: [
            new TextRun({ text: 'Descripción: ', bold: true, size: 20 }),
            new TextRun({ text: photo.aiDescription || photo.description || '', size: 20 })
          ]
        }));
      }

      // Crear fila con imagen y datos
      const cells: TableCell[] = [];

      // Celda de imagen
      if (photo.base64) {
        try {
          cells.push(new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: this.extractBase64Data(photo.base64),
                    transformation: { width: 300, height: 225 },
                    type: 'jpg'
                  })
                ]
              })
            ],
            borders: this.getTableBorders()
          }));
        } catch (e) {
          cells.push(new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: '[Imagen no disponible]', italics: true })] })],
            borders: this.getTableBorders()
          }));
        }
      } else {
        cells.push(new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '[Sin imagen]', italics: true, color: '999999' })]
          })],
          borders: this.getTableBorders()
        }));
      }

      // Celda de información
      cells.push(new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        children: infoChildren,
        borders: this.getTableBorders()
      }));

      const row = new TableRow({ children: cells });

      elements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [row]
        }),
        new Paragraph({ spacing: { before: 200 } }) // Espacio entre fotos
      );
    }

    return elements;
  }

  /**
   * Crea la sección de zonas y viales
   */
  private createZonesPathsSection(zones?: ReportZone[], paths?: ReportPath[]): any[] {
    const elements: any[] = [];

    elements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({ text: 'ZONAS Y VIALES', bold: true, size: 32, color: '1a365d' })
        ]
      })
    );

    if (zones && zones.length > 0) {
      elements.push(
        new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({ text: 'Zonas de Estudio:', bold: true, size: 26 })
          ]
        })
      );

      zones.forEach((zone) => {
        elements.push(
          new Paragraph({
            spacing: { before: 120 },
            bullet: { level: 0 },
            children: [
              new TextRun({ text: zone.name, bold: true, size: 22 })
            ]
          })
        );

        if (zone.description) {
          elements.push(
            new Paragraph({
              spacing: { before: 40 },
              indent: { left: 360 },
              children: [
                new TextRun({ text: zone.description, size: 20, italics: true })
              ]
            })
          );
        }

        // Métricas de la zona
        if (zone.areaFormatted || zone.perimeterFormatted) {
          const metricsText: TextRun[] = [];
          if (zone.areaFormatted) {
            metricsText.push(new TextRun({ text: 'Área: ', bold: true, size: 20 }));
            metricsText.push(new TextRun({ text: zone.areaFormatted + '  ', size: 20 }));
          }
          if (zone.perimeterFormatted) {
            metricsText.push(new TextRun({ text: 'Perímetro: ', bold: true, size: 20 }));
            metricsText.push(new TextRun({ text: zone.perimeterFormatted + '  ', size: 20 }));
          }
          if (zone.vertices) {
            metricsText.push(new TextRun({ text: 'Vértices: ', bold: true, size: 20 }));
            metricsText.push(new TextRun({ text: zone.vertices.toString(), size: 20 }));
          }

          elements.push(
            new Paragraph({
              spacing: { before: 40 },
              indent: { left: 360 },
              children: metricsText
            })
          );
        }
      });
    }

    if (paths && paths.length > 0) {
      elements.push(
        new Paragraph({
          spacing: { before: 300, after: 100 },
          children: [
            new TextRun({ text: 'Viales:', bold: true, size: 26 })
          ]
        })
      );

      paths.forEach((path) => {
        elements.push(
          new Paragraph({
            spacing: { before: 120 },
            bullet: { level: 0 },
            children: [
              new TextRun({ text: path.name, bold: true, size: 22 })
            ]
          })
        );

        if (path.description) {
          elements.push(
            new Paragraph({
              spacing: { before: 40 },
              indent: { left: 360 },
              children: [
                new TextRun({ text: path.description, size: 20, italics: true })
              ]
            })
          );
        }

        // Métricas del vial
        if (path.lengthFormatted || path.segments) {
          const metricsText: TextRun[] = [];
          if (path.lengthFormatted) {
            metricsText.push(new TextRun({ text: 'Longitud: ', bold: true, size: 20 }));
            metricsText.push(new TextRun({ text: path.lengthFormatted + '  ', size: 20 }));
          }
          if (path.segments) {
            metricsText.push(new TextRun({ text: 'Tramos: ', bold: true, size: 20 }));
            metricsText.push(new TextRun({ text: path.segments.toString(), size: 20 }));
          }

          elements.push(
            new Paragraph({
              spacing: { before: 40 },
              indent: { left: 360 },
              children: metricsText
            })
          );
        }
      });
    }

    return elements;
  }

  /**
   * Crea la sección de observaciones
   */
  private createNotesSection(notes: string): any[] {
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({ text: 'OBSERVACIONES', bold: true, size: 32, color: '1a365d' })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: notes, size: 24 })
        ]
      })
    ];
  }

  /**
   * Generar y descargar el reporte
   */
  async downloadReport(data: ReportData, filename?: string): Promise<void> {
    const blob = await this.generateReport(data);
    const name = filename || `Informe_${data.projectName.replace(/\s+/g, '_')}_${this.formatDateForFilename(new Date())}.docx`;
    saveAs(blob, name);
  }

  // ==================== Métodos Auxiliares ====================

  private getTableBorders() {
    return {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' }
    };
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  private formatDateTime(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  private formatDateForFilename(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}${month}${year}`;
  }

  private extractBase64Data(base64String: string): Buffer {
    let data = base64String;
    if (data.includes(',')) {
      data = data.split(',')[1];
    }
    return Buffer.from(data, 'base64');
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
