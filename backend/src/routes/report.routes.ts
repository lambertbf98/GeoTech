// @ts-nocheck
import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { reportService, kmlService } from '../services/report.service';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ========== REPORTS ==========

// GET /api/reports/project/:projectId - Obtener todos los informes de un proyecto
router.get('/project/:projectId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reports = await reportService.getByProject(req.userId!, req.params.projectId);
    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/:id - Obtener un informe específico con contenido
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await reportService.getById(req.userId!, req.params.id);
    res.json({ report });
  } catch (error) {
    next(error);
  }
});

// POST /api/reports - Crear un nuevo informe
router.post(
  '/',
  [
    body('projectId').notEmpty().withMessage('El ID del proyecto es requerido'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('htmlContent').notEmpty().withMessage('El contenido HTML es requerido')
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
      const { projectId, name, htmlContent } = req.body;
      const report = await reportService.create(req.userId!, projectId, name, htmlContent);
      res.status(201).json({ report });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/reports/:id - Eliminar un informe
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await reportService.delete(req.userId!, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ========== KML FILES ==========

// GET /api/reports/kml/project/:projectId - Obtener todos los KML de un proyecto
router.get('/kml/project/:projectId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const kmlFiles = await kmlService.getByProject(req.userId!, req.params.projectId);
    res.json({ kmlFiles });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/kml/:id - Obtener un KML específico con contenido
router.get('/kml/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const kml = await kmlService.getById(req.userId!, req.params.id);
    res.json({ kml });
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/kml - Crear un nuevo KML
router.post(
  '/kml',
  [
    body('projectId').notEmpty().withMessage('El ID del proyecto es requerido'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('kmlContent').notEmpty().withMessage('El contenido KML es requerido')
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
      const { projectId, name, kmlContent } = req.body;
      const kml = await kmlService.create(req.userId!, projectId, name, kmlContent);
      res.status(201).json({ kml });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/reports/kml/:id - Eliminar un KML
router.delete('/kml/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await kmlService.delete(req.userId!, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ========== ADMIN ROUTES ==========

// GET /api/reports/admin/:id - Admin: Obtener un informe sin verificar propiedad
router.get('/admin/:id', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await reportService.adminGetById(req.params.id);
    res.json({ report });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/kml/admin/:id - Admin: Obtener un KML sin verificar propiedad
router.get('/kml/admin/:id', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const kml = await kmlService.adminGetById(req.params.id);
    res.json({ kml });
  } catch (error) {
    next(error);
  }
});

export default router;
