import { Component, OnInit } from "@angular/core";
import { LoadingController, ToastController, AlertController } from "@ionic/angular";
import { CameraService } from "../../services/camera.service";
import { GpsService } from "../../services/gps.service";
import { StorageService } from "../../services/storage.service";
import { ClaudeService } from "../../services/claude.service";
import { CatastroService } from "../../services/catastro.service";
import { Photo, Project } from "../../models";

@Component({
  standalone: false,
  selector: "app-camera",
  templateUrl: "./camera.page.html",
  styleUrls: ["./camera.page.scss"],
})
export class CameraPage implements OnInit {
  currentPhoto: Photo | null = null;
  projects: Project[] = [];
  selectedProjectId = "";
  isProcessing = false;
  gpsStatus = "Obteniendo ubicacion...";

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
      this.showToast("Selecciona un proyecto primero", "warning");
      return;
    }

    try {
      // First capture photo WITHOUT loading overlay (so file picker works)
      const photoData = await this.cameraService.takePhoto();
      
      // Now show loading for GPS
      const loading = await this.loadingCtrl.create({ message: "Obteniendo ubicacion...", spinner: "crescent" });
      await loading.present();

      try {
        const position = await this.gpsService.getCurrentPosition();

        this.currentPhoto = {
          id: "photo_" + Date.now(),
          projectId: this.selectedProjectId,
          imagePath: photoData.webPath || photoData.webviewPath || "",
          latitude: position.latitude,
          longitude: position.longitude,
          altitude: position.altitude,
          accuracy: position.accuracy,
          timestamp: new Date().toISOString(),
          synced: false
        };

        this.gpsStatus = "Lat: " + position.latitude.toFixed(6) + ", Lon: " + position.longitude.toFixed(6);
        await this.storageService.addPhoto(this.currentPhoto);
        this.showToast("Foto capturada con GPS", "success");
      } catch (gpsError: any) {
        // Photo was taken but GPS failed - still save photo without GPS
        this.currentPhoto = {
          id: "photo_" + Date.now(),
          projectId: this.selectedProjectId,
          imagePath: photoData.webPath || photoData.webviewPath || "",
          latitude: 0,
          longitude: 0,
          timestamp: new Date().toISOString(),
          synced: false
        };
        this.gpsStatus = "GPS no disponible";
        await this.storageService.addPhoto(this.currentPhoto);
        this.showToast("Foto guardada (sin GPS: " + gpsError.message + ")", "warning");
      }

      await loading.dismiss();
    } catch (error: any) {
      this.showToast(error.message || "Error al capturar foto", "danger");
    }
  }

  async getCatastroInfo() {
    if (!this.currentPhoto) return;

    const loading = await this.loadingCtrl.create({ message: "Consultando Catastro...", spinner: "crescent" });
    await loading.present();

    try {
      const catastroData = await this.catastroService.getParcelByCoordinates(this.currentPhoto.latitude, this.currentPhoto.longitude);
      this.currentPhoto.catastroRef = catastroData.referenciaCatastral;
      this.currentPhoto.catastroData = catastroData;
      await this.storageService.updatePhoto(this.currentPhoto);
      this.showToast("Datos catastrales obtenidos", "success");
    } catch (error: any) {
      this.showToast(error.message || "Error al consultar Catastro", "danger");
    }

    await loading.dismiss();
  }

  async getAIDescription() {
    if (!this.currentPhoto || !this.currentPhoto.imagePath) return;

    const loading = await this.loadingCtrl.create({ message: "Analizando imagen con IA...", spinner: "crescent" });
    await loading.present();

    try {
      const description = await this.claudeService.analyzeImage(this.currentPhoto.imagePath);
      this.currentPhoto.aiDescription = description;
      await this.storageService.updatePhoto(this.currentPhoto);
      this.showToast("Descripcion generada", "success");
    } catch (error: any) {
      this.showToast(error.message || "Error al analizar imagen", "danger");
    }

    await loading.dismiss();
  }

  async addNotes() {
    const alert = await this.alertCtrl.create({
      header: "Notas",
      inputs: [{ name: "notes", type: "textarea", placeholder: "Escribe tus notas aqui...", value: this.currentPhoto?.notes || "" }],
      buttons: [
        { text: "Cancelar", role: "cancel" },
        { text: "Guardar", handler: async (data) => { if (this.currentPhoto) { this.currentPhoto.notes = data.notes; await this.storageService.updatePhoto(this.currentPhoto); } } }
      ]
    });
    await alert.present();
  }

  clearPhoto() { this.currentPhoto = null; this.gpsStatus = "Obteniendo ubicacion..."; }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, position: "bottom", color });
    await toast.present();
  }
}
