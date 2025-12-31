// @ts-nocheck
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  customer: {
    name: string;
    email: string;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  licenseKey: string;
  licenseDuration: string;
  paymentMethod: string;
  transactionId: string;
}

interface CompanyInfo {
  name: string;
  tagline: string;
  address: string;
  email: string;
  website: string;
  phone: string;
  taxId: string;
}

const COMPANY: CompanyInfo = {
  name: 'GeoTech Solutions',
  tagline: 'Soluciones de Ingenieria Civil',
  address: 'Calle Tecnologia 123, 28001 Madrid, Espana',
  email: 'info@geotech.app',
  website: 'www.geotech.app',
  phone: '+34 900 000 000',
  taxId: 'B12345678'
};

// Colores de la marca
const COLORS = {
  primary: '#3b82f6',      // Azul principal
  primaryDark: '#1e40af',  // Azul oscuro
  secondary: '#0f172a',    // Fondo oscuro
  accent: '#10b981',       // Verde exito
  text: '#1f2937',         // Texto principal
  textLight: '#6b7280',    // Texto secundario
  border: '#e5e7eb',       // Bordes
  background: '#f9fafb'    // Fondo claro
};

export class InvoiceService {
  /**
   * Genera un numero de factura unico
   */
  generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `GT-${year}${month}-${random}`;
  }

  /**
   * Genera el PDF de la factura
   */
  async generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Factura ${data.invoiceNumber}`,
            Author: COMPANY.name,
            Subject: 'Factura de Licencia',
            Keywords: 'factura, licencia, geotech'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // === HEADER ===
        this.drawHeader(doc, data);

        // === DATOS DEL CLIENTE ===
        this.drawCustomerInfo(doc, data);

        // === TABLA DE ITEMS ===
        this.drawItemsTable(doc, data);

        // === TOTALES ===
        this.drawTotals(doc, data);

        // === INFO DE LICENCIA ===
        this.drawLicenseInfo(doc, data);

        // === FOOTER ===
        this.drawFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private drawHeader(doc: PDFKit.PDFDocument, data: InvoiceData) {
    const pageWidth = doc.page.width - 100;

    // Logo/Nombre de empresa
    doc.fontSize(28)
       .fillColor(COLORS.primary)
       .font('Helvetica-Bold')
       .text(COMPANY.name, 50, 50);

    doc.fontSize(10)
       .fillColor(COLORS.textLight)
       .font('Helvetica')
       .text(COMPANY.tagline, 50, 82);

    // Titulo FACTURA
    doc.fontSize(24)
       .fillColor(COLORS.secondary)
       .font('Helvetica-Bold')
       .text('FACTURA', 400, 50, { align: 'right' });

    // Numero de factura y fecha
    doc.fontSize(10)
       .fillColor(COLORS.text)
       .font('Helvetica')
       .text(`No: ${data.invoiceNumber}`, 400, 80, { align: 'right' })
       .text(`Fecha: ${this.formatDate(data.date)}`, 400, 95, { align: 'right' });

    // Linea separadora
    doc.moveTo(50, 120)
       .lineTo(pageWidth + 50, 120)
       .strokeColor(COLORS.border)
       .lineWidth(1)
       .stroke();
  }

  private drawCustomerInfo(doc: PDFKit.PDFDocument, data: InvoiceData) {
    const startY = 140;

    // Columna izquierda - Empresa
    doc.fontSize(10)
       .fillColor(COLORS.textLight)
       .font('Helvetica-Bold')
       .text('DE:', 50, startY);

    doc.fontSize(10)
       .fillColor(COLORS.text)
       .font('Helvetica')
       .text(COMPANY.name, 50, startY + 15)
       .text(COMPANY.address, 50, startY + 30)
       .text(`CIF: ${COMPANY.taxId}`, 50, startY + 45)
       .text(COMPANY.email, 50, startY + 60);

    // Columna derecha - Cliente
    doc.fontSize(10)
       .fillColor(COLORS.textLight)
       .font('Helvetica-Bold')
       .text('FACTURAR A:', 350, startY);

    doc.fontSize(10)
       .fillColor(COLORS.text)
       .font('Helvetica')
       .text(data.customer.name, 350, startY + 15)
       .text(data.customer.email, 350, startY + 30);

    // Info de pago
    doc.fontSize(10)
       .fillColor(COLORS.textLight)
       .font('Helvetica-Bold')
       .text('METODO DE PAGO:', 350, startY + 55);

    doc.fontSize(10)
       .fillColor(COLORS.text)
       .font('Helvetica')
       .text(data.paymentMethod, 350, startY + 70)
       .text(`ID: ${data.transactionId}`, 350, startY + 85);
  }

  private drawItemsTable(doc: PDFKit.PDFDocument, data: InvoiceData) {
    const tableTop = 270;
    const pageWidth = doc.page.width - 100;

    // Cabecera de tabla
    doc.rect(50, tableTop, pageWidth, 25)
       .fillColor(COLORS.primary)
       .fill();

    doc.fontSize(10)
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .text('DESCRIPCION', 60, tableTop + 8)
       .text('CANT.', 320, tableTop + 8)
       .text('PRECIO', 380, tableTop + 8)
       .text('TOTAL', 480, tableTop + 8, { align: 'right', width: 65 });

    // Filas de items
    let y = tableTop + 35;
    data.items.forEach((item, index) => {
      const isEven = index % 2 === 0;

      if (isEven) {
        doc.rect(50, y - 5, pageWidth, 25)
           .fillColor(COLORS.background)
           .fill();
      }

      doc.fontSize(10)
         .fillColor(COLORS.text)
         .font('Helvetica')
         .text(item.description, 60, y)
         .text(item.quantity.toString(), 320, y)
         .text(this.formatCurrency(item.unitPrice), 380, y)
         .text(this.formatCurrency(item.total), 480, y, { align: 'right', width: 65 });

      y += 25;
    });

    // Linea debajo de items
    doc.moveTo(50, y + 5)
       .lineTo(pageWidth + 50, y + 5)
       .strokeColor(COLORS.border)
       .lineWidth(1)
       .stroke();
  }

  private drawTotals(doc: PDFKit.PDFDocument, data: InvoiceData) {
    const startY = 360;
    const rightX = 380;

    // Subtotal
    doc.fontSize(10)
       .fillColor(COLORS.textLight)
       .font('Helvetica')
       .text('Subtotal:', rightX, startY)
       .fillColor(COLORS.text)
       .text(this.formatCurrency(data.subtotal), 480, startY, { align: 'right', width: 65 });

    // IVA
    doc.fillColor(COLORS.textLight)
       .text(`IVA (${data.taxRate}%):`, rightX, startY + 20)
       .fillColor(COLORS.text)
       .text(this.formatCurrency(data.tax), 480, startY + 20, { align: 'right', width: 65 });

    // Linea
    doc.moveTo(rightX, startY + 40)
       .lineTo(545, startY + 40)
       .strokeColor(COLORS.border)
       .lineWidth(1)
       .stroke();

    // Total
    doc.rect(rightX - 10, startY + 45, 175, 30)
       .fillColor(COLORS.primary)
       .fill();

    doc.fontSize(12)
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .text('TOTAL:', rightX, startY + 53)
       .text(this.formatCurrency(data.total), 480, startY + 53, { align: 'right', width: 65 });
  }

  private drawLicenseInfo(doc: PDFKit.PDFDocument, data: InvoiceData) {
    const startY = 460;
    const pageWidth = doc.page.width - 100;

    // Caja de licencia
    doc.rect(50, startY, pageWidth, 80)
       .fillColor('#f0fdf4')  // Verde muy claro
       .fill();

    doc.rect(50, startY, pageWidth, 80)
       .strokeColor(COLORS.accent)
       .lineWidth(1)
       .stroke();

    // Icono de check (simulado con texto)
    doc.fontSize(20)
       .fillColor(COLORS.accent)
       .text('✓', 65, startY + 25);

    // Titulo
    doc.fontSize(14)
       .fillColor(COLORS.text)
       .font('Helvetica-Bold')
       .text('Licencia Activada', 95, startY + 15);

    // Clave de licencia
    doc.fontSize(18)
       .fillColor(COLORS.primary)
       .font('Helvetica-Bold')
       .text(data.licenseKey, 95, startY + 38);

    // Duracion
    doc.fontSize(10)
       .fillColor(COLORS.textLight)
       .font('Helvetica')
       .text(`Duracion: ${data.licenseDuration}`, 95, startY + 60);
  }

  private drawFooter(doc: PDFKit.PDFDocument) {
    const pageWidth = doc.page.width - 100;
    const footerY = doc.page.height - 100;

    // Linea separadora
    doc.moveTo(50, footerY - 20)
       .lineTo(pageWidth + 50, footerY - 20)
       .strokeColor(COLORS.border)
       .lineWidth(1)
       .stroke();

    // Mensaje de agradecimiento
    doc.fontSize(12)
       .fillColor(COLORS.primary)
       .font('Helvetica-Bold')
       .text('Gracias por confiar en GeoTech!', 50, footerY, { align: 'center', width: pageWidth });

    // Info de contacto
    doc.fontSize(9)
       .fillColor(COLORS.textLight)
       .font('Helvetica')
       .text(`${COMPANY.website} | ${COMPANY.email} | ${COMPANY.phone}`, 50, footerY + 20, { align: 'center', width: pageWidth });

    // Nota legal
    doc.fontSize(8)
       .text('Esta factura es un documento valido a efectos fiscales.', 50, footerY + 40, { align: 'center', width: pageWidth });
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  /**
   * Crea los datos de factura a partir de la info del pago
   */
  createInvoiceData(paymentData: {
    user: { name: string; email: string };
    licenseType: { name: string; price: number; durationDays?: number; durationHours?: number };
    licenseKey: string;
    transactionId: string;
  }): InvoiceData {
    const price = Number(paymentData.licenseType.price);
    const taxRate = 21; // IVA Espana
    const subtotal = price / (1 + taxRate / 100); // Precio sin IVA
    const tax = price - subtotal;

    // Calcular duracion
    let duration = '';
    if (paymentData.licenseType.durationHours && paymentData.licenseType.durationHours > 0) {
      duration = `${paymentData.licenseType.durationHours} horas`;
    } else if (paymentData.licenseType.durationDays) {
      duration = `${paymentData.licenseType.durationDays} dias`;
    }

    return {
      invoiceNumber: this.generateInvoiceNumber(),
      date: new Date(),
      customer: {
        name: paymentData.user.name || 'Cliente',
        email: paymentData.user.email
      },
      items: [{
        description: `Licencia GeoTech - ${paymentData.licenseType.name}`,
        quantity: 1,
        unitPrice: price,
        total: price
      }],
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      taxRate,
      total: price,
      licenseKey: paymentData.licenseKey,
      licenseDuration: duration,
      paymentMethod: 'PayPal',
      transactionId: paymentData.transactionId
    };
  }
}

export const invoiceService = new InvoiceService();
