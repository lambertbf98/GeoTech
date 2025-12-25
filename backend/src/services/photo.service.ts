// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export interface CreatePhotoData {
  projectId: string;
  imagePath: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  notes?: string;
}

export class PhotoService {
  async getById(userId: string, photoId: string) {
    const photo = await prisma.photo.findFirst({
      where: {
        id: photoId,
        project: { userId }
      },
      include: {
        project: {
          select: { id: true, name: true }
        }
      }
    });

    if (!photo) {
      throw new AppError('Foto no encontrada', 404, 'PHOTO_NOT_FOUND');
    }

    return photo;
  }

  async create(userId: string, data: CreatePhotoData) {
    // Verificar que el proyecto pertenece al usuario
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, userId }
    });

    if (!project) {
      throw new AppError('Proyecto no encontrado', 404, 'PROJECT_NOT_FOUND');
    }

    // Generar thumbnail
    const thumbnailPath = await this.generateThumbnail(data.imagePath);

    // Construir URLs
    const baseUrl = process.env.BASE_URL || `http://localhost:${config.port}`;
    const imageUrl = `${baseUrl}/uploads/${path.basename(data.imagePath)}`;
    const thumbnailUrl = thumbnailPath
      ? `${baseUrl}/uploads/${path.basename(thumbnailPath)}`
      : null;

    const photo = await prisma.photo.create({
      data: {
        projectId: data.projectId,
        imageUrl,
        thumbnailUrl,
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude,
        accuracy: data.accuracy,
        notes: data.notes
      }
    });

    return photo;
  }

  async update(userId: string, photoId: string, data: { notes?: string }) {
    // Verificar que la foto pertenece al usuario
    const existing = await prisma.photo.findFirst({
      where: {
        id: photoId,
        project: { userId }
      }
    });

    if (!existing) {
      throw new AppError('Foto no encontrada', 404, 'PHOTO_NOT_FOUND');
    }

    const photo = await prisma.photo.update({
      where: { id: photoId },
      data
    });

    return photo;
  }

  async delete(userId: string, photoId: string) {
    // Verificar que la foto pertenece al usuario
    const existing = await prisma.photo.findFirst({
      where: {
        id: photoId,
        project: { userId }
      }
    });

    if (!existing) {
      throw new AppError('Foto no encontrada', 404, 'PHOTO_NOT_FOUND');
    }

    // Eliminar archivos
    try {
      const imageName = path.basename(existing.imageUrl);
      await fs.unlink(path.join(config.upload.dir, imageName));

      if (existing.thumbnailUrl) {
        const thumbName = path.basename(existing.thumbnailUrl);
        await fs.unlink(path.join(config.upload.dir, thumbName));
      }
    } catch (error) {
      console.error('Error deleting image files:', error);
    }

    await prisma.photo.delete({ where: { id: photoId } });
  }

  async updateCatastro(photoId: string, catastroRef: string, catastroData: object) {
    return prisma.photo.update({
      where: { id: photoId },
      data: {
        catastroRef,
        catastroData
      }
    });
  }

  async updateAiDescription(photoId: string, description: string) {
    return prisma.photo.update({
      where: { id: photoId },
      data: {
        aiDescription: description
      }
    });
  }

  private async generateThumbnail(imagePath: string): Promise<string | null> {
    try {
      const ext = path.extname(imagePath);
      const baseName = path.basename(imagePath, ext);
      const thumbnailName = `${baseName}_thumb${ext}`;
      const thumbnailPath = path.join(config.upload.dir, thumbnailName);

      await sharp(imagePath)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      return thumbnailPath;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  }
}

export const photoService = new PhotoService();
