import { Component, OnInit } from '@angular/core';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { Measurement } from '../../models';

@Component({
  standalone: false,
  selector: 'app-mediciones',
  templateUrl: './mediciones.page.html',
  styleUrls: ['./mediciones.page.scss'],
})
export class MedicionesPage implements OnInit {
  measurements: Measurement[] = [];

  constructor(
    private storageService: StorageService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private navCtrl: NavController
  ) {}

  async ngOnInit() {
    await this.loadMeasurements();
  }

  async ionViewWillEnter() {
    await this.loadMeasurements();
  }

  async loadMeasurements() {
    this.measurements = await this.storageService.getMeasurements();
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatValue(measurement: Measurement): string {
    if (measurement.type === 'distance') {
      if (measurement.value >= 1000) {
        return (measurement.value / 1000).toFixed(2) + ' km';
      }
      return measurement.value.toFixed(2) + ' m';
    } else {
      if (measurement.value >= 10000) {
        return (measurement.value / 10000).toFixed(2) + ' ha';
      }
      return measurement.value.toFixed(0) + ' m²';
    }
  }

  getCoords(measurement: Measurement): string {
    if (measurement.points.length === 0) return '';
    const first = measurement.points[0];
    return `${first.lat.toFixed(4)}, ${first.lng.toFixed(4)}`;
  }

  async confirmDelete(measurement: Measurement) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar medición',
      message: `¿Eliminar esta ${measurement.type === 'distance' ? 'distancia' : 'área'}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            // Ejecutar en siguiente tick para que el alert cierre primero
            setTimeout(() => this.deleteMeasurement(measurement), 100);
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteMeasurement(measurement: Measurement) {
    await this.storageService.deleteMeasurement(measurement.id);
    await this.loadMeasurements();
    this.showToast('Medición eliminada', 'success');
  }

  async clearAll() {
    if (this.measurements.length === 0) return;

    const alert = await this.alertCtrl.create({
      header: 'Eliminar todas',
      message: '¿Eliminar todas las mediciones guardadas?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar todas',
          role: 'destructive',
          handler: () => {
            setTimeout(async () => {
              await this.storageService.clearMeasurements();
              await this.loadMeasurements();
              this.showToast('Todas las mediciones eliminadas', 'success');
            }, 100);
          }
        }
      ]
    });
    await alert.present();
  }

  viewOnMap(measurement: Measurement) {
    const centerLat = measurement.points.reduce((sum, p) => sum + p.lat, 0) / measurement.points.length;
    const centerLng = measurement.points.reduce((sum, p) => sum + p.lng, 0) / measurement.points.length;

    localStorage.setItem('geovisor_lat', centerLat.toString());
    localStorage.setItem('geovisor_lon', centerLng.toString());
    localStorage.setItem('geovisor_mode', 'satellite');

    this.navCtrl.navigateForward('/tabs/catastro');
  }

  goBack() {
    this.navCtrl.navigateBack('/tabs/catastro');
  }

  private async showToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2000,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}
