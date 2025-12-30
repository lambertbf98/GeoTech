// @ts-nocheck
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { licenseService } from '../services/license.service';
import { AppError } from './errorHandler';

// Middleware que requiere licencia valida
export const requireLicense = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      throw new AppError('No autenticado', 401, 'UNAUTHORIZED');
    }

    const hasLicense = await licenseService.hasValidLicense(req.userId);

    if (!hasLicense) {
      throw new AppError(
        'Licencia requerida. Por favor, active o adquiera una licencia para usar esta funcion.',
        403,
        'LICENSE_REQUIRED'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware opcional que añade info de licencia al request (no bloquea)
export const checkLicense = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.userId) {
      const license = await licenseService.getActiveLicense(req.userId);
      (req as any).hasLicense = !!license;
      (req as any).license = license;
    }
    next();
  } catch (error) {
    // No bloquear si hay error, solo continuar
    next();
  }
};
