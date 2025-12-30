// @ts-nocheck
import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { paypalService } from '../services/paypal.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { config } from '../config';

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
      const { token } = req.query; // PayPal envia el orderId como 'token'

      if (token) {
        // Capturar el pago
        await paypalService.captureOrder(token as string);
      }

      // Redirigir a la app con exito
      res.redirect(`${config.app.frontendUrl}/tabs/settings?payment=success`);
    } catch (error) {
      console.error('Error en success callback:', error);
      res.redirect(`${config.app.frontendUrl}/tabs/settings?payment=error`);
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

export default router;
