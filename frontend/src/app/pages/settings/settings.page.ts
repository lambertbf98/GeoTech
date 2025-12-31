import { Component, OnInit, OnDestroy } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { AlertController, ToastController, LoadingController, ModalController } from "@ionic/angular";
import { Subscription } from "rxjs";
import { AuthService } from "../../services/auth.service";
import { SyncService } from "../../services/sync.service";
import { StorageService } from "../../services/storage.service";
import { LicenseService, LicenseType, License, LicenseStatus } from "../../services/license.service";

@Component({
  standalone: false,
  selector: "app-settings",
  templateUrl: "./settings.page.html",
  styleUrls: ["./settings.page.scss"],
})
export class SettingsPage implements OnInit, OnDestroy {
  userName = "";
  userEmail = "";
  userPhoto = "";
  pendingSync = 0;
  isOnline = true;
  appVersion = "1.0.0";

  // License
  hasLicense = false;
  currentLicense: License | null = null;
  licenseTypes: LicenseType[] = [];
  loadingLicense = true;
  private licenseSub: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private syncService: SyncService,
    private storageService: StorageService,
    private licenseService: LicenseService,
    private router: Router,
    private route: ActivatedRoute,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  async ngOnInit() {
    await this.loadUserData();
    this.pendingSync = await this.syncService.getPendingCount();

    // Suscribirse a cambios de licencia
    this.licenseSub = this.licenseService.licenseStatus$.subscribe(status => {
      this.hasLicense = status.hasValidLicense;
      this.currentLicense = status.license;
      this.loadingLicense = false;
    });

    // Cargar estado de licencia y tipos disponibles
    await this.loadLicenseData();

    // Verificar si venimos de un pago - solo recargar datos, sin mostrar toast
    this.route.queryParams.subscribe(params => {
      if (params['payment'] === 'success') {
        this.loadLicenseData();
        // Limpiar query params de la URL
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      } else if (params['payment'] === 'cancelled' || params['payment'] === 'error') {
        // Limpiar query params de la URL
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });
  }

  ngOnDestroy() {
    if (this.licenseSub) {
      this.licenseSub.unsubscribe();
    }
  }

  async ionViewWillEnter() {
    await this.loadUserData();
    // Verificar si hay un pago pendiente (al volver de PayPal en PWA)
    await this.licenseService.checkPendingPayment();
    await this.loadLicenseData();
  }

  private async loadLicenseData() {
    try {
      this.loadingLicense = true;
      await this.licenseService.checkLicenseStatus();
      this.licenseTypes = await this.licenseService.getLicenseTypes();
    } catch (error) {
      console.error('Error loading license data:', error);
    } finally {
      this.loadingLicense = false;
    }
  }

  private async loadUserData() {
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.name || "Usuario";
      this.userEmail = user.email || "";
    }
    // Cargar foto de perfil guardada localmente
    const savedPhoto = localStorage.getItem('user_profile_photo');
    if (savedPhoto) {
      this.userPhoto = savedPhoto;
    }
  }

  async selectProfilePhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event: any) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        this.userPhoto = reader.result as string;
        localStorage.setItem('user_profile_photo', this.userPhoto);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async editName() {
    const alert = await this.alertCtrl.create({
      header: 'Editar nombre',
      inputs: [
        {
          name: 'name',
          type: 'text',
          value: this.userName
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (data.name && data.name.trim()) {
              this.userName = data.name.trim();
              // Aquí se actualizaría en el backend
              await this.updateUserProfile({ name: this.userName });
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async editEmail() {
    const alert = await this.alertCtrl.create({
      header: 'Editar correo',
      inputs: [
        {
          name: 'email',
          type: 'email',
          value: this.userEmail
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (data.email && data.email.includes('@')) {
              this.userEmail = data.email.trim();
              // Aquí se actualizaría en el backend
              await this.updateUserProfile({ email: this.userEmail });
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async changePassword() {
    const alert = await this.alertCtrl.create({
      header: 'Cambiar contrasena',
      inputs: [
        {
          name: 'currentPassword',
          type: 'password',
          placeholder: 'Contrasena actual'
        },
        {
          name: 'newPassword',
          type: 'password',
          placeholder: 'Nueva contrasena'
        },
        {
          name: 'confirmPassword',
          type: 'password',
          placeholder: 'Confirmar nueva contrasena'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cambiar',
          handler: async (data) => {
            if (!data.currentPassword || !data.newPassword || !data.confirmPassword) {
              this.showToast('Completa todos los campos', 'warning');
              return false;
            }
            if (data.newPassword.length < 6) {
              this.showToast('La contrasena debe tener al menos 6 caracteres', 'warning');
              return false;
            }
            if (data.newPassword !== data.confirmPassword) {
              this.showToast('Las contrasenas no coinciden', 'warning');
              return false;
            }
            // Aquí se cambiaría la contraseña en el backend
            this.showToast('Contrasena actualizada', 'success');
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async updateUserProfile(data: { name?: string; email?: string }) {
    // Guardar localmente por ahora
    localStorage.setItem('user_profile_name', data.name || this.userName);
    localStorage.setItem('user_profile_email', data.email || this.userEmail);
    this.showToast('Perfil actualizado', 'success');
  }

  async syncNow() {
    try {
      await this.syncService.syncAll();
      this.pendingSync = await this.syncService.getPendingCount();
    } catch (error: any) {
      this.showToast(error.message || "Error al sincronizar", "danger");
    }
  }

  async clearCache() {
    const alert = await this.alertCtrl.create({
      header: "Limpiar cache",
      message: "Esto eliminara los datos almacenados localmente. Los datos sincronizados no se perderan.",
      buttons: [
        { text: "Cancelar", role: "cancel" },
        { text: "Limpiar", role: "destructive", handler: async () => {
          await this.storageService.clear();
        }}
      ]
    });
    await alert.present();
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: "Cerrar sesion",
      message: "Estas seguro de que quieres cerrar sesion?",
      buttons: [
        { text: "Cancelar", role: "cancel" },
        { text: "Cerrar sesion", role: "destructive", handler: async () => {
          await this.authService.logout();
          this.router.navigate(["/login"], { replaceUrl: true });
        }}
      ]
    });
    await alert.present();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, position: "bottom", color });
    await toast.present();
  }

  // ==================== LICENCIAS ====================

  async activateLicenseKey() {
    const alert = await this.alertCtrl.create({
      header: 'Activar licencia',
      message: 'Introduce tu clave de licencia',
      inputs: [
        {
          name: 'licenseKey',
          type: 'text',
          placeholder: 'XXXX-XXXX-XXXX-XXXX'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Activar',
          handler: async (data) => {
            if (!data.licenseKey || !data.licenseKey.trim()) {
              this.showToast('Introduce una clave de licencia', 'warning');
              return false;
            }

            const loading = await this.loadingCtrl.create({
              message: 'Activando licencia...'
            });
            await loading.present();

            try {
              const result = await this.licenseService.activateLicense(data.licenseKey.trim());
              this.showToast(result.message, 'success');
              await this.loadLicenseData();
            } catch (error: any) {
              this.showToast(error.error?.message || 'Error al activar licencia', 'danger');
            } finally {
              await loading.dismiss();
            }
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async showLicenseOptions() {
    if (this.licenseTypes.length === 0) {
      this.showToast('No hay tipos de licencia disponibles', 'warning');
      return;
    }

    const buttons = this.licenseTypes.map(type => ({
      text: `${type.name} - ${this.formatPrice(type.price)}`,
      handler: () => {
        this.purchaseLicense(type);
      }
    }));

    buttons.push({ text: 'Cancelar', handler: () => {} });

    const alert = await this.alertCtrl.create({
      header: 'Comprar licencia',
      message: 'Selecciona el tipo de licencia que deseas adquirir',
      buttons
    });

    await alert.present();
  }

  async purchaseLicense(licenseType: LicenseType) {
    const confirmAlert = await this.alertCtrl.create({
      header: 'Confirmar compra',
      message: `Vas a comprar una licencia ${licenseType.name} por ${this.formatPrice(licenseType.price)}.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Continuar',
          handler: () => {
            this.preparePayPalPayment(licenseType);
          }
        }
      ]
    });

    await confirmAlert.present();
  }

  private async preparePayPalPayment(licenseType: LicenseType) {
    const loading = await this.loadingCtrl.create({
      message: 'Preparando pago...',
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loading.present();

    try {
      // Obtener URL de PayPal
      const order = await this.licenseService.createPaymentOrder(licenseType.id);
      await loading.dismiss();

      if (order.approvalUrl) {
        // Guardar estado para verificar al volver
        localStorage.setItem('pending_payment', 'true');

        // Abrir PayPal directamente en el navegador
        window.location.href = order.approvalUrl;
      }
    } catch (error: any) {
      await loading.dismiss();
      this.showToast(error.error?.message || 'Error al preparar pago', 'danger');
    }
  }

  formatPrice(price: number): string {
    return this.licenseService.formatPrice(price);
  }

  formatDaysRemaining(days: number): string {
    return this.licenseService.formatDaysRemaining(days);
  }

  formatTimeRemaining(license: License): string {
    return this.licenseService.formatTimeRemaining(license);
  }
}
