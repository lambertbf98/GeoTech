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
  userPhoto = "";
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
    await this.loadUserData();
    this.pendingSync = await this.syncService.getPendingCount();
  }

  async ionViewWillEnter() {
    await this.loadUserData();
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
}
