import { Injectable } from '@angular/core';
import { Geolocation, Position, PositionOptions } from '@capacitor/geolocation';
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
    try {
      // Verificar permisos
      const permissions = await Geolocation.checkPermissions();

      if (permissions.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          throw new Error('Permisos de ubicación denegados');
        }
      }

      // Obtener posición
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

    return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lon).toFixed(6)}° ${lonDir}`;
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Fórmula de Haversine para calcular distancia entre dos puntos
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
  }
}
