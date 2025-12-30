// @ts-nocheck
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();

// Email del administrador
const ADMIN_EMAIL = 'gfmemorieswork@gmail.com';

// GET /api/setup/init - Inicializar sistema de licencias (solo funciona una vez)
router.get('/init', async (req: Request, res: Response) => {
  try {
    // Verificar si ya hay tipos de licencia
    const existingTypes = await prisma.licenseType.count();

    const results: string[] = [];

    // 1. Crear tipos de licencia si no existen
    if (existingTypes === 0) {
      const licenseTypes = [
        { name: 'Diaria', code: 'daily', durationDays: 1, price: 2.99, description: 'Licencia valida por 24 horas' },
        { name: 'Mensual', code: 'monthly', durationDays: 30, price: 9.99, description: 'Licencia valida por 30 dias' },
        { name: 'Trimestral', code: 'quarterly', durationDays: 90, price: 24.99, description: 'Licencia valida por 3 meses' },
        { name: 'Anual', code: 'yearly', durationDays: 365, price: 79.99, description: 'Licencia valida por 1 ano' }
      ];

      for (const type of licenseTypes) {
        await prisma.licenseType.create({ data: type });
        results.push(`Tipo de licencia creado: ${type.name} - ${type.price} EUR`);
      }
    } else {
      results.push(`Tipos de licencia ya existentes: ${existingTypes}`);
    }

    // 2. Configurar usuario admin
    const existingUser = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL }
    });

    if (existingUser) {
      if (!existingUser.isAdmin) {
        await prisma.user.update({
          where: { email: ADMIN_EMAIL },
          data: { isAdmin: true }
        });
        results.push(`Usuario ${ADMIN_EMAIL} actualizado como administrador`);
      } else {
        results.push(`Usuario ${ADMIN_EMAIL} ya es administrador`);
      }
    } else {
      const passwordHash = await bcrypt.hash('Admin123!', 10);
      await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          passwordHash,
          name: 'Administrador',
          isAdmin: true
        }
      });
      results.push(`Usuario admin creado: ${ADMIN_EMAIL}`);
      results.push(`Password temporal: Admin123! (CAMBIALA EN /admin)`);
    }

    res.json({
      success: true,
      message: 'Sistema inicializado correctamente',
      results,
      adminPanel: '/admin',
      adminEmail: ADMIN_EMAIL
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/setup/status - Ver estado del sistema
router.get('/status', async (req: Request, res: Response) => {
  try {
    const [licenseTypes, totalUsers, adminUsers, totalLicenses] = await Promise.all([
      prisma.licenseType.count(),
      prisma.user.count(),
      prisma.user.count({ where: { isAdmin: true } }),
      prisma.license.count()
    ]);

    res.json({
      initialized: licenseTypes > 0,
      licenseTypes,
      totalUsers,
      adminUsers,
      totalLicenses
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
