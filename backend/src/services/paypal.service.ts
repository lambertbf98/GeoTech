// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { licenseService } from './license.service';

const prisma = new PrismaClient();

// PayPal API URLs
const PAYPAL_API = config.paypal.mode === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

export class PayPalService {
  // Obtener token de acceso de PayPal
  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(
      `${config.paypal.clientId}:${config.paypal.clientSecret}`
    ).toString('base64');

    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error('Error al obtener token de PayPal');
    }

    const data = await response.json();
    return data.access_token;
  }

  // Crear orden de PayPal
  async createOrder(userId: string, licenseTypeId: string) {
    // Obtener tipo de licencia
    const licenseType = await prisma.licenseType.findUnique({
      where: { id: licenseTypeId }
    });

    if (!licenseType) {
      throw new Error('Tipo de licencia no encontrado');
    }

    if (!licenseType.isActive) {
      throw new Error('Este tipo de licencia no esta disponible');
    }

    const accessToken = await this.getAccessToken();

    // Crear orden en PayPal
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: `${userId}_${licenseTypeId}`,
          description: `Licencia GeoTech - ${licenseType.name}`,
          amount: {
            currency_code: 'EUR',
            value: licenseType.price.toString()
          }
        }],
        application_context: {
          brand_name: 'GeoTech',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${config.app.backendUrl}/api/payments/success`,
          cancel_url: `${config.app.backendUrl}/api/payments/cancel`
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PayPal error:', errorData);
      throw new Error('Error al crear orden de PayPal');
    }

    const order = await response.json();

    // Guardar pago pendiente en BD
    await prisma.payment.create({
      data: {
        userId,
        licenseTypeId,
        paypalOrderId: order.id,
        amount: licenseType.price,
        currency: 'EUR',
        status: 'pending'
      }
    });

    // Buscar link de aprobacion
    const approvalLink = order.links.find((link: any) => link.rel === 'approve');

    return {
      orderId: order.id,
      approvalUrl: approvalLink?.href,
      status: order.status
    };
  }

  // Capturar pago despues de aprobacion
  async captureOrder(orderId: string) {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PayPal capture error:', errorData);
      throw new Error('Error al capturar pago de PayPal');
    }

    const captureData = await response.json();

    // Buscar pago en BD
    const payment = await prisma.payment.findUnique({
      where: { paypalOrderId: orderId },
      include: { licenseType: true }
    });

    if (!payment) {
      throw new Error('Pago no encontrado');
    }

    if (captureData.status === 'COMPLETED') {
      // Obtener payer ID
      const payerId = captureData.payer?.payer_id || '';

      // Crear licencia para el usuario
      const license = await licenseService.createLicense(
        payment.licenseTypeId,
        payment.userId
      );

      // Actualizar pago
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          paypalPayerId: payerId,
          licenseKeyGenerated: license.licenseKey
        }
      });

      return {
        success: true,
        message: 'Pago completado correctamente',
        license: {
          licenseKey: license.licenseKey,
          type: license.licenseType.name,
          expiresAt: license.expiresAt
        }
      };
    } else {
      // Actualizar estado del pago
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' }
      });

      throw new Error('El pago no se completo correctamente');
    }
  }

  // Verificar webhook de PayPal
  async verifyWebhook(headers: any, body: string): Promise<boolean> {
    if (!config.paypal.webhookId) {
      console.warn('Webhook ID no configurado, omitiendo verificacion');
      return true;
    }

    const accessToken = await this.getAccessToken();

    const response = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: config.paypal.webhookId,
        webhook_event: JSON.parse(body)
      })
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.verification_status === 'SUCCESS';
  }

  // Procesar evento de webhook
  async handleWebhookEvent(event: any) {
    const eventType = event.event_type;

    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          // El pago ya fue capturado, solo actualizar si es necesario
          const payment = await prisma.payment.findUnique({
            where: { paypalOrderId: orderId }
          });

          if (payment && payment.status === 'pending') {
            await this.captureOrder(orderId);
          }
        }
        break;

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REFUNDED':
        const refundOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
        if (refundOrderId) {
          await prisma.payment.update({
            where: { paypalOrderId: refundOrderId },
            data: { status: eventType === 'PAYMENT.CAPTURE.REFUNDED' ? 'refunded' : 'failed' }
          });
        }
        break;
    }
  }

  // Obtener historial de pagos del usuario
  async getUserPayments(userId: string) {
    return prisma.payment.findMany({
      where: { userId },
      include: { licenseType: true },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const paypalService = new PayPalService();
