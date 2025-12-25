import { Component, OnInit } from '@angular/core';
import { LoadingController, ToastController } from '@ionic/angular';
import { CatastroService } from '../../services/catastro.service';
import { GpsService } from '../../services/gps.service';

@Component({
  standalone: false,
  selector: 'app-catastro',
  templateUrl: './catastro.page.html',
  styleUrls: ['./catastro.page.scss'],
})
export class CatastroPage implements OnInit {
  searchMode: 'coords' | 'ref' = 'coords';
  latitude = '';
  longitude = '';
  refCatastral = '';
  parcelData: any = null;
  isLoading = false;

  constructor(
    private catastroService: CatastroService,
    private gpsService: GpsService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {}

  async useCurrentLocation() {
    const loading = await this.loadingCtrl.create({ message: 'Ubicacion y Catastro...', spinner: 'crescent' });
    await loading.present();
    try {
      const position = await this.gpsService.getCurrentPosition();
      this.latitude = position.latitude.toFixed(6);
      this.longitude = position.longitude.toFixed(6);
      
      // Auto-search catastro
      try {
        this.parcelData = await this.catastroService.getParcelByCoordinates(position.latitude, position.longitude);
        if (this.parcelData?.referenciaCatastral) {
          this.refCatastral = this.parcelData.referenciaCatastral;
        }
        this.showToast('Parcela encontrada', 'success');
      } catch {
        this.showToast('Ubicacion OK, catastro no disponible', 'warning');
      }
    } catch (error: any) {
      this.showToast(error.message || 'Error ubicacion', 'danger');
    }
    await loading.dismiss();
  }

  async searchByCoords() {
    if (!this.latitude || !this.longitude) {
      this.showToast('Introduce coordenadas', 'warning');
      return;
    }
    await this.search(() => this.catastroService.getParcelByCoordinates(parseFloat(this.latitude), parseFloat(this.longitude)));
  }

  async searchByRef() {
    if (!this.refCatastral) {
      this.showToast('Introduce referencia', 'warning');
      return;
    }
    await this.search(() => this.catastroService.getParcelByReference(this.refCatastral));
  }

  private async search(fetchFn: () => Promise<any>) {
    const loading = await this.loadingCtrl.create({ message: 'Consultando...', spinner: 'crescent' });
    await loading.present();
    this.isLoading = true;
    try {
      this.parcelData = await fetchFn();
      if (!this.parcelData) throw new Error('Sin datos');
    } catch (error: any) {
      this.parcelData = null;
      this.showToast(error.message || 'Error', 'danger');
    }
    this.isLoading = false;
    await loading.dismiss();
  }

  clearResults() { this.parcelData = null; }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, position: 'bottom', color });
    await toast.present();
  }
}
