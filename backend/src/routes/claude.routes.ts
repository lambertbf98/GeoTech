// @ts-nocheck
import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { claudeService } from '../services/claude.service';
import { photoService } from '../services/photo.service';
import { config } from '../config';

const router = Router();

// POST /api/claude/analyze - Analyze image directly from base64
// This endpoint does NOT require authentication for easier mobile testing
router.post(
  '/analyze',
  [
    body('imageBase64').notEmpty().withMessage('imageBase64 es requerido')
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
      const { imageBase64, context } = req.body;
      
      // Call Claude service with base64 image
      const description = await claudeService.describeImageFromBase64(imageBase64, context);
      
      res.json({ description });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/claude/generate-report - Generate technical report summary
router.post(
  '/generate-report',
  [
    body('prompt').notEmpty().withMessage('prompt es requerido')
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
      const { prompt } = req.body;

      // Call Claude service to generate report summary
      const summary = await claudeService.generateReport(prompt);

      res.json({
        summary,
        photoDescriptions: []
      });
    } catch (error) {
      next(error);
    }
  }
);

router.use(authenticate);

// POST /api/claude/describe
router.post(
  '/describe',
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
      const { photoId, context } = req.body;

      // Obtener foto
      const photo = await photoService.getById(req.userId!, photoId);

      // Extraer nombre del archivo de la URL
      const imageName = path.basename(photo.imageUrl);
      const imagePath = path.join(config.upload.dir, imageName);

      // Generar descripción con Claude
      const description = await claudeService.describeImage(imagePath, context);

      // Actualizar foto con la descripción
      await photoService.updateAiDescription(photoId, description);

      res.json({
        description,
        photo: {
          id: photoId,
          aiDescription: description
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
