// @ts-nocheck
import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cloudinaryService } from '../services/cloudinary.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

// POST /api/photos/upload
router.post('/upload',
  [
    body('projectId').notEmpty().withMessage('projectId es requerido'),
    body('imageBase64').notEmpty().withMessage('imageBase64 es requerido')
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      if (!cloudinaryService.isConfigured()) {
        return res.status(503).json({ error: 'Cloudinary no configurado', code: 'CLOUDINARY_NOT_CONFIGURED' });
      }

      const { projectId, imageBase64, latitude, longitude, altitude, notes } = req.body;

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.userId }
      });

      if (!project) {
        return res.status(404).json({ error: 'Proyecto no encontrado' });
      }

      const folder = `geotech/${req.userId}/${projectId}`;
      const uploadResult = await cloudinaryService.uploadImage(imageBase64, folder);

      const photo = await prisma.photo.create({
        data: {
          projectId,
          imageUrl: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl,
          latitude: latitude || 0,
          longitude: longitude || 0,
          altitude: altitude || null,
          notes: notes || null
        }
      });

      res.status(201).json({
        success: true,
        photo: {
          id: photo.id,
          imageUrl: photo.imageUrl,
          thumbnailUrl: photo.thumbnailUrl,
          latitude: photo.latitude,
          longitude: photo.longitude,
          createdAt: photo.createdAt
        }
      });
    } catch (error: any) {
      console.error('Error uploading photo:', error?.message);
      res.status(500).json({ error: 'Error al subir foto: ' + (error?.message || 'desconocido') });
    }
  }
);

// GET /api/photos/project/:projectId
router.get('/project/:projectId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const photos = await prisma.photo.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ photos });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/photos/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const photo = await prisma.photo.findFirst({
      where: { id },
      include: { project: true }
    });

    if (!photo || photo.project.userId !== req.userId) {
      return res.status(404).json({ error: 'Foto no encontrada' });
    }

    // Eliminar de Cloudinary
    const urlParts = photo.imageUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    if (uploadIndex !== -1) {
      const publicIdParts = urlParts.slice(uploadIndex + 2);
      const publicId = publicIdParts.join('/').replace(/\.[^/.]+$/, '');
      await cloudinaryService.deleteImage(publicId);
    }

    await prisma.photo.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
