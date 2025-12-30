import { Injectable } from '@angular/core';
import { Platform, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class SecurityService {
  private isSecure = true;
  private securityChecked = false;

  constructor(
    private platform: Platform,
    private alertCtrl: AlertController,
    private router: Router
  ) {}

  /**
   * Ejecuta todas las verificaciones de seguridad
   */
  async performSecurityChecks(): Promise<boolean> {
    if (this.securityChecked) {
      return this.isSecure;
    }

    const checks = await Promise.all([
      this.checkRootJailbreak(),
      this.checkDebugger(),
      this.checkEmulator(),
      this.checkTampering()
    ]);

    this.isSecure = checks.every(check => check);
    this.securityChecked = true;

    if (!this.isSecure) {
      await this.handleSecurityViolation();
    }

    return this.isSecure;
  }

  /**
   * Detecta si el dispositivo tiene root (Android) o jailbreak (iOS)
   */
  private async checkRootJailbreak(): Promise<boolean> {
    if (!this.platform.is('capacitor')) {
      return true; // En web no aplica
    }

    try {
      // Verificar archivos comunes de root/jailbreak
      const suspiciousFiles = [
        // Android root
        '/system/app/Superuser.apk',
        '/system/xbin/su',
        '/system/bin/su',
        '/sbin/su',
        '/data/local/xbin/su',
        '/data/local/bin/su',
        '/data/local/su',
        // Magisk
        '/sbin/.magisk',
        '/data/adb/magisk',
        // iOS jailbreak
        '/Applications/Cydia.app',
        '/Library/MobileSubstrate/MobileSubstrate.dylib',
        '/bin/bash',
        '/usr/sbin/sshd',
        '/etc/apt',
        '/private/var/lib/apt',
        '/usr/bin/ssh'
      ];

      // En produccion, usar plugin nativo para verificar
      // Por ahora, retornamos true (seguro)
      return true;
    } catch (error) {
      console.error('Error checking root/jailbreak:', error);
      return true;
    }
  }

  /**
   * Detecta si hay un debugger conectado
   */
  private async checkDebugger(): Promise<boolean> {
    // Desactivado para web - solo alertar en apps nativas si es necesario
    // La detección de DevTools causa falsas alertas cuando el desarrollador
    // está depurando o copiando errores de la consola
    if (!this.platform.is('capacitor')) {
      return true; // En web siempre permitir
    }

    try {
      // Verificar si hay herramientas de desarrollo abiertas
      const devToolsOpen = this.detectDevTools();

      if (devToolsOpen) {
        console.warn('DevTools detectadas');
        // En producción móvil podríamos bloquear, pero por ahora permitir
        return true;
      }

      return true;
    } catch {
      return true;
    }
  }

  /**
   * Detecta si se esta ejecutando en un emulador
   */
  private async checkEmulator(): Promise<boolean> {
    if (!this.platform.is('capacitor')) {
      return true;
    }

    try {
      // Verificar caracteristicas de emulador
      const isEmulator =
        navigator.userAgent.includes('Android') &&
        (navigator.userAgent.includes('sdk') ||
         navigator.userAgent.includes('Emulator'));

      // En desarrollo permitimos emulador
      // En produccion podriamos bloquear
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Detecta si la app ha sido modificada
   */
  private async checkTampering(): Promise<boolean> {
    try {
      // Verificar integridad basica
      // En produccion, verificar firma del APK/IPA
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Detecta herramientas de desarrollo abiertas
   */
  private detectDevTools(): boolean {
    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;

    // Metodo alternativo usando console.log timing
    let devtools = false;
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: function() {
        devtools = true;
      }
    });

    return widthThreshold || heightThreshold;
  }

  /**
   * Maneja una violacion de seguridad
   */
  private async handleSecurityViolation(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Advertencia de Seguridad',
      message: 'Se ha detectado un problema de seguridad en este dispositivo. Algunas funciones pueden estar limitadas.',
      buttons: ['Entendido'],
      backdropDismiss: false
    });
    await alert.present();
  }

  /**
   * Sanitiza input para prevenir XSS
   */
  sanitizeInput(input: string): string {
    if (!input) return '';

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/`/g, '&#x60;')
      .replace(/=/g, '&#x3D;');
  }

  /**
   * Valida y sanitiza email
   */
  sanitizeEmail(email: string): string {
    if (!email) return '';

    // Eliminar caracteres peligrosos
    const sanitized = email.toLowerCase().trim();
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

    if (!emailRegex.test(sanitized)) {
      return '';
    }

    return sanitized;
  }

  /**
   * Valida contrasena segura
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!password || password.length < 8) {
      errors.push('La contrasena debe tener al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Debe contener al menos una mayuscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Debe contener al menos una minuscula');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Debe contener al menos un numero');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Debe contener al menos un caracter especial');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Genera un ID seguro
   */
  generateSecureId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hashea datos sensibles (para logs, etc)
   */
  async hashData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verifica si la sesion es valida
   */
  isSessionValid(token: string, expiresAt: number): boolean {
    if (!token) return false;
    if (Date.now() > expiresAt) return false;
    return true;
  }

  /**
   * Limpia datos sensibles de la memoria
   */
  clearSensitiveData(obj: any): void {
    if (!obj) return;

    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = '';
      } else if (typeof obj[key] === 'object') {
        this.clearSensitiveData(obj[key]);
      }
    }
  }
}
