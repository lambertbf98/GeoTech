// @ts-nocheck
import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { paypalService } from '../services/paypal.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { config } from '../config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

// POST /api/payments/create-order - Crear orden de pago
router.post(
  '/create-order',
  authenticate,
  [
    body('licenseTypeId').notEmpty().withMessage('El tipo de licencia es requerido')
  ],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { licenseTypeId } = req.body;
      const order = await paypalService.createOrder(req.userId!, licenseTypeId);
      res.json(order);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/payments/capture - Capturar pago despues de aprobacion
router.post(
  '/capture',
  authenticate,
  [
    body('orderId').notEmpty().withMessage('El ID de orden es requerido')
  ],
  validate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.body;
      const result = await paypalService.captureOrder(orderId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/payments/success - Redirect desde PayPal tras pago exitoso
router.get(
  '/success',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, PayerID } = req.query; // PayPal envia el orderId como 'token'

      console.log('PayPal success callback:', { token, PayerID, query: req.query });
      console.log('Redirecting to:', `${config.app.frontendUrl}/tabs/settings?payment=success`);

      if (token) {
        // Capturar el pago
        const result = await paypalService.captureOrder(token as string);
        console.log('Payment captured successfully:', result);
      }

      // Redirigir a la app con exito
      res.redirect(`${config.app.frontendUrl}/tabs/settings?payment=success`);
    } catch (error: any) {
      console.error('Error en success callback:', error?.message || error);
      res.redirect(`${config.app.frontendUrl}/tabs/settings?payment=error&reason=${encodeURIComponent(error?.message || 'unknown')}`);
    }
  }
);

// GET /api/payments/cancel - Redirect desde PayPal tras cancelacion
router.get(
  '/cancel',
  async (req: Request, res: Response) => {
    res.redirect(`${config.app.frontendUrl}/tabs/settings?payment=cancelled`);
  }
);

// POST /api/payments/webhook - Webhook de PayPal
router.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const headers = req.headers;
      const body = JSON.stringify(req.body);

      // Verificar webhook (opcional en sandbox)
      const isValid = await paypalService.verifyWebhook(headers, body);

      if (!isValid) {
        console.warn('Webhook no verificado');
      }

      // Procesar evento
      await paypalService.handleWebhookEvent(req.body);

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error en webhook:', error);
      res.status(200).json({ received: true }); // Siempre responder 200 a PayPal
    }
  }
);

// GET /api/payments/history - Obtener historial de pagos del usuario
router.get(
  '/history',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const payments = await paypalService.getUserPayments(req.userId!);
      res.json(payments);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/payments/retry-capture - Reintentar captura de pago pendiente
router.post(
  '/retry-capture',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ error: 'orderId es requerido' });
      }

      console.log('Retrying capture for order:', orderId);
      const result = await paypalService.captureOrder(orderId);
      res.json(result);
    } catch (error: any) {
      console.error('Error retrying capture:', error?.message || error);
      res.status(400).json({ error: error?.message || 'Error al capturar pago' });
    }
  }
);

// ==================== RUTAS DE ADMIN ====================

// POST /api/payments/admin/test-email - Probar envío de email (admin)
// IMPORTANTE: Esta ruta debe estar ANTES de /admin/:id para evitar conflictos
router.post(
  '/admin/test-email',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { emailService } = await import('../services/email.service');
      const { invoiceService } = await import('../services/invoice.service');

      // Verificar configuración de Resend
      const resendConfigured = await emailService.verifyConnection();

      if (!resendConfigured) {
        return res.json({
          success: false,
          message: 'Resend no configurado. Verifica la variable RESEND_API_KEY',
          debug: {
            apiKeySet: !!process.env.RESEND_API_KEY,
            apiKeyLength: process.env.RESEND_API_KEY?.length || 0,
            apiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 8) || 'N/A'
          }
        });
      }

      // Enviar email de prueba
      const targetEmail = req.body.email;
      if (!targetEmail) {
        return res.json({
          success: true,
          message: 'Resend configurado. Envía un email con: { "email": "tu@email.com" }',
          debug: {
            apiKeySet: true,
            apiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 8)
          }
        });
      }

      // Generar factura de prueba
      const testData = {
        user: { name: 'Test User', email: targetEmail },
        licenseType: { name: 'Test License', price: 9.99, durationDays: 30 },
        licenseKey: 'TEST-XXXX-XXXX-XXXX',
        transactionId: 'TEST-TRANSACTION-123'
      };

      const invoiceData = invoiceService.createInvoiceData(testData);
      const pdfBuffer = await invoiceService.generateInvoicePDF(invoiceData);

      const sent = await emailService.sendLicensePurchaseEmail({
        to: targetEmail,
        customerName: 'Test User',
        licenseType: 'Test License',
        licenseKey: 'TEST-XXXX-XXXX-XXXX',
        licenseDuration: '30 dias',
        price: 9.99,
        transactionId: 'TEST-TRANSACTION-123',
        invoicePdf: pdfBuffer,
        invoiceNumber: invoiceData.invoiceNumber
      });

      res.json({
        success: sent,
        message: sent ? `Email enviado a ${targetEmail}` : 'Error enviando email - revisa los logs del servidor',
        invoiceNumber: invoiceData.invoiceNumber
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  }
);

// GET /api/payments/admin/all - Obtener todos los pagos (admin)
router.get(
  '/admin/all',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (status && status !== 'all') {
        where.status = status;
      }

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip,
          take: limit,
          include: {
            user: { select: { id: true, email: true, name: true } },
            licenseType: { select: { id: true, name: true, price: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.payment.count({ where })
      ]);

      // Calcular totales por estado
      const [totalCompleted, totalPending, totalFailed, totalRefunded] = await Promise.all([
        prisma.payment.aggregate({ where: { status: 'completed' }, _sum: { amount: true }, _count: true }),
        prisma.payment.aggregate({ where: { status: 'pending' }, _sum: { amount: true }, _count: true }),
        prisma.payment.aggregate({ where: { status: 'failed' }, _sum: { amount: true }, _count: true }),
        prisma.payment.aggregate({ where: { status: 'refunded' }, _sum: { amount: true }, _count: true })
      ]);

      res.json({
        payments,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: {
          completed: { count: totalCompleted._count, amount: totalCompleted._sum.amount || 0 },
          pending: { count: totalPending._count, amount: totalPending._sum.amount || 0 },
          failed: { count: totalFailed._count, amount: totalFailed._sum.amount || 0 },
          refunded: { count: totalRefunded._count, amount: totalRefunded._sum.amount || 0 }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/payments/admin/capture/:orderId - Capturar pago pendiente (admin)
router.post(
  '/admin/capture/:orderId',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      console.log('Admin capturing payment for order:', orderId);

      const result = await paypalService.captureOrder(orderId);
      res.json(result);
    } catch (error: any) {
      console.error('Error capturing payment:', error?.message || error);
      res.status(400).json({ error: error?.message || 'Error al capturar pago' });
    }
  }
);

// PUT /api/payments/admin/:id/status - Actualizar estado de pago manualmente (admin)
router.put(
  '/admin/:id/status',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['pending', 'completed', 'failed', 'refunded', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Estado no valido' });
      }

      const payment = await prisma.payment.update({
        where: { id },
        data: { status }
      });

      res.json({ success: true, payment });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/payments/admin/:id - Obtener detalle de pago (admin)
router.get(
  '/admin/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, email: true, name: true } },
          licenseType: true
        }
      });

      if (!payment) {
        return res.status(404).json({ error: 'Pago no encontrado' });
      }

      res.json({ payment });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/payments/admin/approve/:id - Aprobar pago pendiente y activar licencia (admin)
router.post(
  '/admin/approve/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Obtener el pago
      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          user: true,
          licenseType: true
        }
      });

      if (!payment) {
        return res.status(404).json({ error: 'Pago no encontrado' });
      }

      if (payment.status === 'COMPLETED') {
        return res.status(400).json({ error: 'Este pago ya fue completado' });
      }

      // Generar clave de licencia
      const licenseKey = `GT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Calcular fecha de expiración
      let expiresAt = new Date();
      if (payment.licenseType.durationHours && payment.licenseType.durationHours > 0) {
        expiresAt = new Date(Date.now() + payment.licenseType.durationHours * 60 * 60 * 1000);
      } else {
        expiresAt = new Date(Date.now() + (payment.licenseType.durationDays || 30) * 24 * 60 * 60 * 1000);
      }

      // Crear licencia y actualizar pago en transacción
      const [license] = await prisma.$transaction([
        prisma.license.create({
          data: {
            licenseKey,
            userId: payment.userId,
            licenseTypeId: payment.licenseTypeId,
            status: 'ACTIVE',
            expiresAt,
            activatedAt: new Date()
          }
        }),
        prisma.payment.update({
          where: { id },
          data: { status: 'COMPLETED' }
        })
      ]);

      res.json({
        success: true,
        message: 'Pago aprobado y licencia activada',
        license: {
          id: license.id,
          licenseKey: license.licenseKey,
          expiresAt: license.expiresAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/payments/admin/cancel/:id - Cancelar pago pendiente (admin)
router.post(
  '/admin/cancel/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const payment = await prisma.payment.findUnique({
        where: { id }
      });

      if (!payment) {
        return res.status(404).json({ error: 'Pago no encontrado' });
      }

      if (payment.status === 'COMPLETED') {
        return res.status(400).json({ error: 'No se puede cancelar un pago completado' });
      }

      await prisma.payment.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });

      res.json({ success: true, message: 'Pago cancelado' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
