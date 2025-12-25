import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export class ProjectService {
  async getAll(userId: string) {
    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        _count: {
          select: { photos: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      photoCount: p._count.photos,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));
  }

  async getById(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        photos: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!project) {
      throw new AppError('Proyecto no encontrado', 404, 'PROJECT_NOT_FOUND');
    }

    return project;
  }

  async create(userId: string, name: string, description?: string) {
    const project = await prisma.project.create({
      data: {
        userId,
        name,
        description
      }
    });

    return project;
  }

  async update(userId: string, projectId: string, data: { name?: string; description?: string }) {
    // Verificar que el proyecto pertenece al usuario
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!existing) {
      throw new AppError('Proyecto no encontrado', 404, 'PROJECT_NOT_FOUND');
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data
    });

    return project;
  }

  async delete(userId: string, projectId: string) {
    // Verificar que el proyecto pertenece al usuario
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!existing) {
      throw new AppError('Proyecto no encontrado', 404, 'PROJECT_NOT_FOUND');
    }

    await prisma.project.delete({ where: { id: projectId } });
  }
}

export const projectService = new ProjectService();
