// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export class ReportService {
  // Obtener todos los informes de un proyecto
  async getByProject(userId: string, projectId: string) {
    // Verificar que el proyecto pertenece al usuario
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      throw new AppError('Proyecto no encontrado', 404, 'PROJECT_NOT_FOUND');
    }

    const reports = await prisma.report.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return reports;
  }

  // Obtener un informe específico con su contenido
  async getById(userId: string, reportId: string) {
    const report = await prisma.report.findFirst({
      where: { id: reportId },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!report || report.project.userId !== userId) {
      throw new AppError('Informe no encontrado', 404, 'REPORT_NOT_FOUND');
    }

    return {
      id: report.id,
      projectId: report.projectId,
      name: report.name,
      htmlContent: report.htmlContent,
      fileUrl: report.fileUrl,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    };
  }

  // Crear un nuevo informe
  async create(userId: string, projectId: string, name: string, htmlContent: string) {
    // Verificar que el proyecto pertenece al usuario
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      throw new AppError('Proyecto no encontrado', 404, 'PROJECT_NOT_FOUND');
    }

    const report = await prisma.report.create({
      data: {
        projectId,
        name,
        htmlContent
      }
    });

    return report;
  }

  // Eliminar un informe
  async delete(userId: string, reportId: string) {
    const report = await prisma.report.findFirst({
      where: { id: reportId },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!report || report.project.userId !== userId) {
      throw new AppError('Informe no encontrado', 404, 'REPORT_NOT_FOUND');
    }

    await prisma.report.delete({ where: { id: reportId } });
  }
}

export class KmlService {
  // Obtener todos los KML de un proyecto
  async getByProject(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      throw new AppError('Proyecto no encontrado', 404, 'PROJECT_NOT_FOUND');
    }

    const kmlFiles = await prisma.kmlFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return kmlFiles;
  }

  // Obtener un KML específico con su contenido
  async getById(userId: string, kmlId: string) {
    const kml = await prisma.kmlFile.findFirst({
      where: { id: kmlId },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!kml || kml.project.userId !== userId) {
      throw new AppError('Archivo KML no encontrado', 404, 'KML_NOT_FOUND');
    }

    return {
      id: kml.id,
      projectId: kml.projectId,
      name: kml.name,
      kmlContent: kml.kmlContent,
      fileUrl: kml.fileUrl,
      createdAt: kml.createdAt,
      updatedAt: kml.updatedAt
    };
  }

  // Crear un nuevo KML
  async create(userId: string, projectId: string, name: string, kmlContent: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      throw new AppError('Proyecto no encontrado', 404, 'PROJECT_NOT_FOUND');
    }

    const kml = await prisma.kmlFile.create({
      data: {
        projectId,
        name,
        kmlContent
      }
    });

    return kml;
  }

  // Eliminar un KML
  async delete(userId: string, kmlId: string) {
    const kml = await prisma.kmlFile.findFirst({
      where: { id: kmlId },
      include: {
        project: {
          select: { userId: true }
        }
      }
    });

    if (!kml || kml.project.userId !== userId) {
      throw new AppError('Archivo KML no encontrado', 404, 'KML_NOT_FOUND');
    }

    await prisma.kmlFile.delete({ where: { id: kmlId } });
  }
}

export const reportService = new ReportService();
export const kmlService = new KmlService();
