import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Browser } from '@capacitor/browser';

export interface LicenseType {
  id: string;
  name: string;
  code: string;
  durationDays: number;
  price: number;
  description?: string;
  isActive: boolean;
}

export interface License {
  id: string;
  licenseKey: string;
  type: string;
  status: string;
  expiresAt: string;
  daysRemaining: number;
}

export interface LicenseStatus {
  hasValidLicense: boolean;
  license: License | null;
}

@Injectable({
  providedIn: 'root'
})
export class LicenseService {
  private apiUrl = environment.apiUrl;
  private licenseStatusSubject = new BehaviorSubject<LicenseStatus>({
    hasValidLicense: false,
    license: null
  });

  licenseStatus$ = this.licenseStatusSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Verificar estado de licencia del usuario
  async checkLicenseStatus(): Promise<LicenseStatus> {
    // No hacer petición si no hay token guardado
    const token = localStorage.getItem('token');
    if (!token) {
      const noLicense = { hasValidLicense: false, license: null };
      this.licenseStatusSubject.next(noLicense);
      return noLicense;
    }

    try {
      const status = await firstValueFrom(
        this.http.get<LicenseStatus>(`${this.apiUrl}/licenses/status`)
      );
      this.licenseStatusSubject.next(status);
      return status;
    } catch (error: any) {
      // No mostrar error 401 en consola - es manejado por el interceptor
      if (error?.status !== 401) {
        console.error('Error checking license status:', error);
      }
      const noLicense = { hasValidLicense: false, license: null };
      this.licenseStatusSubject.next(noLicense);
      return noLicense;
    }
  }

  // Obtener estado actual de licencia (sin llamar API)
  getCurrentStatus(): LicenseStatus {
    return this.licenseStatusSubject.value;
  }

  // Verificar si tiene licencia valida
  hasValidLicense(): boolean {
    return this.licenseStatusSubject.value.hasValidLicense;
  }

  // Activar licencia con clave
  async activateLicense(licenseKey: string): Promise<{ success: boolean; message: string; license?: any }> {
    const result = await firstValueFrom(
      this.http.post<{ success: boolean; message: string; license?: any }>(
        `${this.apiUrl}/licenses/activate`,
        { licenseKey }
      )
    );

    // Actualizar estado
    await this.checkLicenseStatus();
    return result;
  }

  // Obtener tipos de licencia disponibles
  async getLicenseTypes(): Promise<LicenseType[]> {
    return firstValueFrom(
      this.http.get<LicenseType[]>(`${this.apiUrl}/licenses/types`)
    );
  }

  // Crear orden de pago
  async createPaymentOrder(licenseTypeId: string): Promise<{ orderId: string; approvalUrl: string }> {
    return firstValueFrom(
      this.http.post<{ orderId: string; approvalUrl: string }>(
        `${this.apiUrl}/payments/create-order`,
        { licenseTypeId }
      )
    );
  }

  // Iniciar proceso de compra (abre navegador con PayPal)
  async purchaseLicense(licenseTypeId: string): Promise<void> {
    const order = await this.createPaymentOrder(licenseTypeId);

    if (order.approvalUrl) {
      // Abrir PayPal en navegador externo
      await Browser.open({ url: order.approvalUrl });
    }
  }

  // Capturar pago (llamado despues de volver de PayPal)
  async capturePayment(orderId: string): Promise<any> {
    const result = await firstValueFrom(
      this.http.post<any>(`${this.apiUrl}/payments/capture`, { orderId })
    );

    // Actualizar estado de licencia
    await this.checkLicenseStatus();
    return result;
  }

  // Obtener historial de pagos
  async getPaymentHistory(): Promise<any[]> {
    return firstValueFrom(
      this.http.get<any[]>(`${this.apiUrl}/payments/history`)
    );
  }

  // Formatear precio
  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  }

  // Formatear dias restantes
  formatDaysRemaining(days: number): string {
    if (days <= 0) return 'Expirada';
    if (days === 1) return '1 dia restante';
    return `${days} dias restantes`;
  }
}
