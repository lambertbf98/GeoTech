// @ts-nocheck
import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { licenseService } from '../services/license.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Validacion helper
const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: errors.array()[0].msg,
        details: errors.array()
      }
    });
  }
  next();
};

// ==================== RUTAS PUBLICAS (solo autenticacion) ====================

// GET /api/licenses/status - Obtener estado de licencia del usuario
router.get(
  '/status',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const license = await licenseService.getActiveLicense(req.userId!);
      const hasLicense = !!license;

      res.json({
        hasValidLicense: hasLicense,
        license: license ? {
          id: license.id,
          licenseKey: license.licenseKey,
          type: license.licenseType.name,
          status: license.status,
          expiresAt: license.expiresAt,
          daysRemaining: Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        } : null
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/licenses/activate - Activar licencia con clave
router.post(
  '/activate',
  authenticate,
  [
    body('licenseKey').notEmpty().withMessage('La clave de licencia es requerida')
  ],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { licenseKey } = req.body;
      const license = await licenseService.activateLicense(req.userId!, licenseKey);

      res.json({
        success: true,
        message: 'Licencia activada correctamente',
        license: {
          id: license.id,
          type: license.licenseType.name,
          expiresAt: license.expiresAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/licenses/types - Obtener tipos de licencia disponibles
router.get(
  '/types',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const types = await licenseService.getLicenseTypes();
      res.json(types);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== RUTAS DE ADMIN ====================

// GET /api/licenses/admin/all - Obtener todas las licencias (paginado)
router.get(
  '/admin/all',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await licenseService.getAllLicenses(page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/licenses/admin/users - Obtener todos los usuarios con su estado
router.get(
  '/admin/users',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await licenseService.getAllUsers(page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/licenses/admin/stats - Obtener estadisticas
router.get(
  '/admin/stats',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await licenseService.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/licenses/admin/types - Crear tipo de licencia
router.post(
  '/admin/types',
  authenticate,
  requireAdmin,
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('code').notEmpty().withMessage('El codigo es requerido'),
    body('price').isFloat({ min: 0 }).withMessage('El precio debe ser un numero positivo')
  ],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Validar que tenga al menos horas o dias
      const { durationHours, durationDays } = req.body;
      if ((!durationHours || durationHours <= 0) && (!durationDays || durationDays <= 0)) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Debe especificar duracion en horas o dias' }
        });
      }
      const licenseType = await licenseService.createLicenseType(req.body);
      res.status(201).json(licenseType);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/licenses/admin/types/:id - Actualizar tipo de licencia
router.put(
  '/admin/types/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const licenseType = await licenseService.updateLicenseType(id, req.body);
      res.json(licenseType);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/licenses/admin/create - Crear licencia manualmente
router.post(
  '/admin/create',
  authenticate,
  requireAdmin,
  [
    body('licenseTypeId').notEmpty().withMessage('El tipo de licencia es requerido'),
    body('userId').optional()
  ],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { licenseTypeId, userId } = req.body;
      const license = await licenseService.createLicense(licenseTypeId, userId);
      res.status(201).json(license);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/licenses/admin/revoke/:id - Revocar licencia
router.post(
  '/admin/revoke/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const license = await licenseService.revokeLicense(id);
      res.json({ success: true, message: 'Licencia revocada', license });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== RUTAS DE GESTION DE USUARIOS ====================

// GET /api/licenses/admin/user/:id - Obtener detalle de usuario
router.get(
  '/admin/user/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await licenseService.getUserDetail(id);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/licenses/admin/user/:id/password - Cambiar contrasena de usuario
router.put(
  '/admin/user/:id/password',
  authenticate,
  requireAdmin,
  [
    body('password').isLength({ min: 6 }).withMessage('La contrasena debe tener al menos 6 caracteres')
  ],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      await licenseService.updateUserPassword(id, password);
      res.json({ success: true, message: 'Contrasena actualizada' });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/licenses/admin/user/:id/admin - Cambiar rol de admin
router.put(
  '/admin/user/:id/admin',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { isAdmin } = req.body;
      await licenseService.updateUserAdmin(id, isAdmin);
      res.json({ success: true, message: isAdmin ? 'Usuario es ahora admin' : 'Admin removido' });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/licenses/admin/user/:id - Eliminar usuario
router.delete(
  '/admin/user/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      // No permitir eliminar al usuario actual
      if (id === req.userId) {
        return res.status(400).json({
          error: { code: 'CANNOT_DELETE_SELF', message: 'No puedes eliminarte a ti mismo' }
        });
      }
      await licenseService.deleteUser(id);
      res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
