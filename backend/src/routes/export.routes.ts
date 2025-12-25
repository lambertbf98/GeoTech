import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { exportService } from '../services/export.service';

const router = Router();

router.use(authenticate);

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
