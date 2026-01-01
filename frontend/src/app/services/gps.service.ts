import { Injectable } from '@angular/core';
import { Geolocation, Position, PositionOptions } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { PhotoLocation } from '../models';

@Injectable({
  providedIn: 'root'
})
export class GpsService {
  private defaultOptions: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
  };

  constructor() {}

  /**
   * Obtiene la mejor posición GPS posible tomando múltiples lecturas
   * durante unos segundos y seleccionando la más precisa
   */
  async getCurrentPosition(): Promise<PhotoLocation> {
    if (!Capacitor.isNativePlatform()) {
      return this.getWebPositionAccurate();
    }

    try {
      const permissions = await Geolocation.checkPermissions();

      if (permissions.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          throw new Error('Permisos de ubicacion denegados');
        }
      }

      // Tomar múltiples lecturas y elegir la mejor
      return this.getBestPosition();
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  }

  /**
   * Toma múltiples lecturas GPS durante 3 segundos y devuelve la más precisa
   */
  private async getBestPosition(): Promise<PhotoLocation> {
    return new Promise(async (resolve, reject) => {
      const readings: PhotoLocation[] = [];
      let watchId: string | null = null;

      const timeout = setTimeout(async () => {
        // Después de 3 segundos, elegir la mejor lectura
        if (watchId) {
          await Geolocation.clearWatch({ id: watchId });
        }

        if (readings.length === 0) {
          // Si no hay lecturas, intentar una lectura simple
          try {
            const pos = await Geolocation.getCurrentPosition(this.defaultOptions);
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude ?? undefined,
              accuracy: pos.coords.accuracy ?? undefined
            });
          } catch (e) {
            reject(new Error('No se pudo obtener ubicación'));
          }
          return;
        }

        // Elegir la lectura con mejor precisión (menor valor de accuracy)
        const best = readings.reduce((prev, curr) =>
          (curr.accuracy || 999) < (prev.accuracy || 999) ? curr : prev
        );

        console.log(`GPS: ${readings.length} lecturas, mejor precisión: ${best.accuracy}m`);
        resolve(best);
      }, 3000);

      try {
        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          (position, err) => {
            if (err) return;
            if (position) {
              const reading: PhotoLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude ?? undefined,
                accuracy: position.coords.accuracy ?? undefined
              };
              readings.push(reading);

              // Si tenemos una lectura muy precisa (< 10m), usar inmediatamente
              if (reading.accuracy && reading.accuracy < 10) {
                clearTimeout(timeout);
                Geolocation.clearWatch({ id: watchId! });
                console.log(`GPS: Precisión excelente: ${reading.accuracy}m`);
                resolve(reading);
              }
            }
          }
        );
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  /**
   * Versión web mejorada - toma múltiples lecturas para mejor precisión
   */
  private getWebPositionAccurate(): Promise<PhotoLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalizacion no soportada'));
        return;
      }

      const readings: PhotoLocation[] = [];
      let watchId: number | null = null;

      const timeout = setTimeout(() => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }

        if (readings.length === 0) {
          // Fallback a lectura simple
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude ?? undefined,
              accuracy: pos.coords.accuracy ?? undefined
            }),
            (err) => reject(new Error('No se pudo obtener ubicación')),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
          return;
        }

        // Elegir la mejor lectura
        const best = readings.reduce((prev, curr) =>
          (curr.accuracy || 999) < (prev.accuracy || 999) ? curr : prev
        );
        console.log(`GPS Web: ${readings.length} lecturas, mejor precisión: ${best.accuracy}m`);
        resolve(best);
      }, 3000);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const reading: PhotoLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude ?? undefined,
            accuracy: position.coords.accuracy ?? undefined
          };
          readings.push(reading);

          // Si tenemos precisión excelente, resolver inmediatamente
          if (reading.accuracy && reading.accuracy < 10) {
            clearTimeout(timeout);
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId);
            }
            console.log(`GPS Web: Precisión excelente: ${reading.accuracy}m`);
            resolve(reading);
          }
        },
        (error) => {
          // Ignorar errores durante watch, esperar al timeout
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  async watchPosition(callback: (location: PhotoLocation) => void): Promise<string> {
    const watchId = await Geolocation.watchPosition(
      this.defaultOptions,
      (position, err) => {
        if (err) {
          console.error('Watch position error:', err);
          return;
        }

        if (position) {
          callback({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude ?? undefined,
            accuracy: position.coords.accuracy ?? undefined
          });
        }
      }
    );

    return watchId;
  }

  async clearWatch(watchId: string): Promise<void> {
    await Geolocation.clearWatch({ id: watchId });
  }

  formatCoordinates(lat: number, lon: number): string {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return Math.abs(lat).toFixed(6) + ' ' + latDir + ', ' + Math.abs(lon).toFixed(6) + ' ' + lonDir;
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const f1 = (lat1 * Math.PI) / 180;
    const f2 = (lat2 * Math.PI) / 180;
    const df = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(df / 2) * Math.sin(df / 2) +
      Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
