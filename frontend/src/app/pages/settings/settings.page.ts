import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { AlertController, LoadingController, ToastController } from "@ionic/angular";
import { AuthService } from "../../services/auth.service";
import { SyncService } from "../../services/sync.service";
import { StorageService } from "../../services/storage.service";

@Component({
  standalone: false,
  selector: "app-settings",
  templateUrl: "./settings.page.html",
  styleUrls: ["./settings.page.scss"],
})
export class SettingsPage implements OnInit {
  userName = "";
  userEmail = "";
  pendingSync = 0;
  isOnline = true;
  appVersion = "1.0.0";

  constructor(
    private authService: AuthService,
    private syncService: SyncService,
    private storageService: StorageService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.name || "Usuario";
      this.userEmail = user.email || "";
    }
    this.pendingSync = await this.syncService.getPendingCount();
  }

  async syncNow() {
    const loading = await this.loadingCtrl.create({ message: "Sincronizando...", spinner: "crescent" });
    await loading.present();
    try {
      await this.syncService.syncAll();
      this.pendingSync = await this.syncService.getPendingCount();
      this.showToast("Sincronizacion completada", "success");
    } catch (error: any) {
      this.showToast(error.message || "Error al sincronizar", "danger");
    }
    await loading.dismiss();
  }

  async clearCache() {
    const alert = await this.alertCtrl.create({
      header: "Limpiar cache",
      message: "Esto eliminara los datos almacenados localmente. Los datos sincronizados no se perderan.",
      buttons: [
        { text: "Cancelar", role: "cancel" },
        { text: "Limpiar", role: "destructive", handler: async () => {
          await this.storageService.clear();
          this.showToast("Cache limpiado", "success");
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
}
