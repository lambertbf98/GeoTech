// @ts-nocheck
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';
import { AppError } from './errorHandler';

const prisma = new PrismaClient();

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      throw new AppError('No autenticado', 401, 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true }
    });

    if (!user || !user.isAdmin) {
      throw new AppError('Acceso denegado. Se requieren permisos de administrador', 403, 'FORBIDDEN');
    }

    next();
  } catch (error) {
    next(error);
  }
};
