// @ts-nocheck
import { Resend } from 'resend';

interface LicensePurchaseEmail {
  to: string;
  customerName: string;
  licenseType: string;
  licenseKey: string;
  licenseDuration: string;
  price: number;
  transactionId: string;
  invoicePdf: Buffer;
  invoiceNumber: string;
}

const COMPANY = {
  name: 'GeoTech Solutions',
  email: 'onboarding@resend.dev', // Usar dominio verificado en produccion
  website: 'www.geotech.app'
};

export class EmailService {
  private resend: Resend | null = null;

  constructor() {
    this.initializeResend();
  }

  private initializeResend() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
      console.log('✅ Resend email service initialized');
    } else {
      console.warn('⚠️ Email service not configured. Set RESEND_API_KEY in environment.');
    }
  }

  /**
   * Verifica si Resend esta configurado
   */
  async verifyConnection(): Promise<boolean> {
    // Intentar reinicializar si no esta configurado (por si las env vars se cargaron despues)
    if (!this.resend) {
      this.initializeResend();
    }

    if (!this.resend) {
      console.warn('Resend not initialized - RESEND_API_KEY not set');
      console.warn('Current RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'SET (length: ' + process.env.RESEND_API_KEY.length + ')' : 'NOT SET');
      return false;
    }
    console.log('✅ Resend API key configured');
    return true;
  }

  /**
   * Verifica si esta inicializado
   */
  isConfigured(): boolean {
    return this.resend !== null;
  }

  /**
   * Envia el email de confirmacion de compra con la factura adjunta
   */
  async sendLicensePurchaseEmail(data: LicensePurchaseEmail): Promise<boolean> {
    if (!this.resend) {
      console.warn('Email service not configured, skipping email send');
      return false;
    }

    const htmlContent = this.generatePurchaseEmailHtml(data);
    const textContent = this.generatePurchaseEmailText(data);

    try {
      const { data: result, error } = await this.resend.emails.send({
        from: `${COMPANY.name} <${COMPANY.email}>`,
        to: data.to,
        subject: `Tu licencia GeoTech ha sido activada - ${data.invoiceNumber}`,
        text: textContent,
        html: htmlContent,
        attachments: [
          {
            filename: `Factura-${data.invoiceNumber}.pdf`,
            content: data.invoicePdf.toString('base64')
          }
        ]
      });

      if (error) {
        console.error('❌ Error sending purchase email:', error);
        return false;
      }

      console.log(`✅ Purchase email sent to ${data.to}, id: ${result?.id}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending purchase email:', error);
      return false;
    }
  }

  /**
   * Genera el HTML del email de compra
   */
  private generatePurchaseEmailHtml(data: LicensePurchaseEmail): string {
    const formattedPrice = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(data.price);

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmacion de Compra - GeoTech</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">${COMPANY.name}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Soluciones de Ingenieria Civil</p>
            </td>
          </tr>

          <!-- Success Icon -->
          <tr>
            <td align="center" style="padding: 30px 30px 0 30px;">
              <div style="width: 80px; height: 80px; background-color: #10b981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px; color: white;">&#10003;</span>
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="color: #1f2937; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Gracias por tu compra!</h2>
              <p style="color: #6b7280; text-align: center; margin: 0 0 30px 0; font-size: 16px;">
                Hola <strong>${data.customerName}</strong>, tu licencia ha sido activada correctamente.
              </p>

              <!-- License Card -->
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px; text-align: center;">Tu Licencia</h3>

                <div style="background-color: #ffffff; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 15px;">
                  <p style="color: #6b7280; margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Clave de Licencia</p>
                  <p style="color: #3b82f6; margin: 0; font-size: 22px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 2px;">${data.licenseKey}</p>
                </div>

                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid rgba(16, 185, 129, 0.2);">
                      <span style="color: #6b7280; font-size: 14px;">Tipo de licencia</span>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid rgba(16, 185, 129, 0.2); text-align: right;">
                      <strong style="color: #1f2937; font-size: 14px;">${data.licenseType}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid rgba(16, 185, 129, 0.2);">
                      <span style="color: #6b7280; font-size: 14px;">Duracion</span>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid rgba(16, 185, 129, 0.2); text-align: right;">
                      <strong style="color: #1f2937; font-size: 14px;">${data.licenseDuration}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #6b7280; font-size: 14px;">Precio</span>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <strong style="color: #1f2937; font-size: 14px;">${formattedPrice}</strong>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Invoice Info -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                <p style="color: #6b7280; margin: 0; font-size: 14px; text-align: center;">
                  Adjuntamos la factura <strong>${data.invoiceNumber}</strong> en formato PDF
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center;">
                <a href="https://${COMPANY.website}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Abrir GeoTech
                </a>
              </div>
            </td>
          </tr>

          <!-- Transaction Info -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                ID de transaccion: ${data.transactionId}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0 0 10px 0;">
                Tienes alguna pregunta? Contactanos en <a href="mailto:${COMPANY.email}" style="color: #3b82f6; text-decoration: none;">${COMPANY.email}</a>
              </p>
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                ${new Date().getFullYear()} ${COMPANY.name}. Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Genera la version de texto plano del email
   */
  private generatePurchaseEmailText(data: LicensePurchaseEmail): string {
    const formattedPrice = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(data.price);

    return `
${COMPANY.name}
=====================================

Gracias por tu compra!

Hola ${data.customerName},

Tu licencia ha sido activada correctamente.

DETALLES DE LA LICENCIA
-----------------------
Clave: ${data.licenseKey}
Tipo: ${data.licenseType}
Duracion: ${data.licenseDuration}
Precio: ${formattedPrice}

Numero de factura: ${data.invoiceNumber}
ID de transaccion: ${data.transactionId}

La factura en formato PDF esta adjunta a este correo.

-------------------------------------
Tienes alguna pregunta?
Contactanos en ${COMPANY.email}

${new Date().getFullYear()} ${COMPANY.name}
${COMPANY.website}
    `.trim();
  }

  /**
   * Envia un email de prueba
   */
  async sendTestEmail(to: string): Promise<boolean> {
    if (!this.resend) {
      console.warn('Email service not configured');
      return false;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${COMPANY.name} <${COMPANY.email}>`,
        to,
        subject: 'Test Email - GeoTech',
        text: 'Este es un email de prueba del sistema GeoTech.',
        html: '<h1>Test Email</h1><p>Este es un email de prueba del sistema GeoTech.</p>'
      });

      if (error) {
        console.error('Error sending test email:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending test email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
