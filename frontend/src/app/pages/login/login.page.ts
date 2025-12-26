import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone: false,
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  loginForm: FormGroup;
  showPassword = false;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/tabs/projects']);
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onLogin() {
    if (this.loginForm.invalid) {
      this.markFormTouched();
      return;
    }

    this.isLoading = true;

    try {
      const { email, password } = this.loginForm.value;
      await firstValueFrom(this.authService.login({ email, password }));
      this.router.navigate(['/tabs/projects'], { replaceUrl: true });
    } catch (error: any) {
      this.isLoading = false;

      const toast = await this.toastCtrl.create({
        message: error.message || 'Error al iniciar sesion. Verifica tus credenciales.',
        duration: 3000,
        position: 'bottom',
        color: 'danger',
        icon: 'alert-circle-outline'
      });
      await toast.present();
    }
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }

  async forgotPassword() {
    const alert = await this.alertCtrl.create({
      header: 'Recuperar contrasena',
      message: 'Introduce tu email y te enviaremos instrucciones para recuperar tu contrasena.',
      inputs: [
        {
          name: 'email',
          type: 'email'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Enviar',
          handler: async (data) => {
            if (data.email) {
              const toast = await this.toastCtrl.create({
                message: 'Si el email existe, recibiras instrucciones para recuperar tu contrasena.',
                duration: 4000,
                position: 'bottom',
                color: 'success'
              });
              await toast.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private markFormTouched() {
    Object.keys(this.loginForm.controls).forEach(key => {
      this.loginForm.controls[key].markAsTouched();
    });
  }

  getErrorMessage(field: string): string {
    const control = this.loginForm.get(field);
    if (control?.hasError('required')) {
      return 'Este campo es obligatorio';
    }
    if (control?.hasError('email')) {
      return 'Introduce un email valido';
    }
    if (control?.hasError('minlength')) {
      return 'La contrasena debe tener al menos 6 caracteres';
    }
    return '';
  }
}
