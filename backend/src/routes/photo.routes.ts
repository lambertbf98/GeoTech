// @ts-nocheck
import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { photoService } from '../services/photo.service';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET /api/photos/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const photo = await photoService.getById(req.userId!, req.params.id);
    res.json({ photo });
  } catch (error) {
    next(error);
  }
});

// POST /api/photos
router.post(
  '/',
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Se requiere una imagen'
          }
        });
      }

      const { projectId, latitude, longitude, altitude, accuracy, notes } = req.body;

      if (!projectId || !latitude || !longitude) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Se requieren projectId, latitude y longitude'
          }
        });
      }

      const photo = await photoService.create(req.userId!, {
        projectId,
        imagePath: req.file.path,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        altitude: altitude ? parseFloat(altitude) : undefined,
        accuracy: accuracy ? parseFloat(accuracy) : undefined,
        notes
      });

      res.status(201).json({ photo });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/photos/:id
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { notes } = req.body;
    const photo = await photoService.update(req.userId!, req.params.id, { notes });
    res.json({ photo });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/photos/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await photoService.delete(req.userId!, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
