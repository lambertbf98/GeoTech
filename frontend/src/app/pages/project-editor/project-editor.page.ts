import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, AlertController, ToastController, ActionSheetController } from '@ionic/angular';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { StorageService } from '../../services/storage.service';
import { GpsService } from '../../services/gps.service';
import { CameraService } from '../../services/camera.service';
import { ClaudeService } from '../../services/claude.service';
import { KmlService, ProjectExportData } from '../../services/kml.service';
import { ReportService, ReportData } from '../../services/report.service';
import { Project, ProjectZone, ProjectPath, ProjectMarker, GeoPoint, Photo } from '../../models';
import * as L from 'leaflet';

type DrawMode = 'none' | 'zone' | 'path' | 'marker';

@Component({
  standalone: false,
  selector: 'app-project-editor',
  templateUrl: './project-editor.page.html',
  styleUrls: ['./project-editor.page.scss'],
})
export class ProjectEditorPage implements OnInit, OnDestroy {
  project: Project | null = null;
  photos: Photo[] = [];

  // AI loading state
  isGeneratingPDD = false;
  isAnalyzingPhoto = false;

  // Report preview
  showReportPreview = false;
  reportPreviewHtml: SafeHtml = '';
  private reportPreviewRawHtml = '';
  private pendingReportData: any = null;

  // Drawing state
  drawMode: DrawMode = 'none';
  currentPoints: L.LatLng[] = [];

  // Map layers
  private map: L.Map | null = null;
  private satelliteLayer: L.TileLayer | null = null;
  private zonesLayer: L.LayerGroup | null = null;
  private pathsLayer: L.LayerGroup | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private drawLayer: L.LayerGroup | null = null;
  private currentDrawing: L.Polyline | L.Polygon | null = null;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private sanitizer: DomSanitizer,
    private storageService: StorageService,
    private gpsService: GpsService,
    private cameraService: CameraService,
    private claudeService: ClaudeService,
    private kmlService: KmlService,
    private reportService: ReportService
  ) {}

  async ngOnInit() {
    const projectId = this.route.snapshot.paramMap.get('id');
    if (projectId) {
      await this.loadProject(projectId);
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  ionViewDidEnter() {
    setTimeout(() => this.initMap(), 300);
  }

  async loadProject(projectId: string) {
    const project = await this.storageService.getProject(projectId);
    this.photos = await this.storageService.getPhotos(projectId);

    if (!project) {
      this.showToast('Proyecto no encontrado', 'danger');
      this.navCtrl.back();
      return;
    }

    this.project = project;

    // Initialize arrays if not exist
    if (!this.project.zones) this.project.zones = [];
    if (!this.project.paths) this.project.paths = [];
    if (!this.project.markers) this.project.markers = [];
  }

  private initMap() {
    if (this.map || !this.project) return;

    const container = document.getElementById('editorMap');
    if (!container) return;

    // Default to project coordinates or Spain center
    const lat = this.project.coordinates?.lat || 40.416775;
    const lng = this.project.coordinates?.lng || -3.703790;

    // Fix Leaflet icons
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    this.map = L.map('editorMap', {
      zoomControl: false,
      maxZoom: 22,
      minZoom: 3
    }).setView([lat, lng], 16);

    // Satellite layer
    this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 22,
      maxNativeZoom: 19
    }).addTo(this.map);

    // Layer groups
    this.zonesLayer = L.layerGroup().addTo(this.map);
    this.pathsLayer = L.layerGroup().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.drawLayer = L.layerGroup().addTo(this.map);

    // Add zoom control
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Map click handler
    this.map.on('click', (e: L.LeafletMouseEvent) => this.onMapClick(e));

    // Load existing elements
    this.renderProjectElements();
  }

  private renderProjectElements() {
    if (!this.project || !this.map) return;

    // Clear layers
    this.zonesLayer?.clearLayers();
    this.pathsLayer?.clearLayers();
    this.markersLayer?.clearLayers();

    // Render zones - con click handler para mostrar opciones
    this.project.zones?.forEach(zone => {
      const latlngs = zone.coordinates.map(c => L.latLng(c.lat, c.lng));
      const polygon = L.polygon(latlngs, {
        color: zone.color || '#ef4444',
        weight: 3,
        fillOpacity: 0.2,
        bubblingMouseEvents: true
      });
      polygon.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        this.showZoneOptions(zone);
      });
      polygon.addTo(this.zonesLayer!);
    });

    // Render paths - con click handler para mostrar opciones
    this.project.paths?.forEach(path => {
      const latlngs = path.coordinates.map(c => L.latLng(c.lat, c.lng));
      const polyline = L.polyline(latlngs, {
        color: path.color || '#3b82f6',
        weight: 4,
        bubblingMouseEvents: true
      });
      polyline.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        this.showPathOptions(path);
      });
      polyline.addTo(this.pathsLayer!);
    });

    // Render markers
    this.project.markers?.forEach(marker => {
      this.addMarkerToMap(marker);
    });

    // Render photos as markers
    this.photos.forEach(photo => {
      if (photo.latitude && photo.longitude) {
        const icon = L.divIcon({
          className: 'photo-marker',
          html: '<div class="photo-marker-dot"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        const marker = L.marker([photo.latitude, photo.longitude], { icon });
        marker.bindPopup(this.createPhotoPopup(photo));
        marker.addTo(this.markersLayer!);
      }
    });

    // Fit bounds if we have elements
    this.fitBoundsToContent();
  }

  private fitBoundsToContent() {
    if (!this.map || !this.project) return;

    const allCoords: L.LatLng[] = [];

    this.project.zones?.forEach(z => z.coordinates.forEach(c => allCoords.push(L.latLng(c.lat, c.lng))));
    this.project.paths?.forEach(p => p.coordinates.forEach(c => allCoords.push(L.latLng(c.lat, c.lng))));
    this.project.markers?.forEach(m => allCoords.push(L.latLng(m.coordinate.lat, m.coordinate.lng)));
    this.photos.forEach(p => {
      if (p.latitude && p.longitude) allCoords.push(L.latLng(p.latitude, p.longitude));
    });

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    }
  }

  // ========== DRAWING METHODS ==========

  setDrawMode(mode: DrawMode) {
    if (this.drawMode === mode) {
      this.cancelDrawing();
      return;
    }

    this.cancelDrawing();
    this.drawMode = mode;

    // Desactivar interacción con elementos existentes cuando dibujamos
    this.setLayersInteractive(mode === 'none');
  }

  private setLayersInteractive(interactive: boolean) {
    // Desactivar/activar interacción con zonas
    this.zonesLayer?.eachLayer((layer: any) => {
      if (interactive) {
        layer.options.interactive = true;
        if (layer._path) layer._path.style.pointerEvents = 'auto';
      } else {
        layer.options.interactive = false;
        if (layer._path) layer._path.style.pointerEvents = 'none';
      }
    });

    // Desactivar/activar interacción con viales
    this.pathsLayer?.eachLayer((layer: any) => {
      if (interactive) {
        layer.options.interactive = true;
        if (layer._path) layer._path.style.pointerEvents = 'auto';
      } else {
        layer.options.interactive = false;
        if (layer._path) layer._path.style.pointerEvents = 'none';
      }
    });

    // Desactivar/activar interacción con marcadores
    this.markersLayer?.eachLayer((layer: any) => {
      if (interactive) {
        layer.options.interactive = true;
        if (layer._icon) layer._icon.style.pointerEvents = 'auto';
      } else {
        layer.options.interactive = false;
        if (layer._icon) layer._icon.style.pointerEvents = 'none';
      }
    });
  }

  private onMapClick(e: L.LeafletMouseEvent) {
    if (this.drawMode === 'none') return;

    if (this.drawMode === 'marker') {
      this.addNewMarker(e.latlng);
      return;
    }

    // For zone and path drawing
    this.currentPoints.push(e.latlng);
    this.updateDrawing();
  }

  private updateDrawing() {
    if (!this.drawLayer || this.currentPoints.length === 0) return;

    this.drawLayer.clearLayers();

    // Draw points
    this.currentPoints.forEach((point, i) => {
      const icon = L.divIcon({
        className: 'draw-point',
        html: `<div class="draw-dot">${i + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      L.marker(point, { icon }).addTo(this.drawLayer!);
    });

    // Draw shape
    if (this.currentPoints.length >= 2) {
      if (this.drawMode === 'zone') {
        this.currentDrawing = L.polygon(this.currentPoints, {
          color: '#ef4444',
          weight: 3,
          fillOpacity: 0.2,
          dashArray: '10, 5'
        }).addTo(this.drawLayer!);
      } else if (this.drawMode === 'path') {
        this.currentDrawing = L.polyline(this.currentPoints, {
          color: '#3b82f6',
          weight: 4,
          dashArray: '10, 5'
        }).addTo(this.drawLayer!);
      }
    }
  }

  async finishDrawing() {
    if (this.currentPoints.length < 2) {
      return;
    }

    if (this.drawMode === 'zone' && this.currentPoints.length < 3) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: this.drawMode === 'zone' ? 'Nueva Zona' : 'Nuevo Vial',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: this.drawMode === 'zone' ? 'Nombre de la zona' : 'Nombre del vial'
        },
        {
          name: 'description',
          type: 'textarea',
          placeholder: 'Descripcion (opcional)'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            if (!data.name?.trim()) {
              return false;
            }
            this.saveDrawing(data.name, data.description);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async saveDrawing(name: string, description?: string) {
    if (!this.project) return;

    const coordinates: GeoPoint[] = this.currentPoints.map(p => ({ lat: p.lat, lng: p.lng }));
    const id = `${this.drawMode}_${Date.now()}`;

    if (this.drawMode === 'zone') {
      const zone: ProjectZone = {
        id,
        name,
        description,
        coordinates,
        color: '#ef4444',
        createdAt: new Date().toISOString()
      };
      this.project.zones = this.project.zones || [];
      this.project.zones.push(zone);
    } else if (this.drawMode === 'path') {
      const path: ProjectPath = {
        id,
        name,
        description,
        coordinates,
        color: '#3b82f6',
        createdAt: new Date().toISOString()
      };
      this.project.paths = this.project.paths || [];
      this.project.paths.push(path);
    }

    await this.saveProject();
    this.cancelDrawing();
    this.renderProjectElements();
  }

  cancelDrawing() {
    this.drawMode = 'none';
    this.currentPoints = [];
    this.currentDrawing = null;
    this.drawLayer?.clearLayers();
    // Restaurar interactividad de los elementos
    this.setLayersInteractive(true);
  }

  undoLastPoint() {
    if (this.currentPoints.length > 0) {
      this.currentPoints.pop();
      this.updateDrawing();
    }
  }

  // ========== MARKER METHODS ==========

  private async addNewMarker(latlng: L.LatLng) {
    const alert = await this.alertCtrl.create({
      header: 'Nuevo Punto',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Nombre del punto'
        },
        {
          name: 'description',
          type: 'textarea',
          placeholder: 'Descripcion/notas'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (!data.name?.trim()) {
              return false;
            }
            await this.saveMarker(latlng, data.name, data.description);
            return true;
          }
        }
      ]
    });
    await alert.present();
    this.drawMode = 'none';
  }

  private async saveMarker(latlng: L.LatLng, name: string, description?: string) {
    if (!this.project) return;

    const marker: ProjectMarker = {
      id: `marker_${Date.now()}`,
      name,
      description,
      coordinate: { lat: latlng.lat, lng: latlng.lng },
      createdAt: new Date().toISOString()
    };

    this.project.markers = this.project.markers || [];
    this.project.markers.push(marker);

    await this.saveProject();
    this.renderProjectElements();
  }

  async takePhotoForMarker(marker: ProjectMarker) {
    try {
      const photoData = await this.cameraService.takePhoto();

      if (photoData && this.project) {
        // Guardar base64 para persistencia
        const base64Image = photoData.base64 ? `data:image/jpeg;base64,${photoData.base64}` : (photoData.webviewPath || photoData.webPath);

        const photo: Photo = {
          id: `photo_${Date.now()}`,
          projectId: this.project.id,
          localPath: photoData.filepath,
          imageUrl: base64Image,
          latitude: marker.coordinate.lat,
          longitude: marker.coordinate.lng,
          timestamp: new Date().toISOString(),
          synced: false,
          notes: `Punto: ${marker.name}`
        };

        await this.storageService.savePhoto(photo);
        this.photos.push(photo);

        // Vincular foto al marcador
        marker.photoIds = marker.photoIds || [];
        marker.photoIds.push(photo.id);
        await this.saveProject();

        this.renderProjectElements();
      }
    } catch (error: any) {
      // Error silencioso
    }
  }

  private addMarkerToMap(marker: ProjectMarker) {
    const hasPhotos = marker.photoIds && marker.photoIds.length > 0;
    const icon = L.divIcon({
      className: hasPhotos ? 'project-marker has-photo' : 'project-marker',
      html: `<div class="marker-pin">${hasPhotos ? '<span class="photo-badge"></span>' : ''}</div>`,
      iconSize: [24, 32],
      iconAnchor: [12, 32]
    });
    const mapMarker = L.marker([marker.coordinate.lat, marker.coordinate.lng], { icon });
    mapMarker.on('click', () => this.showMarkerOptions(marker));
    mapMarker.addTo(this.markersLayer!);
  }

  async showMarkerOptions(marker: ProjectMarker) {
    const hasPhotos = marker.photoIds && marker.photoIds.length > 0;
    const markerPhotos = hasPhotos ? this.photos.filter(p => marker.photoIds!.includes(p.id)) : [];

    const buttons: any[] = [];

    // Si hay fotos, mostrar opción de ver
    if (hasPhotos) {
      buttons.push({
        text: `Ver ${markerPhotos.length} foto${markerPhotos.length > 1 ? 's' : ''}`,
        icon: 'images-outline',
        handler: () => this.showMarkerPhotos(marker, markerPhotos)
      });
    }

    buttons.push({
      text: 'Tomar foto',
      icon: 'camera-outline',
      handler: () => this.takePhotoForMarker(marker)
    });

    // Opción de análisis IA siempre visible
    buttons.push({
      text: 'Analizar con IA',
      icon: 'sparkles-outline',
      handler: () => {
        if (hasPhotos) {
          this.analyzeMarkerPhotosWithAI(markerPhotos);
        } else {
          this.showNoPhotosAlert();
        }
      }
    });

    buttons.push({
      text: 'Editar notas',
      icon: 'create-outline',
      handler: () => this.editMarkerNotes(marker)
    });

    buttons.push({
      text: 'Eliminar punto',
      icon: 'trash-outline',
      role: 'destructive',
      handler: () => this.deleteMarker(marker)
    });

    buttons.push({ text: 'Cancelar', icon: 'close', role: 'cancel' });

    const actionSheet = await this.actionSheetCtrl.create({
      header: marker.name,
      subHeader: marker.description || marker.aiDescription || `${marker.coordinate.lat.toFixed(5)}, ${marker.coordinate.lng.toFixed(5)}`,
      buttons
    });
    await actionSheet.present();
  }

  async showNoPhotosAlert() {
    const alert = await this.alertCtrl.create({
      header: 'Sin fotos',
      message: 'Primero debes tomar una foto para poder analizarla con IA.',
      buttons: ['Entendido']
    });
    await alert.present();
  }

  async analyzeMarkerPhotosWithAI(photos: Photo[]) {
    for (const photo of photos) {
      if (!photo.aiDescription) {
        await this.analyzePhotoWithAI(photo);
      }
    }
    this.renderProjectElements();
  }

  async editMarkerNotes(marker: ProjectMarker) {
    const alert = await this.alertCtrl.create({
      header: 'Editar notas',
      inputs: [
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Escribe tus notas aquí...',
          value: marker.description || ''
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            marker.description = data.notes;
            await this.saveProject();
            this.renderProjectElements();
          }
        }
      ]
    });
    await alert.present();
  }

  async showMarkerPhotos(marker: ProjectMarker, photos: Photo[]) {
    if (photos.length === 1) {
      // Mostrar directamente la foto
      this.showPhotoDetail(photos[0], marker);
    } else {
      // Mostrar lista para seleccionar
      const buttons = photos.map((photo, i) => ({
        text: `Foto ${i + 1} - ${new Date(photo.timestamp || '').toLocaleDateString('es-ES')}`,
        handler: () => this.showPhotoDetail(photo, marker)
      }));
      buttons.push({ text: 'Cancelar', role: 'cancel' } as any);

      const actionSheet = await this.actionSheetCtrl.create({
        header: 'Seleccionar foto',
        buttons
      });
      await actionSheet.present();
    }
  }

  async showPhotoDetail(photo: Photo, marker: ProjectMarker) {
    // Construir mensaje sin HTML
    let message = '';
    if (photo.aiDescription) {
      message += `Descripción IA: ${photo.aiDescription}\n\n`;
    }
    if (photo.notes) {
      message += `Notas: ${photo.notes}`;
    }
    if (!message) {
      message = 'Sin descripción. Puedes añadir notas.';
    }

    const alert = await this.alertCtrl.create({
      header: marker.name,
      subHeader: `${marker.coordinate.lat.toFixed(5)}, ${marker.coordinate.lng.toFixed(5)}`,
      message: message,
      buttons: [
        {
          text: 'Editar nota',
          handler: () => { this.editPhotoNotes(photo); return false; }
        },
        { text: 'Cerrar', role: 'cancel' }
      ]
    });
    await alert.present();
  }

  async editPhotoNotes(photo: Photo) {
    const alert = await this.alertCtrl.create({
      header: 'Editar notas de la foto',
      inputs: [
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Escribe tus notas...',
          value: photo.notes || ''
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            photo.notes = data.notes;
            await this.storageService.updatePhoto(photo);
            const index = this.photos.findIndex(p => p.id === photo.id);
            if (index >= 0) this.photos[index] = photo;
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteMarker(marker: ProjectMarker) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar punto',
      message: `¿Seguro que quieres eliminar "${marker.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            if (this.project) {
              this.project.markers = this.project.markers?.filter(m => m.id !== marker.id);
              await this.saveProject();
              this.renderProjectElements();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ========== ZONE OPTIONS ==========

  async showZoneOptions(zone: ProjectZone) {
    const buttons: any[] = [
      {
        text: 'Editar nombre/descripción',
        icon: 'create-outline',
        handler: () => this.editZone(zone)
      },
      {
        text: 'Eliminar zona',
        icon: 'trash-outline',
        role: 'destructive',
        handler: () => this.deleteZone(zone)
      },
      { text: 'Cancelar', icon: 'close', role: 'cancel' }
    ];

    const actionSheet = await this.actionSheetCtrl.create({
      header: zone.name,
      subHeader: zone.description || 'Área delimitada',
      buttons
    });
    await actionSheet.present();
  }

  async editZone(zone: ProjectZone) {
    const alert = await this.alertCtrl.create({
      header: 'Editar zona',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Nombre de la zona',
          value: zone.name
        },
        {
          name: 'description',
          type: 'textarea',
          placeholder: 'Descripción (opcional)',
          value: zone.description || ''
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (data.name?.trim()) {
              zone.name = data.name;
              zone.description = data.description;
              await this.saveProject();
              this.renderProjectElements();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteZone(zone: ProjectZone) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar zona',
      message: `¿Seguro que quieres eliminar "${zone.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            if (this.project) {
              this.project.zones = this.project.zones?.filter(z => z.id !== zone.id);
              await this.saveProject();
              this.renderProjectElements();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ========== PATH OPTIONS ==========

  async showPathOptions(path: ProjectPath) {
    const buttons: any[] = [
      {
        text: 'Editar nombre/descripción',
        icon: 'create-outline',
        handler: () => this.editPath(path)
      },
      {
        text: 'Eliminar trazado',
        icon: 'trash-outline',
        role: 'destructive',
        handler: () => this.deletePath(path)
      },
      { text: 'Cancelar', icon: 'close', role: 'cancel' }
    ];

    const actionSheet = await this.actionSheetCtrl.create({
      header: path.name,
      subHeader: path.description || 'Trazado vial',
      buttons
    });
    await actionSheet.present();
  }

  async editPath(path: ProjectPath) {
    const alert = await this.alertCtrl.create({
      header: 'Editar trazado',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Nombre del trazado',
          value: path.name
        },
        {
          name: 'description',
          type: 'textarea',
          placeholder: 'Descripción (opcional)',
          value: path.description || ''
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (data.name?.trim()) {
              path.name = data.name;
              path.description = data.description;
              await this.saveProject();
              this.renderProjectElements();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async deletePath(path: ProjectPath) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar trazado',
      message: `¿Seguro que quieres eliminar "${path.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            if (this.project) {
              this.project.paths = this.project.paths?.filter(p => p.id !== path.id);
              await this.saveProject();
              this.renderProjectElements();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ========== POPUP CREATION ==========

  private createPhotoPopup(photo: Photo): string {
    const imgSrc = photo.imageUrl || photo.localPath || '';
    return `<div class="photo-popup">${imgSrc ? `<img src="${imgSrc}" style="max-width:150px;border-radius:8px;">` : ''}<p>${photo.notes || photo.aiDescription || 'Sin descripcion'}</p><small>${photo.latitude?.toFixed(5)}, ${photo.longitude?.toFixed(5)}</small></div>`;
  }

  // ========== CAMERA/PHOTO ==========

  async takePhoto() {
    try {
      const position = await this.gpsService.getCurrentPosition();
      const photoData = await this.cameraService.takePhoto();

      if (photoData && this.project) {
        // Guardar base64 para persistencia
        const base64Image = photoData.base64 ? `data:image/jpeg;base64,${photoData.base64}` : (photoData.webviewPath || photoData.webPath);

        const photo: Photo = {
          id: `photo_${Date.now()}`,
          projectId: this.project.id,
          localPath: photoData.filepath,
          imageUrl: base64Image,
          latitude: position.latitude,
          longitude: position.longitude,
          altitude: position.altitude,
          timestamp: new Date().toISOString(),
          synced: false
        };

        await this.storageService.savePhoto(photo);
        this.photos.push(photo);
        this.renderProjectElements();

        if (this.map) {
          this.map.setView([position.latitude, position.longitude], 18);
        }
      }
    } catch (error: any) {
      // Error silencioso
    }
  }

  async analyzePhotoWithAI(photo: Photo) {
    this.isAnalyzingPhoto = true;
    try {
      const imagePath = photo.imageUrl || photo.localPath || '';
      const description = await this.claudeService.analyzeImage(imagePath);

      photo.aiDescription = description;
      await this.storageService.updatePhoto(photo);

      const index = this.photos.findIndex(p => p.id === photo.id);
      if (index >= 0) this.photos[index] = photo;

      this.renderProjectElements();
    } catch (error: any) {
      // Error silencioso para análisis IA
    } finally {
      this.isAnalyzingPhoto = false;
    }
  }

  // ========== EXPORT METHODS ==========

  async showExportOptions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Exportar Proyecto',
      buttons: [
        { text: 'Exportar a KMZ (Google Earth)', icon: 'globe-outline', handler: () => this.exportToKMZ() },
        { text: 'Generar Informe Word', icon: 'document-text-outline', handler: () => this.exportToWord() },
        { text: 'Cancelar', icon: 'close', role: 'cancel' }
      ]
    });
    await actionSheet.present();
  }

  async exportToKMZ() {
    if (!this.project) return;
    await this.saveKmlToProject();
  }

  async exportToWord() {
    if (!this.project || this.isGeneratingPDD) return;

    this.isGeneratingPDD = true;
    try {
      // 1. Preparar fotos con base64
      const reportPhotos = [];
      for (const photo of this.photos) {
        let base64 = '';
        // Intentar obtener la imagen
        if (photo.imageUrl) {
          base64 = photo.imageUrl;
        } else if (photo.localPath) {
          try {
            base64 = await this.cameraService.getPhotoBase64(photo.localPath);
          } catch (e) { /* ignore */ }
        }

        reportPhotos.push({
          id: photo.id,
          base64,
          description: photo.notes,
          aiDescription: photo.aiDescription,
          latitude: photo.latitude,
          longitude: photo.longitude,
          timestamp: photo.timestamp,
          location: photo.location,
          catastroRef: photo.catastroRef
        });
      }

      // 2. Intentar generar resumen con IA (opcional)
      let aiSummary = '';
      try {
        const aiInput = {
          projectName: this.project.name,
          projectLocation: this.project.location,
          zones: this.project.zones?.map(z => ({ name: z.name, description: z.description })),
          paths: this.project.paths?.map(p => ({ name: p.name, description: p.description })),
          photos: this.photos.map(p => ({
            description: p.notes,
            aiDescription: p.aiDescription,
            location: p.location,
            latitude: p.latitude,
            longitude: p.longitude
          }))
        };
        const aiReport = await this.claudeService.generateProjectReport(aiInput);
        aiSummary = aiReport.summary || '';
      } catch (e) {
        // IA no disponible, continuar sin resumen
        aiSummary = 'Resumen no disponible (sin conexión a IA)';
      }

      // 3. Preparar datos del reporte
      const reportData: ReportData = {
        projectName: this.project.name,
        projectDescription: this.project.description,
        projectLocation: this.project.location,
        createdAt: this.project.createdAt.toString(),
        aiSummary,
        photos: reportPhotos,
        zones: this.project.zones?.map(z => ({ name: z.name, description: z.description })),
        paths: this.project.paths?.map(p => ({ name: p.name, description: p.description })),
        notes: this.project.notes
      };

      // 4. Generar preview HTML y mostrar
      this.pendingReportData = reportData;
      this.reportPreviewRawHtml = this.reportService.generateHtmlPreview(reportData);
      this.reportPreviewHtml = this.sanitizer.bypassSecurityTrustHtml(this.reportPreviewRawHtml);
      this.showReportPreview = true;

    } catch (error: any) {
      console.error('Error generando informe:', error);
    } finally {
      this.isGeneratingPDD = false;
    }
  }

  closeReportPreview() {
    this.showReportPreview = false;
    this.reportPreviewHtml = '';
    this.reportPreviewRawHtml = '';
    this.pendingReportData = null;
  }

  async downloadReport() {
    if (!this.pendingReportData || !this.project) return;
    try {
      await this.reportService.downloadReport(this.pendingReportData);
      this.closeReportPreview();
    } catch (error: any) {
      console.error('Error descargando informe:', error);
    }
  }

  async saveReportToProject() {
    if (!this.pendingReportData || !this.project) return;
    try {
      // Guardar el informe en el proyecto con fecha y hora completa
      const now = new Date();
      const dateStr = now.toLocaleDateString('es-ES');
      const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const report = {
        id: `report_${Date.now()}`,
        name: `Informe PDD ${dateStr} ${timeStr}`,
        htmlContent: this.reportPreviewRawHtml,
        createdAt: now.toISOString()
      };
      this.project.reports = this.project.reports || [];
      this.project.reports.push(report);
      await this.saveProject();

      this.closeReportPreview();
    } catch (error: any) {
      console.error('Error guardando informe:', error);
    }
  }

  async saveKmlToProject() {
    if (!this.project) return;
    try {
      const exportData = {
        name: this.project.name,
        description: this.project.description,
        location: this.project.location,
        createdAt: this.project.createdAt.toString(),
        photos: this.photos.map(p => ({
          id: p.id,
          url: p.imageUrl || p.localPath || '',
          description: p.notes || p.aiDescription,
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.timestamp
        })),
        zones: this.project.zones?.map(z => ({ name: z.name, description: z.description, coordinates: z.coordinates })),
        paths: this.project.paths?.map(p => ({ name: p.name, description: p.description, coordinates: p.coordinates })),
        markers: this.project.markers?.map(m => ({ name: m.name, description: m.description, coordinate: m.coordinate }))
      };

      // Generar KML content
      const kmlContent = this.kmlService.generateKml(exportData);

      // Guardar en el proyecto con fecha y hora completa
      const now = new Date();
      const dateStr = now.toLocaleDateString('es-ES').replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '-');
      const kml = {
        id: `kml_${Date.now()}`,
        name: `${this.project.name}_${dateStr}_${timeStr}`,
        kmlContent,
        createdAt: now.toISOString()
      };
      this.project.kmls = this.project.kmls || [];
      this.project.kmls.push(kml);
      await this.saveProject();
    } catch (error: any) {
      console.error('Error guardando KML:', error);
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  // ========== UTILITY ==========

  async locateMe() {
    try {
      const pos = await this.gpsService.getCurrentPosition();
      if (this.map) this.map.setView([pos.latitude, pos.longitude], 18);
    } catch (error: any) {
      // Error silencioso
    }
  }

  private async saveProject() {
    if (!this.project) return;
    this.project.updatedAt = new Date();
    await this.storageService.saveProject(this.project);
  }

  goBack() {
    this.navCtrl.back();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2000, position: 'top', color });
    await toast.present();
  }

  get zoneCount(): number { return this.project?.zones?.length || 0; }
  get pathCount(): number { return this.project?.paths?.length || 0; }
  get markerCount(): number { return this.project?.markers?.length || 0; }
  get photoCount(): number { return this.photos.length; }
}
