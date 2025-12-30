import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { LicenseService } from '../services/license.service';
import { AuthService } from '../services/auth.service';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class LicenseGuard implements CanActivate {
  constructor(
    private licenseService: LicenseService,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    // Si no está autenticado, redirigir al login (no verificar licencia)
    if (!this.authService.isAuthenticated) {
      return this.router.createUrlTree(['/login']);
    }

    // Solo verificar licencia si está autenticado
    try {
      const status = await this.licenseService.checkLicenseStatus();
      if (status.hasValidLicense) {
        return true;
      }
    } catch (error) {
      console.error('Error checking license:', error);
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
