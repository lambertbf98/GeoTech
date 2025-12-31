// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { licenseService } from './license.service';
import { invoiceService } from './invoice.service';
import { emailService } from './email.service';

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

    // Log URLs para debug
    console.log('PayPal return URLs:', {
      return_url: `${config.app.backendUrl}/api/payments/success`,
      cancel_url: `${config.app.backendUrl}/api/payments/cancel`,
      backendUrl: config.app.backendUrl
    });

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

      // Obtener datos del usuario
      const user = await prisma.user.findUnique({
        where: { id: payment.userId }
      });

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

      // Generar y enviar factura por email (asíncrono, no bloquea respuesta)
      console.log('📧 Iniciando envío de factura a:', user?.email);
      this.sendInvoiceEmail(user, payment, license).catch(err => {
        console.error('❌ Error enviando factura por email:', err?.message || err);
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

  // Generar y enviar factura por email
  private async sendInvoiceEmail(user: any, payment: any, license: any) {
    console.log('📧 sendInvoiceEmail llamado con:', {
      userEmail: user?.email,
      paymentId: payment?.id,
      licenseKey: license?.licenseKey
    });

    if (!user?.email) {
      console.warn('⚠️ No se puede enviar factura: usuario sin email');
      return;
    }

    try {
      // Calcular duración para mostrar
      let licenseDuration = '';
      if (payment.licenseType?.durationHours && payment.licenseType.durationHours > 0) {
        licenseDuration = `${payment.licenseType.durationHours} horas`;
      } else if (payment.licenseType?.durationDays) {
        licenseDuration = `${payment.licenseType.durationDays} dias`;
      }
      console.log('📧 Duración calculada:', licenseDuration);

      // Crear datos de factura
      const invoiceData = invoiceService.createInvoiceData({
        user: {
          name: user.name || user.email.split('@')[0],
          email: user.email
        },
        licenseType: {
          name: payment.licenseType.name,
          price: payment.amount,
          durationDays: payment.licenseType.durationDays,
          durationHours: payment.licenseType.durationHours
        },
        licenseKey: license.licenseKey,
        transactionId: payment.paypalOrderId
      });

      // Generar PDF de factura
      const pdfBuffer = await invoiceService.generateInvoicePDF(invoiceData);

      // Enviar email con factura adjunta
      await emailService.sendLicensePurchaseEmail({
        to: user.email,
        customerName: user.name || user.email.split('@')[0],
        licenseType: payment.licenseType.name,
        licenseKey: license.licenseKey,
        licenseDuration,
        price: payment.amount,
        transactionId: payment.paypalOrderId,
        invoicePdf: pdfBuffer,
        invoiceNumber: invoiceData.invoiceNumber
      });

      console.log(`✅ Factura enviada a ${user.email} para licencia ${license.licenseKey}`);
    } catch (error) {
      console.error('Error generando/enviando factura:', error);
      // No lanzamos error para no afectar el flujo de pago
    }
  }
}

export const paypalService = new PayPalService();
