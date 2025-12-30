// @ts-nocheck
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();

// Email del administrador (solo uno)
const ADMIN_EMAILS = [
  'gfmemorieswork@gmail.com'
];

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

    // 2. Configurar usuarios admin
    for (const adminEmail of ADMIN_EMAILS) {
      const existingUser = await prisma.user.findUnique({
        where: { email: adminEmail }
      });

      if (existingUser) {
        if (!existingUser.isAdmin) {
          await prisma.user.update({
            where: { email: adminEmail },
            data: { isAdmin: true }
          });
          results.push(`Usuario ${adminEmail} actualizado como administrador`);
        } else {
          results.push(`Usuario ${adminEmail} ya es administrador`);
        }
      } else {
        const passwordHash = await bcrypt.hash('Admin123', 10);
        await prisma.user.create({
          data: {
            email: adminEmail,
            passwordHash,
            name: 'Administrador',
            isAdmin: true
          }
        });
        results.push(`Usuario admin creado: ${adminEmail}`);
        results.push(`Password temporal: Admin123 (CAMBIALA EN /admin)`);
      }
    }

    res.json({
      success: true,
      message: 'Sistema inicializado correctamente',
      results,
      adminPanel: '/admin',
      adminEmails: ADMIN_EMAILS
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

    // Listar admins
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { email: true, name: true, isAdmin: true }
    });

    res.json({
      initialized: licenseTypes > 0,
      licenseTypes,
      totalUsers,
      adminUsers,
      totalLicenses,
      admins
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/setup/check-user/:email - Verificar estado de un usuario
router.get('/check-user/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, isAdmin: true, createdAt: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/setup/force-admin/:email - Forzar admin para un email
router.get('/force-admin/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado. Primero debe registrarse.' });
    }

    await prisma.user.update({
      where: { email },
      data: { isAdmin: true }
    });

    res.json({
      success: true,
      message: `Usuario ${email} ahora es administrador`,
      user: { email, isAdmin: true }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/setup/reset-password/:email/:newpass - Resetear contraseña
router.get('/reset-password/:email/:newpass', async (req: Request, res: Response) => {
  try {
    const { email, newpass } = req.params;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const passwordHash = await bcrypt.hash(newpass, 10);
    await prisma.user.update({
      where: { email },
      data: { passwordHash }
    });

    res.json({
      success: true,
      message: `Contraseña de ${email} actualizada`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/setup/remove-admin/:email - Quitar admin de un email
router.get('/remove-admin/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await prisma.user.update({
      where: { email },
      data: { isAdmin: false }
    });

    res.json({
      success: true,
      message: `Usuario ${email} ya no es administrador`,
      user: { email, isAdmin: false }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
