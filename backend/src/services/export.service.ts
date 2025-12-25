import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export class ExportService {
  async exportToPdf(
    userId: string,
    projectId: string,
    options: {
      includeMap?: boolean;
      includeCatastro?: boolean;
      includeAiDescriptions?: boolean;
    } = {}
  ): Promise<string> {
    // Obtener proyecto con fotos
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        photos: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!project) {
      throw new AppError('Proyecto no encontrado', 404, 'PROJECT_NOT_FOUND');
    }

    // Crear PDF
    const fileName = `${uuidv4()}.pdf`;
    const filePath = path.join(config.upload.dir, 'exports', fileName);

    // Asegurar que existe el directorio
    const exportDir = path.join(config.upload.dir, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Título
      doc.fontSize(24).text('GeoTech - Informe de Proyecto', { align: 'center' });
      doc.moveDown();

      // Info del proyecto
      doc.fontSize(18).text(project.name);
      doc.fontSize(12).text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`);
      if (project.description) {
        doc.text(`Descripción: ${project.description}`);
      }
      doc.text(`Total de fotos: ${project.photos.length}`);
      doc.moveDown(2);

      // Fotos
      project.photos.forEach((photo, index) => {
        // Nueva página para cada foto (excepto la primera)
        if (index > 0) {
          doc.addPage();
        }

        doc.fontSize(14).text(`Foto ${index + 1}`, { underline: true });
        doc.moveDown(0.5);

        // Coordenadas
        doc.fontSize(10);
        doc.text(`Coordenadas: ${photo.latitude}, ${photo.longitude}`);
        if (photo.altitude) {
          doc.text(`Altitud: ${photo.altitude}m`);
        }
        doc.text(`Fecha: ${photo.createdAt.toLocaleDateString('es-ES')} ${photo.createdAt.toLocaleTimeString('es-ES')}`);

        // Catastro
        if (options.includeCatastro && photo.catastroRef) {
          doc.moveDown(0.5);
          doc.text(`Referencia Catastral: ${photo.catastroRef}`);
          if (photo.catastroData) {
            const catData = photo.catastroData as any;
            if (catData.direccion) doc.text(`Dirección: ${catData.direccion}`);
          }
        }

        // Descripción IA
        if (options.includeAiDescriptions && photo.aiDescription) {
          doc.moveDown(0.5);
          doc.fontSize(10).text('Descripción IA:', { underline: true });
          doc.text(photo.aiDescription);
        }

        // Notas
        if (photo.notes) {
          doc.moveDown(0.5);
          doc.text(`Notas: ${photo.notes}`);
        }

        doc.moveDown();
      });

      // Pie de página
      doc.fontSize(8).text(
        'Generado con GeoTech',
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => {
        const baseUrl = process.env.BASE_URL || `http://localhost:${config.port}`;
        resolve(`${baseUrl}/uploads/exports/${fileName}`);
      });

      stream.on('error', reject);
    });
  }

  async exportToExcel(userId: string, projectId: string): Promise<string> {
    // Obtener proyecto con fotos
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        photos: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!project) {
      throw new AppError('Proyecto no encontrado', 404, 'PROJECT_NOT_FOUND');
    }

    // Preparar datos para Excel
    const data = project.photos.map((photo, index) => {
      const catData = photo.catastroData as any;
      return {
        '#': index + 1,
        'Latitud': Number(photo.latitude),
        'Longitud': Number(photo.longitude),
        'Altitud (m)': photo.altitude ? Number(photo.altitude) : '',
        'Precisión (m)': photo.accuracy ? Number(photo.accuracy) : '',
        'Ref. Catastral': photo.catastroRef || '',
        'Dirección': catData?.direccion || '',
        'Descripción IA': photo.aiDescription || '',
        'Notas': photo.notes || '',
        'Fecha': photo.createdAt.toISOString(),
        'URL Imagen': photo.imageUrl
      };
    });

    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 5 },   // #
      { wch: 12 },  // Latitud
      { wch: 12 },  // Longitud
      { wch: 12 },  // Altitud
      { wch: 12 },  // Precisión
      { wch: 25 },  // Ref. Catastral
      { wch: 40 },  // Dirección
      { wch: 50 },  // Descripción IA
      { wch: 30 },  // Notas
      { wch: 20 },  // Fecha
      { wch: 50 }   // URL
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Fotos');

    // Añadir hoja de resumen
    const summaryData = [
      { 'Campo': 'Proyecto', 'Valor': project.name },
      { 'Campo': 'Descripción', 'Valor': project.description || '' },
      { 'Campo': 'Total Fotos', 'Valor': project.photos.length },
      { 'Campo': 'Fecha Creación', 'Valor': project.createdAt.toISOString() },
      { 'Campo': 'Fecha Exportación', 'Valor': new Date().toISOString() }
    ];

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

    // Guardar archivo
    const fileName = `${uuidv4()}.xlsx`;
    const exportDir = path.join(config.upload.dir, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, fileName);
    XLSX.writeFile(wb, filePath);

    const baseUrl = process.env.BASE_URL || `http://localhost:${config.port}`;
    return `${baseUrl}/uploads/exports/${fileName}`;
  }
}

export const exportService = new ExportService();
