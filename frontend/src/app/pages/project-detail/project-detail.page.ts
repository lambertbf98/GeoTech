import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, AlertController, Platform } from '@ionic/angular';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription, firstValueFrom } from 'rxjs';
import { StorageService } from '../../services/storage.service';
import { KmlService } from '../../services/kml.service';
import { ReportService } from '../../services/report.service';
import { ClaudeService } from '../../services/claude.service';
import { ApiService } from '../../services/api.service';
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
    private apiService: ApiService,
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

      // Sincronizar contenido y fotos desde la nube si hay serverId
      if (this.project.serverId) {
        await this.syncProjectContent();
        await this.syncPhotosFromCloud();
        await this.syncDocumentsFromCloud();
      }
    }
  }

  // Sincronizar contenido del proyecto desde el servidor
  private async syncProjectContent() {
    if (!this.project?.serverId) return;

    try {
      const response: any = await firstValueFrom(
        this.apiService.get(`/projects/${this.project.serverId}`)
      );

      if (response?.project) {
        const serverProject = response.project;
        const serverContent = serverProject.content || {};
        const serverUpdated = new Date(serverProject.updatedAt || 0).getTime();
        const localUpdated = new Date(this.project.updatedAt || 0).getTime();

        // Si el servidor es más reciente, actualizar contenido local
        if (serverUpdated > localUpdated) {
          if (serverContent.zones) this.project.zones = serverContent.zones;
          if (serverContent.paths) this.project.paths = serverContent.paths;
          if (serverContent.markers) this.project.markers = serverContent.markers;
          if (serverContent.coordinates) this.project.coordinates = serverContent.coordinates;
          this.project.updatedAt = new Date(serverProject.updatedAt);
          await this.storageService.saveProject(this.project);
          console.log('Contenido del proyecto actualizado desde servidor');
        }
      }
    } catch (e: any) {
      console.log('Error sincronizando contenido:', e?.message);
    }
  }

  // Sincronizar fotos desde el servidor
  private async syncPhotosFromCloud() {
    if (!this.project?.serverId) return;

    try {
      const response: any = await firstValueFrom(
        this.apiService.getPhotosByProject(this.project.serverId)
      );

      if (response?.photos && Array.isArray(response.photos)) {
        const serverPhotos = response.photos;
        console.log('Fotos en servidor:', serverPhotos.length);

        // Crear mapa de fotos locales por serverId
        const localByServerId = new Map<string, Photo>();
        this.photos.forEach(p => {
          if (p.serverId) localByServerId.set(p.serverId, p);
        });

        let hasNewPhotos = false;

        // Descargar fotos del servidor que no están localmente
        for (const sp of serverPhotos) {
          if (!localByServerId.has(sp.id)) {
            const newPhoto: Photo = {
              id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              serverId: sp.id,
              projectId: this.project.id,
              imageUrl: sp.imageUrl,
              thumbnailUrl: sp.thumbnailUrl,
              latitude: parseFloat(sp.latitude) || 0,
              longitude: parseFloat(sp.longitude) || 0,
              altitude: sp.altitude ? parseFloat(sp.altitude) : undefined,
              notes: sp.notes,
              aiDescription: sp.aiDescription,
              timestamp: sp.createdAt,
              synced: true
            };

            await this.storageService.savePhoto(newPhoto);
            this.photos.push(newPhoto);
            localByServerId.set(sp.id, newPhoto);
            hasNewPhotos = true;
            console.log('Foto descargada del servidor:', sp.id);
          }
        }

        // Resolver serverPhotoIds a photoIds locales en los marcadores
        if (this.project.markers && hasNewPhotos) {
          let markersUpdated = false;
          for (const marker of this.project.markers) {
            if (marker.serverPhotoIds && marker.serverPhotoIds.length > 0) {
              const existingPhotoIds = new Set(marker.photoIds || []);

              for (const serverPhotoId of marker.serverPhotoIds) {
                const localPhoto = localByServerId.get(serverPhotoId);
                if (localPhoto && !existingPhotoIds.has(localPhoto.id)) {
                  existingPhotoIds.add(localPhoto.id);
                  markersUpdated = true;
                }
              }

              if (markersUpdated) {
                marker.photoIds = Array.from(existingPhotoIds);
              }
            }
          }
          if (markersUpdated) {
            await this.storageService.saveProject(this.project);
          }
        }
      }
    } catch (e: any) {
      console.log('Error sincronizando fotos:', e?.message);
    }
  }

  // Sincronizar reports y KMLs desde el servidor
  private async syncDocumentsFromCloud() {
    if (!this.project?.serverId) return;

    try {
      // Sincronizar Reports
      const reportsResponse: any = await firstValueFrom(
        this.apiService.getReportsByProject(this.project.serverId)
      );

      if (reportsResponse?.reports && Array.isArray(reportsResponse.reports)) {
        const serverReports = reportsResponse.reports;
        const localReports = this.project.reports || [];
        const localReportIds = new Set(localReports.map(r => r.id));

        let hasNewReports = false;
        for (const sr of serverReports) {
          if (!localReportIds.has(sr.id)) {
            // Obtener el contenido completo del informe
            try {
              const fullReport: any = await firstValueFrom(
                this.apiService.getReport(sr.id)
              );
              if (fullReport?.report) {
                localReports.push({
                  id: fullReport.report.id,
                  name: fullReport.report.name,
                  htmlContent: fullReport.report.htmlContent,
                  createdAt: fullReport.report.createdAt
                });
                hasNewReports = true;
                console.log('Informe sincronizado desde servidor:', sr.name);
              }
            } catch (e) {
              console.log('Error obteniendo informe:', sr.id);
            }
          }
        }

        if (hasNewReports) {
          this.project.reports = localReports;
          await this.storageService.saveProject(this.project);
        }
      }

      // Sincronizar KMLs
      const kmlsResponse: any = await firstValueFrom(
        this.apiService.getKmlsByProject(this.project.serverId)
      );

      if (kmlsResponse?.kmlFiles && Array.isArray(kmlsResponse.kmlFiles)) {
        const serverKmls = kmlsResponse.kmlFiles;
        const localKmls = this.project.kmls || [];
        const localKmlIds = new Set(localKmls.map(k => k.id));

        let hasNewKmls = false;
        for (const sk of serverKmls) {
          if (!localKmlIds.has(sk.id)) {
            // Obtener el contenido completo del KML
            try {
              const fullKml: any = await firstValueFrom(
                this.apiService.getKml(sk.id)
              );
              if (fullKml?.kml) {
                localKmls.push({
                  id: fullKml.kml.id,
                  name: fullKml.kml.name,
                  kmlContent: fullKml.kml.kmlContent,
                  createdAt: fullKml.kml.createdAt
                });
                hasNewKmls = true;
                console.log('KML sincronizado desde servidor:', sk.name);
              }
            } catch (e) {
              console.log('Error obteniendo KML:', sk.id);
            }
          }
        }

        if (hasNewKmls) {
          this.project.kmls = localKmls;
          await this.storageService.saveProject(this.project);
        }
      }
    } catch (e: any) {
      console.log('Error sincronizando documentos:', e?.message);
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
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' ' + d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
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
            // Eliminar del servidor si existe
            try {
              await firstValueFrom(this.apiService.deleteReport(report.id));
              console.log('Informe eliminado del servidor:', report.id);
            } catch (e: any) {
              console.log('Error eliminando del servidor:', e?.message);
            }
            // Eliminar localmente
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

      // Inyectar estilos para los popups con fotos
      this.injectKmlPopupStyles();

      // Procesar Placemarks
      const placemarks = kmlDoc.getElementsByTagName('Placemark');

      for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];
        const name = placemark.getElementsByTagName('name')[0]?.textContent || 'Sin nombre';
        // Obtener descripción - puede estar en CDATA
        let description = '';
        const descEl = placemark.getElementsByTagName('description')[0];
        if (descEl) {
          // textContent extrae el contenido incluyendo CDATA
          description = descEl.textContent || '';
        }

        // Procesar puntos
        const points = placemark.getElementsByTagName('Point');
        for (let j = 0; j < points.length; j++) {
          const coords = points[j].getElementsByTagName('coordinates')[0]?.textContent?.trim();
          if (coords) {
            const [lng, lat] = coords.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              const marker = L.marker([lat, lng]).addTo(this.kmlMap!);
              // Create rich popup with scrollable content for photos
              const popupContent = `
                <div class="kml-popup-content">
                  <h3 class="kml-popup-title">${this.escapeHtml(name)}</h3>
                  <div class="kml-popup-description">${description}</div>
                </div>
              `;
              marker.bindPopup(popupContent, {
                maxWidth: 450,
                maxHeight: 500,
                className: 'kml-rich-popup'
              });
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
              polyline.bindPopup(`<strong>${this.escapeHtml(name)}</strong><br>${description}`);
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
              polygon.bindPopup(`<strong>${this.escapeHtml(name)}</strong><br>${description}`);
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

  private injectKmlPopupStyles() {
    // Solo inyectar si no existe ya
    if (document.getElementById('kml-popup-styles')) return;

    const style = document.createElement('style');
    style.id = 'kml-popup-styles';
    style.textContent = `
      .kml-rich-popup .leaflet-popup-content-wrapper {
        background: #1e293b;
        color: #f1f5f9;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      }
      .kml-rich-popup .leaflet-popup-tip {
        background: #1e293b;
      }
      .kml-rich-popup .leaflet-popup-close-button {
        color: #94a3b8;
      }
      .kml-popup-content {
        max-width: 420px;
        max-height: 450px;
        overflow-y: auto;
        padding: 4px;
      }
      .kml-popup-title {
        margin: 0 0 12px 0;
        font-size: 18px;
        font-weight: 600;
        color: #3b82f6;
        border-bottom: 1px solid #334155;
        padding-bottom: 8px;
      }
      .kml-popup-description {
        font-size: 14px;
        line-height: 1.5;
      }
      .kml-popup-description img {
        max-width: 100%;
        max-height: 250px;
        border-radius: 8px;
        margin: 8px 0;
        display: block;
        object-fit: contain;
      }
      .kml-popup-description p {
        margin: 8px 0;
      }
      .kml-popup-description hr {
        border: none;
        border-top: 1px solid #334155;
        margin: 12px 0;
      }
      .kml-popup-description h4 {
        color: #94a3b8;
        font-size: 14px;
        margin: 12px 0 8px 0;
      }
    `;
    document.head.appendChild(style);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
            // Eliminar del servidor si existe
            try {
              await firstValueFrom(this.apiService.deleteKml(kml.id));
              console.log('KML eliminado del servidor:', kml.id);
            } catch (e: any) {
              console.log('Error eliminando del servidor:', e?.message);
            }
            // Eliminar localmente
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
