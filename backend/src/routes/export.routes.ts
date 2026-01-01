// @ts-nocheck
import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { exportService } from '../services/export.service';

const router = Router();

router.use(authenticate);

// POST /api/export/satellite-map - Proxy para obtener imagen satelital de ESRI
router.post(
  '/satellite-map',
  [
    body('bounds').notEmpty().withMessage('bounds es requerido'),
    body('bounds.north').isNumeric().withMessage('north es requerido'),
    body('bounds.south').isNumeric().withMessage('south es requerido'),
    body('bounds.east').isNumeric().withMessage('east es requerido'),
    body('bounds.west').isNumeric().withMessage('west es requerido')
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
      const { bounds, width = 800, height = 500 } = req.body;
      const { north, south, east, west } = bounds;

      // Usar ESRI World Imagery Export API
      const esriUrl = `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${west},${south},${east},${north}&bboxSR=4326&size=${width},${height}&imageSR=4326&format=png&f=image`;

      console.log('Fetching satellite map from ESRI:', esriUrl);

      const response = await fetch(esriUrl);

      if (!response.ok) {
        throw new Error(`ESRI API error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      res.json({
        image: dataUrl,
        width,
        height
      });
    } catch (error) {
      console.error('Error fetching satellite map:', error);
      res.status(500).json({
        error: {
          code: 'MAP_FETCH_ERROR',
          message: 'No se pudo obtener la imagen satelital'
        }
      });
    }
  }
);

// POST /api/export/pdf
router.post(
  '/pdf',
  [
    body('projectId').notEmpty().withMessage('projectId es requerido')
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
      const { projectId, options } = req.body;

      const downloadUrl = await exportService.exportToPdf(req.userId!, projectId, options || {});

      // URL válida por 24 horas
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      res.json({
        downloadUrl,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/export/excel
router.post(
  '/excel',
  [
    body('projectId').notEmpty().withMessage('projectId es requerido')
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
      const { projectId } = req.body;

      const downloadUrl = await exportService.exportToExcel(req.userId!, projectId);

      // URL válida por 24 horas
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      res.json({
        downloadUrl,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
