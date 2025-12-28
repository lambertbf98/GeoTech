import { Component, OnInit } from '@angular/core';
import { ToastController, AlertController, NavController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { CameraService } from '../../services/camera.service';
import { GpsService } from '../../services/gps.service';
import { StorageService } from '../../services/storage.service';
import { ClaudeService } from '../../services/claude.service';
import { Photo, Project } from '../../models';

@Component({
  standalone: false,
  selector: 'app-camera',
  templateUrl: './camera.page.html',
  styleUrls: ['./camera.page.scss'],
})
export class CameraPage implements OnInit {
  currentPhoto: Photo | null = null;
  projects: Project[] = [];
  selectedProjectId = '';
  isProcessing = false;
  gpsStatus = 'Sin ubicacion';

  constructor(
    private cameraService: CameraService,
    private gpsService: GpsService,
    private storageService: StorageService,
    private claudeService: ClaudeService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    this.projects = await this.storageService.getProjects();
    if (this.projects.length > 0) { this.selectedProjectId = this.projects[0].id; }
  }

  async takePhoto() {
    if (!this.selectedProjectId) { this.showToast('Selecciona un proyecto primero', 'warning'); return; }
    try {
      const photoData = await this.cameraService.takePhoto();
      let latitude = 0, longitude = 0;
      let altitude: number | undefined, accuracy: number | undefined;
      let location = '';
      try {
        const pos = await Promise.race([this.gpsService.getCurrentPosition(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
        latitude = pos.latitude; longitude = pos.longitude; altitude = pos.altitude; accuracy = pos.accuracy;
        this.gpsStatus = 'GPS: ' + latitude.toFixed(6) + ', ' + longitude.toFixed(6);
        // Obtener ubicación (dirección) mediante reverse geocoding
        location = await this.getLocationName(latitude, longitude);
      } catch { this.gpsStatus = 'GPS no disponible'; }
      this.currentPhoto = { id: 'photo_' + Date.now(), projectId: this.selectedProjectId, imagePath: photoData.webPath || photoData.webviewPath || '', latitude, longitude, altitude, accuracy, location, timestamp: new Date().toISOString(), synced: false };
      await this.storageService.addPhoto(this.currentPhoto);
    } catch (error: any) { this.showToast(error.message || 'Error', 'danger'); }
  }

  async importPhoto() {
    if (!this.selectedProjectId) { this.showToast('Selecciona un proyecto primero', 'warning'); return; }
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (event: any) => {
      const file = event.target.files?.[0]; if (!file) return;
      this.isProcessing = true;
      try {
        let latitude = 0, longitude = 0;
        let altitude: number | undefined, accuracy: number | undefined;
        let location = '';

        // 1. Intentar leer GPS del EXIF de la imagen
        try {
          const exifr = await import('exifr');
          const gps = await exifr.gps(file);
          if (gps && gps.latitude && gps.longitude) {
            latitude = gps.latitude;
            longitude = gps.longitude;
            this.gpsStatus = 'EXIF: ' + latitude.toFixed(6) + ', ' + longitude.toFixed(6);
          }
        } catch (e) { console.log('EXIF error:', e); }

        // 2. Si no hay GPS en EXIF, usar ubicacion del dispositivo
        if (!latitude || !longitude) {
          try {
            const pos = await Promise.race([
              this.gpsService.getCurrentPosition(),
              new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
            ]);
            latitude = pos.latitude;
            longitude = pos.longitude;
            altitude = pos.altitude;
            accuracy = pos.accuracy;
            this.gpsStatus = 'GPS: ' + latitude.toFixed(6) + ', ' + longitude.toFixed(6);
          } catch (e) {
            this.gpsStatus = 'Sin coordenadas GPS';
          }
        }

        // Obtener ubicación (dirección) mediante reverse geocoding
        if (latitude && longitude) {
          location = await this.getLocationName(latitude, longitude);
        }

        // Convertir imagen a base64 para persistencia
        const base64 = await this.fileToBase64(file);
        this.currentPhoto = {
          id: 'photo_' + Date.now(),
          projectId: this.selectedProjectId,
          imagePath: base64,
          latitude,
          longitude,
          altitude,
          accuracy,
          location,
          timestamp: new Date().toISOString(),
          synced: false
        };
        await this.storageService.addPhoto(this.currentPhoto);
      } catch (error: any) { this.showToast(error.message || 'Error', 'danger'); }
      this.isProcessing = false;
    };
    input.click();
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Navegar al GeoVisor con las coordenadas de la foto
  openInGeoVisor(mode: 'map' | 'satellite' | 'earth' = 'map') {
    if (!this.currentPhoto?.latitude || !this.currentPhoto?.longitude) {
      this.showToast('No hay coordenadas GPS', 'warning');
      return;
    }
    // Guardar coordenadas en storage para que el GeoVisor las use
    localStorage.setItem('geovisor_lat', this.currentPhoto.latitude.toString());
    localStorage.setItem('geovisor_lon', this.currentPhoto.longitude.toString());
    localStorage.setItem('geovisor_mode', mode);
    this.navCtrl.navigateForward('/tabs/catastro');
  }

  openCatastroMap() {
    this.openInGeoVisor('satellite');
  }

  openGoogleMaps() {
    this.openInGeoVisor('map');
  }

  openGoogleEarth() {
    this.openInGeoVisor('earth');
  }

  async getAIDescription() {
    if (!this.currentPhoto?.imagePath) return;
    this.isProcessing = true;
    try {
      const desc = await this.claudeService.analyzeImage(this.currentPhoto.imagePath);
      this.currentPhoto.aiDescription = desc;
      await this.storageService.updatePhoto(this.currentPhoto);
    } catch (e: any) { this.showToast(e.message || 'Error IA', 'danger'); }
    this.isProcessing = false;
  }

  private async getLocationName(lat: number, lon: number): Promise<string> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`;
      const result = await this.http.get<any>(url).toPromise();
      if (result?.display_name) {
        // Tomar las primeras partes de la dirección
        const parts = result.display_name.split(',').slice(0, 3);
        return parts.join(',').trim();
      }
    } catch (e) {
      console.log('Geocoding error:', e);
    }
    return '';
  }

  async addNotes() {
    const alert = await this.alertCtrl.create({
      header: 'Notas',
      inputs: [{ name: 'notes', type: 'textarea', placeholder: 'Notas...', value: this.currentPhoto?.notes || '' }],
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'OK', handler: async (d) => { if (this.currentPhoto) { this.currentPhoto.notes = d.notes; await this.storageService.updatePhoto(this.currentPhoto); } } }]
    });
    await alert.present();
  }

  clearPhoto() { this.currentPhoto = null; this.gpsStatus = 'Sin ubicacion'; }

  private async showToast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2500, position: 'bottom', color });
    await t.present();
  }
}
