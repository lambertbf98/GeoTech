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
  Header,
  Footer,
  PageNumber,
  NumberFormat
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
}

export interface ReportData {
  // Datos del proyecto
  projectName: string;
  projectDescription?: string;
  projectLocation?: string;
  createdAt: string;
  updatedAt?: string;

  // Datos del autor
  authorName?: string;
  authorEmail?: string;
  companyName?: string;

  // Datos catastrales
  catastro?: {
    referenciaCatastral?: string;
    direccion?: string;
    municipio?: string;
    provincia?: string;
  };

  // Fotos del proyecto
  photos: ReportPhoto[];

  // Mediciones
  measurements?: {
    type: 'distance' | 'area';
    value: number;
    location?: string;
  }[];

  // Notas adicionales
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {

  constructor() {}

  /**
   * Generate a Word document report from project data
   */
  async generateReport(data: ReportData): Promise<Blob> {
    const children: any[] = [];

    // ===== PORTADA =====
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 3000 },
        children: [
          new TextRun({
            text: 'INFORME DE VISITA TÉCNICA',
            bold: true,
            size: 56,
            color: '2563eb'
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 800 },
        children: [
          new TextRun({
            text: data.projectName,
            bold: true,
            size: 44
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [
          new TextRun({
            text: data.projectLocation || 'Ubicación no especificada',
            size: 28,
            color: '666666'
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1500 },
        children: [
          new TextRun({
            text: `Fecha: ${this.formatDate(data.createdAt)}`,
            size: 24
          })
        ]
      })
    );

    if (data.authorName || data.companyName) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [
            new TextRun({
              text: data.companyName || '',
              size: 24,
              bold: true
            })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: data.authorName || '',
              size: 22
            })
          ]
        })
      );
    }

    // Salto de página después de portada
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ===== ÍNDICE =====
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: 'ÍNDICE', bold: true })]
      }),
      new Paragraph({
        spacing: { before: 200 },
        children: [new TextRun({ text: '1. Datos del Proyecto', size: 24 })]
      }),
      new Paragraph({
        children: [new TextRun({ text: '2. Información Catastral', size: 24 })]
      }),
      new Paragraph({
        children: [new TextRun({ text: '3. Documentación Fotográfica', size: 24 })]
      })
    );

    if (data.measurements && data.measurements.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '4. Mediciones', size: 24 })]
        })
      );
    }

    if (data.notes) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '5. Observaciones', size: 24 })]
        })
      );
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ===== 1. DATOS DEL PROYECTO =====
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400 },
        children: [new TextRun({ text: '1. DATOS DEL PROYECTO', bold: true })]
      })
    );

    const projectTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        this.createTableRow('Nombre del Proyecto', data.projectName),
        this.createTableRow('Ubicación', data.projectLocation || 'No especificada'),
        this.createTableRow('Fecha de Creación', this.formatDate(data.createdAt)),
        this.createTableRow('Descripción', data.projectDescription || 'Sin descripción')
      ]
    });
    children.push(projectTable);

    // ===== 2. INFORMACIÓN CATASTRAL =====
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 600 },
        children: [new TextRun({ text: '2. INFORMACIÓN CATASTRAL', bold: true })]
      })
    );

    if (data.catastro && data.catastro.referenciaCatastral) {
      const catastroTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          this.createTableRow('Referencia Catastral', data.catastro.referenciaCatastral),
          this.createTableRow('Dirección', data.catastro.direccion || 'No disponible'),
          this.createTableRow('Municipio', data.catastro.municipio || 'No disponible'),
          this.createTableRow('Provincia', data.catastro.provincia || 'No disponible')
        ]
      });
      children.push(catastroTable);
    } else {
      children.push(
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: 'No se han obtenido datos catastrales para este proyecto.', italics: true })]
        })
      );
    }

    // ===== 3. DOCUMENTACIÓN FOTOGRÁFICA =====
    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: '3. DOCUMENTACIÓN FOTOGRÁFICA', bold: true })]
      })
    );

    if (data.photos && data.photos.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 200 },
          children: [
            new TextRun({
              text: `Total de fotografías: ${data.photos.length}`,
              size: 22
            })
          ]
        })
      );

      for (let i = 0; i < data.photos.length; i++) {
        const photo = data.photos[i];

        // Título de la foto
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: `Fotografía ${i + 1}`,
                bold: true
              })
            ]
          })
        );

        // Imagen (si hay base64)
        if (photo.base64) {
          try {
            const imageData = this.extractBase64Data(photo.base64);
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200 },
                children: [
                  new ImageRun({
                    data: imageData,
                    transformation: {
                      width: 450,
                      height: 300
                    },
                    type: 'jpg'
                  })
                ]
              })
            );
          } catch (e) {
            console.error('Error adding image:', e);
          }
        }

        // Datos de la foto en tabla
        const photoRows: TableRow[] = [];

        if (photo.timestamp) {
          photoRows.push(this.createTableRow('Fecha/Hora', this.formatDateTime(photo.timestamp)));
        }

        if (photo.latitude && photo.longitude) {
          photoRows.push(this.createTableRow('Coordenadas', `${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}`));
        }

        if (photo.description) {
          photoRows.push(this.createTableRow('Descripción', photo.description));
        }

        if (photo.aiDescription) {
          photoRows.push(this.createTableRow('Análisis IA', photo.aiDescription));
        }

        if (photoRows.length > 0) {
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: photoRows
            })
          );
        }
      }
    } else {
      children.push(
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: 'No hay fotografías asociadas a este proyecto.', italics: true })]
        })
      );
    }

    // ===== 4. MEDICIONES =====
    if (data.measurements && data.measurements.length > 0) {
      children.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: '4. MEDICIONES', bold: true })]
        })
      );

      const measurementRows = data.measurements.map((m, i) => {
        const typeStr = m.type === 'distance' ? 'Distancia' : 'Área';
        const valueStr = m.type === 'distance'
          ? `${m.value.toFixed(2)} m`
          : `${m.value.toFixed(0)} m²`;
        return this.createTableRow(`${typeStr} ${i + 1}`, `${valueStr}${m.location ? ` - ${m.location}` : ''}`);
      });

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: measurementRows
        })
      );
    }

    // ===== 5. OBSERVACIONES =====
    if (data.notes) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 600 },
          children: [new TextRun({ text: '5. OBSERVACIONES', bold: true })]
        }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: data.notes })]
        })
      );
    }

    // ===== PIE DE PÁGINA =====
    children.push(
      new Paragraph({
        spacing: { before: 1000 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: '—— Documento generado por GeoTech ——',
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
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: data.projectName,
                    size: 18,
                    color: '666666'
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Página ',
                    size: 18
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 18
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18
                  })
                ]
              })
            ]
          })
        },
        children
      }]
    });

    return await Packer.toBlob(doc);
  }

  /**
   * Generate and download the report
   */
  async downloadReport(data: ReportData, filename?: string): Promise<void> {
    const blob = await this.generateReport(data);
    const name = filename || `Informe_${data.projectName.replace(/\s+/g, '_')}_${this.formatDateForFilename(new Date())}.docx`;
    saveAs(blob, name);
  }

  // ==================== Private Methods ====================

  private createTableRow(label: string, value: string): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: 'f3f4f6' },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: label,
                  bold: true,
                  size: 22
                })
              ]
            })
          ]
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: value,
                  size: 22
                })
              ]
            })
          ]
        })
      ]
    });
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
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private formatDateForFilename(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}${month}${year}`;
  }

  private extractBase64Data(base64String: string): Buffer {
    // Remove data URL prefix if present
    let data = base64String;
    if (data.includes(',')) {
      data = data.split(',')[1];
    }
    return Buffer.from(data, 'base64');
  }
}
