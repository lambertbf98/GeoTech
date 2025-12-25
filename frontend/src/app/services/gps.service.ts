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
    timeout: 10000,
    maximumAge: 0
  };

  constructor() {}

  async getCurrentPosition(): Promise<PhotoLocation> {
    if (!Capacitor.isNativePlatform()) {
      return this.getWebPosition();
    }

    try {
      const permissions = await Geolocation.checkPermissions();

      if (permissions.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          throw new Error('Permisos de ubicacion denegados');
        }
      }

      const position: Position = await Geolocation.getCurrentPosition(this.defaultOptions);

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude ?? undefined,
        accuracy: position.coords.accuracy ?? undefined
      };
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  }

  private getWebPosition(): Promise<PhotoLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalizacion no soportada'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude ?? undefined,
            accuracy: position.coords.accuracy ?? undefined
          });
        },
        (error) => {
          let message = 'Error al obtener ubicacion';
          if (error.code === error.PERMISSION_DENIED) message = 'Permiso de ubicacion denegado';
          else if (error.code === error.POSITION_UNAVAILABLE) message = 'Ubicacion no disponible';
          else if (error.code === error.TIMEOUT) message = 'Tiempo de espera agotado';
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
