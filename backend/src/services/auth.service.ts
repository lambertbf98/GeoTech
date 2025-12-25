import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

interface TokenPayload {
  userId: string;
}

export class AuthService {
  async register(email: string, password: string, name: string) {
    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('El email ya está registrado', 400, 'EMAIL_EXISTS');
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    // Generar tokens
    const { token, refreshToken } = await this.generateTokens(user.id);

    return { user, token, refreshToken };
  }

  async login(email: string, password: string) {
    // Buscar usuario
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
    }

    // Verificar contraseña
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
    }

    // Generar tokens
    const { token, refreshToken } = await this.generateTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token,
      refreshToken
    };
  }

  async refreshToken(refreshTokenValue: string) {
    // Buscar refresh token
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
      include: { user: true }
    });

    if (!storedToken) {
      throw new AppError('Refresh token inválido', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Verificar expiración
    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new AppError('Refresh token expirado', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    // Eliminar token usado
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Generar nuevos tokens
    const { token, refreshToken } = await this.generateTokens(storedToken.userId);

    return {
      user: {
        id: storedToken.user.id,
        email: storedToken.user.email,
        name: storedToken.user.name
      },
      token,
      refreshToken
    };
  }

  async logout(refreshTokenValue: string) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshTokenValue }
    });
  }

  private async generateTokens(userId: string) {
    // JWT token
    const token = jwt.sign(
      { userId },
      config.jwt.secret as jwt.Secret,
      { expiresIn: config.jwt.expiresIn as string }
    );

    // Refresh token
    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 días

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt
      }
    });

    return { token, refreshToken };
  }
}

export const authService = new AuthService();
