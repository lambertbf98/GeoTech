import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Generar clave de licencia única
function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return segments.join('-'); // Formato: XXXX-XXXX-XXXX-XXXX
}

export class LicenseService {
  // Obtener licencia activa del usuario
  async getActiveLicense(userId: string) {
    const now = new Date();

    const license = await prisma.license.findFirst({
      where: {
        userId,
        status: 'active',
        expiresAt: { gt: now }
      },
      include: {
        licenseType: true
      },
      orderBy: {
        expiresAt: 'desc'
      }
    });

    return license;
  }

  // Verificar si usuario tiene licencia válida
  async hasValidLicense(userId: string): Promise<boolean> {
    const license = await this.getActiveLicense(userId);
    return !!license;
  }

  // Activar licencia con clave
  async activateLicense(userId: string, licenseKey: string) {
    // Buscar licencia por clave
    const license = await prisma.license.findUnique({
      where: { licenseKey },
      include: { licenseType: true }
    });

    if (!license) {
      throw new Error('Clave de licencia no válida');
    }

    if (license.userId && license.userId !== userId) {
      throw new Error('Esta licencia ya está asignada a otro usuario');
    }

    if (license.status === 'revoked') {
      throw new Error('Esta licencia ha sido revocada');
    }

    if (license.status === 'expired' || new Date() > license.expiresAt) {
      throw new Error('Esta licencia ha expirado');
    }

    // Activar la licencia para este usuario
    const updatedLicense = await prisma.license.update({
      where: { id: license.id },
      data: {
        userId,
        status: 'active',
        activatedAt: new Date()
      },
      include: { licenseType: true }
    });

    return updatedLicense;
  }

  // Crear nueva licencia (para admin o después de pago)
  async createLicense(licenseTypeId: string, userId?: string) {
    const licenseType = await prisma.licenseType.findUnique({
      where: { id: licenseTypeId }
    });

    if (!licenseType) {
      throw new Error('Tipo de licencia no encontrado');
    }

    const licenseKey = generateLicenseKey();
    const now = new Date();
    // Calcular expiracion: si hay horas, usar horas; si no, usar dias
    let durationMs: number;
    if (licenseType.durationHours && licenseType.durationHours > 0) {
      durationMs = licenseType.durationHours * 60 * 60 * 1000; // horas a ms
    } else {
      durationMs = (licenseType.durationDays || 1) * 24 * 60 * 60 * 1000; // dias a ms
    }
    const expiresAt = new Date(now.getTime() + durationMs);

    const license = await prisma.license.create({
      data: {
        licenseKey,
        licenseTypeId,
        userId: userId || '',
        status: userId ? 'active' : 'pending',
        activatedAt: userId ? now : now,
        expiresAt
      },
      include: { licenseType: true }
    });

    return license;
  }

  // Obtener todos los tipos de licencia activos
  async getLicenseTypes() {
    return prisma.licenseType.findMany({
      where: { isActive: true },
      orderBy: { durationDays: 'asc' }
    });
  }

  // ADMIN: Obtener todas las licencias
  async getAllLicenses(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true } },
          licenseType: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.license.count()
    ]);

    return { licenses, total, page, limit };
  }

  // ADMIN: Crear tipo de licencia
  async createLicenseType(data: {
    name: string;
    code: string;
    durationDays?: number;
    durationHours?: number;
    price: number;
    description?: string;
  }) {
    return prisma.licenseType.create({
      data: {
        name: data.name,
        code: data.code,
        durationDays: data.durationDays || 0,
        durationHours: data.durationHours || 0,
        price: data.price,
        description: data.description
      }
    });
  }

  // ADMIN: Actualizar tipo de licencia
  async updateLicenseType(id: string, data: {
    name?: string;
    durationDays?: number;
    durationHours?: number;
    price?: number;
    promoPrice?: number | null;
    promoEndsAt?: Date | string | null;
    description?: string;
    isActive?: boolean;
  }) {
    // Convertir promoEndsAt a Date si es string
    const updateData: any = { ...data };
    if (data.promoEndsAt && typeof data.promoEndsAt === 'string') {
      updateData.promoEndsAt = new Date(data.promoEndsAt);
    }

    return prisma.licenseType.update({
      where: { id },
      data: updateData
    });
  }

  // ADMIN: Revocar licencia
  async revokeLicense(licenseId: string) {
    return prisma.license.update({
      where: { id: licenseId },
      data: { status: 'revoked' }
    });
  }

  // ADMIN: Obtener estadísticas
  async getStats() {
    const now = new Date();

    const [
      totalUsers,
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      totalRevenue,
      recentPayments
    ] = await Promise.all([
      prisma.user.count(),
      prisma.license.count(),
      prisma.license.count({
        where: { status: 'active', expiresAt: { gt: now } }
      }),
      prisma.license.count({
        where: {
          OR: [
            { status: 'expired' },
            { expiresAt: { lt: now } }
          ]
        }
      }),
      prisma.payment.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true }
      }),
      prisma.payment.findMany({
        where: { status: 'completed' },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, name: true } },
          licenseType: { select: { name: true } }
        }
      })
    ]);

    return {
      totalUsers,
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      totalRevenue: totalRevenue._sum.amount || 0,
      recentPayments
    };
  }

  // Actualizar licencias expiradas (cron job)
  async updateExpiredLicenses() {
    const now = new Date();

    await prisma.license.updateMany({
      where: {
        status: 'active',
        expiresAt: { lt: now }
      },
      data: { status: 'expired' }
    });
  }

  // ADMIN: Obtener todos los usuarios con su estado de licencia
  async getAllUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const now = new Date();

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          createdAt: true,
          licenses: {
            where: {
              status: 'active',
              expiresAt: { gt: now }
            },
            include: { licenseType: true },
            orderBy: { expiresAt: 'desc' },
            take: 1
          },
          _count: {
            select: { projects: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count()
    ]);

    return { users, total, page, limit };
  }

  // ADMIN: Obtener detalle de usuario con proyectos
  async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
        licenses: {
          include: { licenseType: true },
          orderBy: { createdAt: 'desc' }
        },
        projects: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            _count: {
              select: { photos: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return user;
  }

  // ADMIN: Cambiar contrasena de usuario
  async updateUserPassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
  }

  // ADMIN: Cambiar rol de admin
  async updateUserAdmin(userId: string, isAdmin: boolean) {
    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin }
    });
  }

  // ADMIN: Eliminar usuario y todos sus datos
  async deleteUser(userId: string) {
    // Prisma cascade delete eliminara proyectos, fotos, licencias, etc.
    await prisma.user.delete({
      where: { id: userId }
    });
  }
}

export const licenseService = new LicenseService();
