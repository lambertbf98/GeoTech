// @ts-nocheck
import { Router, Response, NextFunction } from 'express';
import { query, body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { catastroService } from '../services/catastro.service';
import { photoService } from '../services/photo.service';

const router = Router();

// GET /api/catastro/lookup?lat=X&lon=Y - NO AUTH for easier mobile use
router.get(
  '/lookup',
  [
    query('lat').isFloat().withMessage('Latitud invalida'),
    query('lon').isFloat().withMessage('Longitud invalida')
  ],
  async (req: any, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.array()[0].msg
        }
      });
    }

    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);

      const catastro = await catastroService.lookupByCoordinates(lat, lon);

      res.json({
        success: true,
        catastro
      });
    } catch (error) {
      next(error);
    }
  }
);

// Routes below require auth
router.use(authenticate);

// POST /api/catastro/assign
router.post(
  '/assign',
  [
    body('photoId').notEmpty().withMessage('photoId es requerido')
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.array()[0].msg
        }
      });
    }

    try {
      const { photoId } = req.body;
      const photo = await photoService.getById(req.userId!, photoId);
      const catastro = await catastroService.lookupByCoordinates(
        Number(photo.latitude),
        Number(photo.longitude)
      );
      const updatedPhoto = await photoService.updateCatastro(
        photoId,
        catastro.referenciaCatastral,
        catastro
      );
      res.json({ photo: updatedPhoto });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
