import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class SecureStorageService {
  private encryptionKey: CryptoKey | null = null;
  private readonly SALT = 'GeoTech_Secure_Salt_2024';
  private readonly IV_LENGTH = 12;

  constructor() {
    this.initializeEncryption();
  }

  /**
   * Inicializa la clave de encriptacion
   */
  private async initializeEncryption(): Promise<void> {
    try {
      // Generar o recuperar clave de encriptacion
      const storedKey = await Preferences.get({ key: 'encryption_key_hash' });

      if (!storedKey.value) {
        // Generar nueva clave
        this.encryptionKey = await this.generateKey();
        // Guardar hash de verificacion
        const keyHash = await this.hashKey(this.encryptionKey);
        await Preferences.set({ key: 'encryption_key_hash', value: keyHash });
      } else {
        // Regenerar clave desde datos del dispositivo
        this.encryptionKey = await this.deriveKey();
      }
    } catch (error) {
      console.error('Error initializing encryption:', error);
    }
  }

  /**
   * Genera una clave de encriptacion AES-GCM
   */
  private async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Deriva una clave desde datos del dispositivo
   */
  private async deriveKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    // Usar combinacion de datos unicos del dispositivo
    const deviceData = navigator.userAgent + this.SALT + (navigator.language || 'en');
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(deviceData),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(this.SALT),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Hash de verificacion de clave
   */
  private async hashKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', exported);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Encripta datos sensibles
   */
  async encrypt(data: string): Promise<string> {
    if (!this.encryptionKey) {
      await this.initializeEncryption();
    }

    if (!this.encryptionKey) {
      throw new Error('Encryption not available');
    }

    try {
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encoder.encode(data)
      );

      // Combinar IV + datos encriptados
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      // Convertir a base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  /**
   * Desencripta datos
   */
  async decrypt(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) {
      await this.initializeEncryption();
    }

    if (!this.encryptionKey) {
      throw new Error('Encryption not available');
    }

    try {
      // Decodificar base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
      );

      // Separar IV y datos
      const iv = combined.slice(0, this.IV_LENGTH);
      const encryptedBuffer = combined.slice(this.IV_LENGTH);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encryptedBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  /**
   * Guarda datos encriptados
   */
  async setSecure(key: string, value: any): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      const encrypted = await this.encrypt(stringValue);
      await Preferences.set({ key: `secure_${key}`, value: encrypted });
    } catch (error) {
      console.error('Error saving secure data:', error);
      // Fallback a guardado normal si falla encriptacion
      await Preferences.set({
        key: `secure_${key}`,
        value: typeof value === 'string' ? value : JSON.stringify(value)
      });
    }
  }

  /**
   * Recupera datos encriptados
   */
  async getSecure<T>(key: string): Promise<T | null> {
    try {
      const result = await Preferences.get({ key: `secure_${key}` });
      if (!result.value) return null;

      try {
        const decrypted = await this.decrypt(result.value);
        try {
          return JSON.parse(decrypted) as T;
        } catch {
          return decrypted as unknown as T;
        }
      } catch {
        // Si falla desencriptacion, intentar leer como texto plano
        try {
          return JSON.parse(result.value) as T;
        } catch {
          return result.value as unknown as T;
        }
      }
    } catch (error) {
      console.error('Error getting secure data:', error);
      return null;
    }
  }

  /**
   * Elimina datos encriptados
   */
  async removeSecure(key: string): Promise<void> {
    await Preferences.remove({ key: `secure_${key}` });
  }

  /**
   * Limpia todos los datos seguros
   */
  async clearSecure(): Promise<void> {
    const keys = await Preferences.keys();
    for (const key of keys.keys) {
      if (key.startsWith('secure_')) {
        await Preferences.remove({ key });
      }
    }
  }

  /**
   * Guarda token de autenticacion de forma segura
   */
  async setAuthToken(token: string): Promise<void> {
    await this.setSecure('auth_token', token);
  }

  /**
   * Recupera token de autenticacion
   */
  async getAuthToken(): Promise<string | null> {
    return await this.getSecure<string>('auth_token');
  }

  /**
   * Guarda refresh token de forma segura
   */
  async setRefreshToken(token: string): Promise<void> {
    await this.setSecure('refresh_token', token);
  }

  /**
   * Recupera refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    return await this.getSecure<string>('refresh_token');
  }

  /**
   * Limpia tokens de autenticacion
   */
  async clearAuthTokens(): Promise<void> {
    await this.removeSecure('auth_token');
    await this.removeSecure('refresh_token');
  }
}
