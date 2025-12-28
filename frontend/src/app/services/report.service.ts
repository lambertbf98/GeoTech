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
}

export interface ReportPath {
  name: string;
  description?: string;
}

export interface ReportData {
  projectName: string;
  projectDescription?: string;
  projectLocation?: string;
  createdAt: string;
  technicianName?: string;
  companyName?: string;

  // Imagen de portada (mapa o captura)
  coverImage?: string;

  // Resumen generado por IA
  aiSummary?: string;

  // Fotos del proyecto
  photos: ReportPhoto[];

  // Zonas y viales
  zones?: ReportZone[];
  paths?: ReportPath[];

  // Notas adicionales
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {

  constructor() {}

  /**
   * Genera un documento Word con formato PDD profesional
   */
  async generateReport(data: ReportData): Promise<Blob> {
    const children: any[] = [];

    // ===== PORTADA =====
    children.push(...this.createCoverPage(data));

    // ===== RESUMEN =====
    if (data.aiSummary) {
      children.push(...this.createSummarySection(data.aiSummary));
    }

    // Salto de página
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ===== DOCUMENTACIÓN FOTOGRÁFICA =====
    if (data.photos && data.photos.length > 0) {
      children.push(...await this.createPhotosSection(data.photos));
    }

    // ===== ZONAS Y VIALES =====
    if ((data.zones && data.zones.length > 0) || (data.paths && data.paths.length > 0)) {
      children.push(...this.createZonesPathsSection(data.zones, data.paths));
    }

    // ===== OBSERVACIONES =====
    if (data.notes) {
      children.push(...this.createNotesSection(data.notes));
    }

    // Crear el documento
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000
            }
          }
        },
        children
      }]
    });

    return await Packer.toBlob(doc);
  }

  /**
   * Crea la página de portada
   */
  private createCoverPage(data: ReportData): Paragraph[] {
    const elements: Paragraph[] = [];

    // Tabla principal de portada
    const coverRows: TableRow[] = [];

    // Fila 1: Título e imagen
    const titleAndImageCells: TableCell[] = [
      new TableCell({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: 'INFORME VISITA',
                bold: true,
                size: 72,
                color: '1a365d'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: 'TÉCNICA',
                bold: true,
                size: 72,
                color: '1a365d'
              })
            ]
          }),
          // Espacio para imagen de portada
          ...(data.coverImage ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
              children: [
                new ImageRun({
                  data: this.extractBase64Data(data.coverImage),
                  transformation: {
                    width: 450,
                    height: 400
                  },
                  type: 'jpg'
                })
              ]
            })
          ] : [])
        ],
        verticalAlign: VerticalAlign.CENTER,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
        }
      })
    ];

    coverRows.push(new TableRow({
      children: titleAndImageCells,
      height: { value: 8000, rule: 'atLeast' as any }
    }));

    // Fila 2: Información del proyecto
    coverRows.push(new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              spacing: { before: 100 },
              children: [
                new TextRun({ text: 'Nombre Proyecto: ', bold: true, size: 24 }),
                new TextRun({ text: data.projectName, size: 24 })
              ]
            }),
            new Paragraph({
              spacing: { before: 100 },
              children: [
                new TextRun({ text: 'Fecha visita: ', bold: true, size: 24 }),
                new TextRun({ text: this.formatDate(data.createdAt), size: 24 })
              ]
            }),
            new Paragraph({
              spacing: { before: 100 },
              children: [
                new TextRun({ text: 'Ubicación: ', bold: true, size: 24 }),
                new TextRun({ text: data.projectLocation || 'No especificada', size: 24 })
              ]
            }),
            new Paragraph({
              spacing: { before: 100, after: 100 },
              children: [
                new TextRun({ text: 'Técnico: ', bold: true, size: 24 }),
                new TextRun({ text: data.technicianName || 'No especificado', size: 24 })
              ]
            })
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
          }
        })
      ]
    }));

    const coverTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: coverRows
    });

    elements.push(new Paragraph({ children: [] })); // Espacio inicial
    elements.push(coverTable as any);

    return elements;
  }

  /**
   * Crea la sección de resumen con IA
   */
  private createSummarySection(summary: string): any[] {
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    spacing: { before: 100 },
                    children: [
                      new TextRun({ text: 'RESUMEN ', bold: true, size: 28 }),
                      new TextRun({ text: '(generado con IA)', italics: true, size: 22, color: '666666' })
                    ]
                  }),
                  new Paragraph({
                    spacing: { before: 200, after: 200 },
                    children: [
                      new TextRun({ text: summary, size: 24 })
                    ]
                  })
                ],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                  left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                  right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
                }
              })
            ]
          })
        ]
      })
    ];
  }

  /**
   * Crea la sección de fotos en formato tabla
   */
  private async createPhotosSection(photos: ReportPhoto[]): Promise<any[]> {
    const elements: any[] = [];

    elements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({ text: 'DOCUMENTACIÓN FOTOGRÁFICA', bold: true, size: 32 })
        ]
      })
    );

    // Crear tabla de fotos
    const photoRows: TableRow[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];

      const cells: TableCell[] = [
        // Columna 1: Número de foto
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.TOP,
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `Foto ${i + 1}`, bold: true, size: 22 })
              ]
            })
          ],
          borders: this.getTableBorders()
        }),

        // Columna 2: Imagen
        new TableCell({
          width: { size: 55, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          children: photo.base64 ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: this.extractBase64Data(photo.base64),
                  transformation: {
                    width: 380,
                    height: 285
                  },
                  type: 'jpg'
                })
              ]
            })
          ] : [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: '[Imagen no disponible]', italics: true, color: '999999' })
              ]
            })
          ],
          borders: this.getTableBorders()
        }),

        // Columna 3: Información
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.TOP,
          children: [
            new Paragraph({
              spacing: { after: 100 },
              children: [
                new TextRun({ text: 'Coordenadas: ', bold: true, size: 20 }),
                new TextRun({
                  text: photo.latitude && photo.longitude
                    ? `${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}`
                    : 'No disponibles',
                  size: 20
                })
              ]
            }),
            new Paragraph({
              spacing: { after: 100 },
              children: [
                new TextRun({ text: 'Ubicación: ', bold: true, size: 20 }),
                new TextRun({ text: photo.location || 'No especificada', size: 20 })
              ]
            }),
            new Paragraph({
              spacing: { after: 100 },
              children: [
                new TextRun({ text: 'Catastro: ', bold: true, size: 20 }),
                new TextRun({ text: photo.catastroRef || 'No disponible', size: 20 })
              ]
            }),
            new Paragraph({
              spacing: { after: 100 },
              children: [
                new TextRun({ text: 'Fecha: ', bold: true, size: 20 }),
                new TextRun({ text: photo.timestamp ? this.formatDateTime(photo.timestamp) : 'No disponible', size: 20 })
              ]
            }),
            new Paragraph({
              spacing: { before: 100 },
              children: [
                new TextRun({ text: 'Descripción:', bold: true, size: 20 })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: photo.aiDescription || photo.description || 'Sin descripción',
                  size: 20,
                  italics: !photo.aiDescription && !photo.description
                })
              ]
            })
          ],
          borders: this.getTableBorders()
        })
      ];

      photoRows.push(new TableRow({
        children: cells,
        height: { value: 4000, rule: 'atLeast' as any }
      }));
    }

    if (photoRows.length > 0) {
      elements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: photoRows
        })
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
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({ text: 'ZONAS Y VIALES', bold: true, size: 32 })
        ]
      })
    );

    if (zones && zones.length > 0) {
      elements.push(
        new Paragraph({
          spacing: { before: 200 },
          children: [
            new TextRun({ text: 'Zonas de Estudio:', bold: true, size: 26 })
          ]
        })
      );

      zones.forEach((zone, i) => {
        elements.push(
          new Paragraph({
            spacing: { before: 100 },
            bullet: { level: 0 },
            children: [
              new TextRun({ text: zone.name, bold: true, size: 22 }),
              new TextRun({ text: zone.description ? `: ${zone.description}` : '', size: 22 })
            ]
          })
        );
      });
    }

    if (paths && paths.length > 0) {
      elements.push(
        new Paragraph({
          spacing: { before: 300 },
          children: [
            new TextRun({ text: 'Viales:', bold: true, size: 26 })
          ]
        })
      );

      paths.forEach((path, i) => {
        elements.push(
          new Paragraph({
            spacing: { before: 100 },
            bullet: { level: 0 },
            children: [
              new TextRun({ text: path.name, bold: true, size: 22 }),
              new TextRun({ text: path.description ? `: ${path.description}` : '', size: 22 })
            ]
          })
        );
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
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({ text: 'OBSERVACIONES', bold: true, size: 32 })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: notes, size: 24 })
        ]
      }),
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
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
    };
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  private formatDateTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
}
