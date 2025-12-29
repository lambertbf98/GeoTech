import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, AlertController, Platform } from '@ionic/angular';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { StorageService } from '../../services/storage.service';
import { KmlService } from '../../services/kml.service';
import { ReportService } from '../../services/report.service';
import { ClaudeService } from '../../services/claude.service';
import { Project, Photo, ProjectReport, ProjectKml } from '../../models';
import * as L from 'leaflet';

@Component({
  standalone: false,
  selector: 'app-project-detail',
  templateUrl: './project-detail.page.html',
  styleUrls: ['./project-detail.page.scss'],
})
export class ProjectDetailPage implements OnInit, OnDestroy {
  project: Project | null = null;
  photos: Photo[] = [];
  private projectId: string | null = null;
  private backButtonSub: Subscription | null = null;

  // Photo viewer
  selectedPhoto: Photo | null = null;
  showPhotoViewer = false;

  // Report viewer
  selectedReport: ProjectReport | null = null;
  selectedReportHtml: SafeHtml = '';
  showReportViewer = false;

  // KML viewer
  selectedKml: ProjectKml | null = null;
  showKmlViewer = false;
  private kmlMap: L.Map | null = null;

  // AI Analysis
  isAnalyzingPhoto = false;

  constructor(
    private route: ActivatedRoute,
    private storageService: StorageService,
    private kmlService: KmlService,
    private reportService: ReportService,
    private claudeService: ClaudeService,
    private sanitizer: DomSanitizer,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private platform: Platform
  ) {}

  async ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id');
    if (this.projectId) {
      await this.loadProject(this.projectId);
    }
  }

  // Refrescar datos cada vez que se entra a la página
  async ionViewWillEnter() {
    if (this.projectId) {
      await this.loadProject(this.projectId);
    }
    // Registrar manejador de botón de retroceso
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, () => {
      this.handleBackButton();
    });
  }

  ionViewWillLeave() {
    // Desregistrar manejador de botón de retroceso
    if (this.backButtonSub) {
      this.backButtonSub.unsubscribe();
      this.backButtonSub = null;
    }
  }

  ngOnDestroy() {
    if (this.backButtonSub) {
      this.backButtonSub.unsubscribe();
    }
  }

  private handleBackButton() {
    // Si hay un visor abierto, cerrarlo en lugar de navegar atrás
    if (this.showPhotoViewer) {
      this.closePhotoViewer();
    } else if (this.showReportViewer) {
      this.closeReportViewer();
    } else if (this.showKmlViewer) {
      this.closeKmlViewer();
    } else {
      this.goBack();
    }
  }

  async loadProject(projectId: string) {
    const projects = await this.storageService.getProjects();
    this.project = projects.find(p => p.id === projectId) || null;

    if (this.project) {
      const allPhotos = await this.storageService.getPhotos();
      this.photos = allPhotos.filter(p => p.projectId === projectId);
    }
  }

  goBack() {
    this.navCtrl.navigateBack('/tabs/projects');
  }

  openMapEditor() {
    if (this.project) {
      this.navCtrl.navigateForward(`/project-editor/${this.project.id}`);
    }
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatDateTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' - ' + d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // Photo viewer methods
  openPhotoViewer(photo: Photo) {
    this.selectedPhoto = photo;
    this.showPhotoViewer = true;
  }

  closePhotoViewer() {
    this.showPhotoViewer = false;
    this.selectedPhoto = null;
  }

  async confirmDeletePhoto() {
    if (!this.selectedPhoto) return;

    const alert = await this.alertCtrl.create({
      header: 'Eliminar foto',
      message: '¿Estás seguro de que quieres eliminar esta foto? Esta acción no se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.deletePhoto();
          }
        }
      ]
    });
    await alert.present();
  }

  async deletePhoto() {
    if (!this.selectedPhoto || !this.project) return;

    try {
      await this.storageService.deletePhoto(this.selectedPhoto.id);
      this.closePhotoViewer();
      await this.loadProject(this.project.id);
    } catch (error) {
      // Error silencioso
    }
  }

  async editPhotoNotes() {
    if (!this.selectedPhoto) return;

    const alert = await this.alertCtrl.create({
      header: 'Editar notas',
      inputs: [
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Escribe tus notas aquí...',
          value: this.selectedPhoto.notes || ''
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (this.selectedPhoto) {
              this.selectedPhoto.notes = data.notes;
              await this.storageService.updatePhoto(this.selectedPhoto);
              // Actualizar en la lista local
              const index = this.photos.findIndex(p => p.id === this.selectedPhoto!.id);
              if (index >= 0) {
                this.photos[index] = { ...this.selectedPhoto };
              }
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async editAIDescription() {
    if (!this.selectedPhoto) return;

    const alert = await this.alertCtrl.create({
      header: 'Editar descripción IA',
      inputs: [
        {
          name: 'aiDescription',
          type: 'textarea',
          placeholder: 'Descripción generada por IA...',
          value: this.selectedPhoto.aiDescription || ''
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (this.selectedPhoto) {
              this.selectedPhoto.aiDescription = data.aiDescription;
              await this.storageService.updatePhoto(this.selectedPhoto);
              // Actualizar en la lista local
              const index = this.photos.findIndex(p => p.id === this.selectedPhoto!.id);
              if (index >= 0) {
                this.photos[index] = { ...this.selectedPhoto };
              }
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async analyzePhotoWithAI() {
    if (!this.selectedPhoto) return;

    this.isAnalyzingPhoto = true;
    try {
      const imagePath = this.selectedPhoto.imageUrl || this.selectedPhoto.localPath || this.selectedPhoto.imagePath || '';
      const description = await this.claudeService.analyzeImage(imagePath);

      this.selectedPhoto.aiDescription = description;
      await this.storageService.updatePhoto(this.selectedPhoto);

      // Actualizar en la lista local
      const index = this.photos.findIndex(p => p.id === this.selectedPhoto!.id);
      if (index >= 0) {
        this.photos[index] = { ...this.selectedPhoto };
      }
    } catch (error: any) {
      // Error silencioso
    } finally {
      this.isAnalyzingPhoto = false;
    }
  }

  onImageError(event: any) {
    // Ocultar imagen rota y mostrar placeholder
    event.target.style.display = 'none';
    const parent = event.target.parentElement;
    if (parent && !parent.querySelector('.photo-placeholder')) {
      const placeholder = document.createElement('div');
      placeholder.className = 'photo-placeholder';
      placeholder.innerHTML = '<ion-icon name="image-outline"></ion-icon>';
      parent.insertBefore(placeholder, event.target);
    }
  }

  // ========== REPORTS METHODS ==========

  openReportViewer(report: ProjectReport) {
    this.selectedReport = report;
    this.selectedReportHtml = this.sanitizer.bypassSecurityTrustHtml(report.htmlContent);
    this.showReportViewer = true;
  }

  closeReportViewer() {
    this.showReportViewer = false;
    this.selectedReport = null;
    this.selectedReportHtml = '';
  }

  async downloadReportAsWord(report: ProjectReport) {
    if (!report || !this.project) return;

    // Crear un blob con el HTML y descargarlo como archivo
    const blob = new Blob([report.htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async deleteReport(report: ProjectReport) {
    if (!this.project) return;

    const alert = await this.alertCtrl.create({
      header: 'Eliminar informe',
      message: '¿Seguro que quieres eliminar este informe?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            this.project!.reports = this.project!.reports?.filter(r => r.id !== report.id);
            await this.storageService.saveProject(this.project!);
            this.closeReportViewer();
          }
        }
      ]
    });
    await alert.present();
  }

  // ========== KML METHODS ==========

  openKmlViewer(kml: ProjectKml) {
    this.selectedKml = kml;
    this.showKmlViewer = true;
    // Inicializar mapa después de que el DOM se actualice
    setTimeout(() => this.initKmlMap(kml), 100);
  }

  closeKmlViewer() {
    if (this.kmlMap) {
      this.kmlMap.remove();
      this.kmlMap = null;
    }
    this.showKmlViewer = false;
    this.selectedKml = null;
  }

  private initKmlMap(kml: ProjectKml) {
    const mapContainer = document.getElementById('kmlViewerMap');
    if (!mapContainer) return;

    // Crear mapa
    this.kmlMap = L.map('kmlViewerMap', {
      zoomControl: true,
      attributionControl: false
    }).setView([40.4168, -3.7038], 6); // Centro de España por defecto

    // Capa satelital
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(this.kmlMap);

    // Parsear y renderizar KML
    this.renderKmlOnMap(kml.kmlContent);
  }

  private renderKmlOnMap(kmlContent: string) {
    if (!this.kmlMap) return;

    try {
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlContent, 'text/xml');
      const bounds = L.latLngBounds([]);

      // Procesar Placemarks
      const placemarks = kmlDoc.getElementsByTagName('Placemark');

      for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];
        const name = placemark.getElementsByTagName('name')[0]?.textContent || 'Sin nombre';
        const description = placemark.getElementsByTagName('description')[0]?.textContent || '';

        // Procesar puntos
        const points = placemark.getElementsByTagName('Point');
        for (let j = 0; j < points.length; j++) {
          const coords = points[j].getElementsByTagName('coordinates')[0]?.textContent?.trim();
          if (coords) {
            const [lng, lat] = coords.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              const marker = L.marker([lat, lng]).addTo(this.kmlMap!);
              marker.bindPopup(`<strong>${name}</strong><br>${description}`);
              bounds.extend([lat, lng]);
            }
          }
        }

        // Procesar líneas
        const lineStrings = placemark.getElementsByTagName('LineString');
        for (let j = 0; j < lineStrings.length; j++) {
          const coords = lineStrings[j].getElementsByTagName('coordinates')[0]?.textContent?.trim();
          if (coords) {
            const latLngs = coords.split(/\s+/).map(coord => {
              const [lng, lat] = coord.split(',').map(Number);
              return [lat, lng] as [number, number];
            }).filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));

            if (latLngs.length > 0) {
              const polyline = L.polyline(latLngs, { color: '#3b82f6', weight: 4 }).addTo(this.kmlMap!);
              polyline.bindPopup(`<strong>${name}</strong><br>${description}`);
              latLngs.forEach(ll => bounds.extend(ll));
            }
          }
        }

        // Procesar polígonos
        const polygons = placemark.getElementsByTagName('Polygon');
        for (let j = 0; j < polygons.length; j++) {
          const outerBoundary = polygons[j].getElementsByTagName('outerBoundaryIs')[0];
          const coords = outerBoundary?.getElementsByTagName('coordinates')[0]?.textContent?.trim();
          if (coords) {
            const latLngs = coords.split(/\s+/).map(coord => {
              const [lng, lat] = coord.split(',').map(Number);
              return [lat, lng] as [number, number];
            }).filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));

            if (latLngs.length > 0) {
              const polygon = L.polygon(latLngs, { color: '#10b981', fillOpacity: 0.3 }).addTo(this.kmlMap!);
              polygon.bindPopup(`<strong>${name}</strong><br>${description}`);
              latLngs.forEach(ll => bounds.extend(ll));
            }
          }
        }
      }

      // Ajustar vista a los elementos
      if (bounds.isValid()) {
        this.kmlMap.fitBounds(bounds, { padding: [20, 20] });
      }
    } catch (error) {
      console.error('Error parsing KML:', error);
    }
  }

  downloadKml(kml: ProjectKml) {
    if (!kml) return;

    const blob = new Blob([kml.kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kml.name}.kml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async deleteKml(kml: ProjectKml) {
    if (!this.project) return;

    const alert = await this.alertCtrl.create({
      header: 'Eliminar archivo KML',
      message: '¿Seguro que quieres eliminar este archivo?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            this.project!.kmls = this.project!.kmls?.filter(k => k.id !== kml.id);
            await this.storageService.saveProject(this.project!);
            this.closeKmlViewer();
          }
        }
      ]
    });
    await alert.present();
  }

  // Getters for counts
  get reportCount(): number {
    return this.project?.reports?.length || 0;
  }

  get kmlCount(): number {
    return this.project?.kmls?.length || 0;
  }

  get zoneCount(): number {
    return this.project?.zones?.length || 0;
  }

  get pathCount(): number {
    return this.project?.paths?.length || 0;
  }

  get markerCount(): number {
    return this.project?.markers?.length || 0;
  }

  get totalDocuments(): number {
    return this.reportCount + this.kmlCount;
  }
}
