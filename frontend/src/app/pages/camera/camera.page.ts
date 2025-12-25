import { Component, OnInit } from '@angular/core';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { CameraService } from '../../services/camera.service';
import { GpsService } from '../../services/gps.service';
import { StorageService } from '../../services/storage.service';
import { ClaudeService } from '../../services/claude.service';
import { CatastroService } from '../../services/catastro.service';
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
    private catastroService: CatastroService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    this.projects = await this.storageService.getProjects();
    if (this.projects.length > 0) {
      this.selectedProjectId = this.projects[0].id;
    }
  }

  async takePhoto() {
    if (!this.selectedProjectId) {
      this.showToast('Selecciona un proyecto primero', 'warning');
      return;
    }
    try {
      const photoData = await this.cameraService.takePhoto();
      let latitude = 0, longitude = 0;
      let altitude: number | undefined, accuracy: number | undefined;
      try {
        const pos = await Promise.race([
          this.gpsService.getCurrentPosition(),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
        ]);
        latitude = pos.latitude;
        longitude = pos.longitude;
        altitude = pos.altitude;
        accuracy = pos.accuracy;
        this.gpsStatus = 'Lat: ' + latitude.toFixed(6) + ', Lon: ' + longitude.toFixed(6);
      } catch { this.gpsStatus = 'GPS no disponible'; }
      this.currentPhoto = {
        id: 'photo_' + Date.now(),
        projectId: this.selectedProjectId,
        imagePath: photoData.webPath || photoData.webviewPath || '',
        latitude, longitude, altitude, accuracy,
        timestamp: new Date().toISOString(),
        synced: false
      };
      await this.storageService.addPhoto(this.currentPhoto);
      this.showToast(latitude ? 'Foto con GPS' : 'Foto sin GPS', latitude ? 'success' : 'warning');
    } catch (error: any) {
      this.showToast(error.message || 'Error', 'danger');
    }
  }

  async getCatastroInfo() {
    if (!this.currentPhoto?.latitude || !this.currentPhoto?.longitude) {
      this.showToast('No hay GPS', 'warning'); return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Catastro...', spinner: 'crescent' });
    await loading.present();
    try {
      const data = await this.catastroService.getParcelByCoordinates(this.currentPhoto.latitude, this.currentPhoto.longitude);
      this.currentPhoto.catastroRef = data.referenciaCatastral;
      this.currentPhoto.catastroData = data;
      await this.storageService.updatePhoto(this.currentPhoto);
      this.showToast('OK', 'success');
    } catch (e: any) { this.showToast(e.message || 'Error', 'danger'); }
    await loading.dismiss();
  }

  async getAIDescription() {
    if (!this.currentPhoto?.imagePath) return;
    const loading = await this.loadingCtrl.create({ message: 'IA...', spinner: 'crescent' });
    await loading.present();
    try {
      const desc = await this.claudeService.analyzeImage(this.currentPhoto.imagePath);
      this.currentPhoto.aiDescription = desc;
      await this.storageService.updatePhoto(this.currentPhoto);
      this.showToast('OK', 'success');
    } catch (e: any) { this.showToast(e.message || 'Error', 'danger'); }
    await loading.dismiss();
  }

  async addNotes() {
    const alert = await this.alertCtrl.create({
      header: 'Notas',
      inputs: [{ name: 'notes', type: 'textarea', placeholder: 'Notas...', value: this.currentPhoto?.notes || '' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'OK', handler: async (d) => { if (this.currentPhoto) { this.currentPhoto.notes = d.notes; await this.storageService.updatePhoto(this.currentPhoto); } } }
      ]
    });
    await alert.present();
  }

  clearPhoto() { this.currentPhoto = null; this.gpsStatus = 'Sin ubicacion'; }

  private async showToast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, position: 'bottom', color });
    await t.present();
  }
}
