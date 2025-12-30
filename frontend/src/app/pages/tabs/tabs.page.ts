import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subscription, filter } from 'rxjs';
import { SyncService } from '../../services/sync.service';
import { LicenseService, LicenseStatus } from '../../services/license.service';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class TabsPage implements OnInit, OnDestroy {
  pendingSync = 0;
  hasLicense = false;
  licenseChecked = false;
  private licenseSub: Subscription | null = null;

  constructor(
    private syncService: SyncService,
    private licenseService: LicenseService,
    private authService: AuthService,
    private alertController: AlertController,
    private router: Router
  ) {}

  async ngOnInit() {
    this.syncService.getPendingCount().then(count => {
      this.pendingSync = count;
    });

    // Suscribirse a cambios de licencia
    this.licenseSub = this.licenseService.licenseStatus$.subscribe(status => {
      this.hasLicense = status.hasValidLicense;
      this.licenseChecked = true;
    });

    // Verificar licencia al iniciar
    await this.checkLicense();
  }

  ngOnDestroy() {
    if (this.licenseSub) {
      this.licenseSub.unsubscribe();
    }
  }

  async checkLicense() {
    if (this.authService.isAuthenticated()) {
      await this.licenseService.checkLicenseStatus();
    }
  }

  async onTabClick(event: Event, tab: string) {
    // Si es la tab de settings, siempre permitir
    if (tab === 'settings') {
      return;
    }

    // Si tiene licencia, permitir
    if (this.hasLicense) {
      return;
    }

    // Sin licencia, bloquear y mostrar alerta
    event.preventDefault();
    event.stopPropagation();

    const alert = await this.alertController.create({
      header: 'Licencia requerida',
      message: 'Para acceder a esta funcion necesitas activar una licencia. Ve a Configuracion para activar o comprar una licencia.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Ir a Config',
          handler: () => {
            this.router.navigate(['/tabs/settings']);
          }
        }
      ]
    });

    await alert.present();
  }
}
