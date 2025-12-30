import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { LicenseService } from '../services/license.service';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class LicenseGuard implements CanActivate {
  constructor(
    private licenseService: LicenseService,
    private router: Router,
    private alertController: AlertController
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    // Primero verificar el estado actual en cache
    let hasLicense = this.licenseService.hasValidLicense();

    // Si no tiene licencia en cache, verificar con el servidor
    if (!hasLicense) {
      try {
        const status = await this.licenseService.checkLicenseStatus();
        hasLicense = status.hasValidLicense;
      } catch (error) {
        console.error('Error checking license:', error);
        hasLicense = false;
      }
    }

    if (hasLicense) {
      return true;
    }

    // Mostrar alerta y redirigir a settings
    await this.showNoLicenseAlert();
    return this.router.createUrlTree(['/tabs/settings']);
  }

  private async showNoLicenseAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Licencia Requerida',
      message: 'Necesitas una licencia activa para acceder a esta funcionalidad. Por favor, activa o compra una licencia.',
      buttons: ['Entendido'],
      cssClass: 'license-alert'
    });
    await alert.present();
  }
}
