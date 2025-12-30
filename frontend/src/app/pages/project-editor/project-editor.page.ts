import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, AlertController, ToastController, ActionSheetController } from '@ionic/angular';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { StorageService } from '../../services/storage.service';
import { GpsService } from '../../services/gps.service';
import { CameraService } from '../../services/camera.service';
import { ClaudeService } from '../../services/claude.service';
import { KmlService, ProjectExportData } from '../../services/kml.service';
import { ReportService, ReportData } from '../../services/report.service';
import { ApiService } from '../../services/api.service';
import { firstValueFrom } from 'rxjs';
import { Project, ProjectZone, ProjectPath, ProjectMarker, GeoPoint, Photo } from '../../models';
import * as L from 'leaflet';
import html2canvas from 'html2canvas';

type DrawMode = 'none' | 'zone' | 'path' | 'marker';

@Component({
  standalone: false,
  selector: 'app-project-editor',
  templateUrl: './project-editor.page.html',
  styleUrls: ['./project-editor.page.scss'],
})
export class ProjectEditorPage implements OnInit, OnDestroy {
  // ViewChild para el input de foto oculto (iOS Safari compatibility)
  @ViewChild('hiddenPhotoInput', { static: false }) hiddenPhotoInput!: ElementRef<HTMLInputElement>;
  private pendingPhotoMarkerId: string | null = null;

  project: Project | null = null;
  photos: Photo[] = [];

  // AI loading state
  isGeneratingPDD = false;
  isAnalyzingPhoto = false;
  aiLoadingMessage = '';

  // Report preview
  showReportPreview = false;
  reportPreviewHtml: SafeHtml = '';
  private reportPreviewRawHtml = '';
  private pendingReportData: any = null;

  // Photo viewer
  showPhotoViewer = false;
  viewerPhoto: Photo | null = null;
  viewerMarker: ProjectMarker | null = null;

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
    private reportService: ReportService,
    private apiService: ApiService
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
    setTimeout(() => this.initMapWithLocation(), 300);
  }

  private async initMapWithLocation() {
    // Si el proyecto tiene contenido (marcadores, zonas, etc.), usar esos bounds
    const hasContent = (this.project?.markers?.length || 0) > 0 ||
                       (this.project?.zones?.length || 0) > 0 ||
                       (this.project?.paths?.length || 0) > 0 ||
                       this.photos.length > 0;

    if (hasContent) {
      // Inicializar con contenido existente
      this.initMap();
    } else {
      // Si no hay contenido, obtener ubicación actual primero
      try {
        const pos = await this.gpsService.getCurrentPosition();
        // Guardar coordenadas en el proyecto
        if (this.project && !this.project.coordinates) {
          this.project.coordinates = { lat: pos.latitude, lng: pos.longitude };
          await this.saveProject();
        }
        this.initMap(pos.latitude, pos.longitude);
      } catch (e) {
        console.log('No se pudo obtener ubicación, usando default');
        this.initMap();
      }
    }
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

    // Asignar números de orden a marcadores existentes que no los tienen
    await this.ensureMarkerOrders();

    // Sincronizar fotos desde la nube si hay serverId
    if (this.project.serverId) {
      this.syncPhotosFromCloud();
    }
  }

  // Descargar fotos del servidor que no están localmente
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
        if (this.project.markers) {
          let markersUpdated = false;
          for (const marker of this.project.markers) {
            if (marker.serverPhotoIds && marker.serverPhotoIds.length > 0) {
              // Mantener photoIds existentes y añadir los resueltos sin duplicados
              const existingPhotoIds = new Set(marker.photoIds || []);

              for (const serverPhotoId of marker.serverPhotoIds) {
                const localPhoto = localByServerId.get(serverPhotoId);
                if (localPhoto && !existingPhotoIds.has(localPhoto.id)) {
                  existingPhotoIds.add(localPhoto.id);
                  markersUpdated = true;
                }
              }

              // Actualizar photoIds solo si hubo cambios
              if (markersUpdated) {
                marker.photoIds = Array.from(existingPhotoIds);
              }
            }
          }
          if (markersUpdated) {
            await this.saveProject();
          }
        }

        if (hasNewPhotos) {
          this.renderProjectElements();
        }
      }
    } catch (e: any) {
      console.log('Error sincronizando fotos:', e?.message);
    }
  }

  /**
   * Asigna números de orden a marcadores que no los tienen (compatibilidad con proyectos antiguos)
   */
  private async ensureMarkerOrders() {
    if (!this.project?.markers) return;

    let needsSave = false;
    let maxOrder = 0;

    // Encontrar el máximo orden existente
    for (const marker of this.project.markers) {
      if (marker.order && marker.order > maxOrder) {
        maxOrder = marker.order;
      }
    }

    // Asignar orden a marcadores que no lo tienen
    for (const marker of this.project.markers) {
      if (!marker.order) {
        maxOrder++;
        marker.order = maxOrder;
        needsSave = true;
      }
    }

    if (needsSave) {
      await this.saveProject();
    }
  }

  private initMap(initialLat?: number, initialLng?: number) {
    if (this.map || !this.project) return;

    const container = document.getElementById('editorMap');
    if (!container) return;

    // Usar coordenadas proporcionadas, o del proyecto, o por defecto España
    const lat = initialLat || this.project.coordinates?.lat || 40.416775;
    const lng = initialLng || this.project.coordinates?.lng || -3.703790;

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

    // Crear panes personalizados con diferentes z-index para controlar clicks
    // Los panes con z-index más alto reciben los clicks primero
    this.map.createPane('zonesPane');
    this.map.getPane('zonesPane')!.style.zIndex = '400';  // Zonas debajo

    this.map.createPane('pathsPane');
    this.map.getPane('pathsPane')!.style.zIndex = '450';  // Trazados encima de zonas

    this.map.createPane('markersPane');
    this.map.getPane('markersPane')!.style.zIndex = '500';  // Marcadores encima de todo

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

    // Render zones - con click handler para mostrar opciones (en zonesPane)
    this.project.zones?.forEach(zone => {
      const latlngs = zone.coordinates.map(c => L.latLng(c.lat, c.lng));
      const polygon = L.polygon(latlngs, {
        color: zone.color || '#ef4444',
        weight: 5,
        fillOpacity: 0.25,
        opacity: 0.9,
        pane: 'zonesPane'  // Usar pane personalizado
      });
      polygon.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        this.showZoneOptions(zone);
      });
      polygon.addTo(this.zonesLayer!);
    });

    // Render paths - con click handler para mostrar opciones (en pathsPane - encima de zonas)
    this.project.paths?.forEach(path => {
      const latlngs = path.coordinates.map(c => L.latLng(c.lat, c.lng));

      // Línea invisible más ancha para facilitar el click (área de hit)
      const hitArea = L.polyline(latlngs, {
        color: 'transparent',
        weight: 30,
        opacity: 0,
        pane: 'pathsPane'  // Usar pane personalizado
      });
      hitArea.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        this.showPathOptions(path);
      });
      hitArea.addTo(this.pathsLayer!);

      // Línea visible más gruesa
      const polyline = L.polyline(latlngs, {
        color: path.color || '#3b82f6',
        weight: 10,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        pane: 'pathsPane'  // Usar pane personalizado
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

    // Obtener IDs de fotos vinculadas a marcadores
    const linkedPhotoIds = new Set<string>();
    this.project.markers?.forEach(marker => {
      marker.photoIds?.forEach(photoId => linkedPhotoIds.add(photoId));
    });

    // Solo renderizar fotos NO vinculadas a ningún marcador (fotos huérfanas)
    this.photos.forEach(photo => {
      if (photo.latitude && photo.longitude && !linkedPhotoIds.has(photo.id)) {
        const icon = L.divIcon({
          className: 'photo-marker orphan-photo',
          html: '<div class="photo-marker-dot"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        const mapMarker = L.marker([photo.latitude, photo.longitude], {
          icon,
          pane: 'markersPane'  // Usar pane personalizado
        });
        mapMarker.on('click', () => this.showOrphanPhotoOptions(photo));
        mapMarker.addTo(this.markersLayer!);
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

    // Calcular el siguiente número de orden
    this.project.markers = this.project.markers || [];
    const maxOrder = this.project.markers.reduce((max, m) => Math.max(max, m.order || 0), 0);
    const nextOrder = maxOrder + 1;

    const marker: ProjectMarker = {
      id: `marker_${Date.now()}`,
      name,
      description,
      coordinate: { lat: latlng.lat, lng: latlng.lng },
      order: nextOrder,
      createdAt: new Date().toISOString()
    };

    this.project.markers.push(marker);

    await this.saveProject();
    this.renderProjectElements();
  }

  // Método que recibe el ID y busca el marcador actualizado
  async takePhotoForMarkerId(markerId: string) {
    const marker = this.project?.markers?.find(m => m.id === markerId);
    if (!marker) {
      console.error('Marcador no encontrado:', markerId);
      return;
    }

    try {
      console.log('Abriendo cámara para marcador:', marker.name);
      const photoData = await this.cameraService.takePhoto();
      console.log('Foto capturada:', photoData ? 'OK' : 'null');

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
          notes: `Punto ${marker.order || '?'}: ${marker.name}`
        };

        await this.storageService.savePhoto(photo);
        this.photos.push(photo);

        // Buscar el marcador de nuevo para asegurar la última versión
        const projectMarker = this.project.markers?.find(m => m.id === markerId);
        if (projectMarker) {
          projectMarker.photoIds = projectMarker.photoIds || [];
          projectMarker.photoIds.push(photo.id);
          console.log('Foto añadida al marcador. Total fotos:', projectMarker.photoIds.length);
        }

        await this.saveProject();
        this.renderProjectElements();
      }
    } catch (error: any) {
      console.error('Error tomando foto:', error);
    }
  }

  // Handler para el input de foto oculto (iOS Safari compatibility)
  async onHiddenPhotoInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    // Cerrar el action sheet manualmente (ignorar error si ya está cerrado)
    try {
      await this.actionSheetCtrl.dismiss();
    } catch (e) {
      // Action sheet ya cerrado, ignorar
    }

    if (!file || !this.pendingPhotoMarkerId || !this.project) {
      console.log('No file, markerId or project:', { file: !!file, markerId: this.pendingPhotoMarkerId, project: !!this.project });
      this.pendingPhotoMarkerId = null;
      input.value = ''; // Reset para próximo uso
      return;
    }

    const markerId = this.pendingPhotoMarkerId;
    const marker = this.project.markers?.find(m => m.id === markerId);

    if (!marker) {
      console.error('Marcador no encontrado:', markerId);
      this.pendingPhotoMarkerId = null;
      input.value = '';
      return;
    }

    try {
      // Convertir archivo a base64
      const base64 = await this.fileToBase64(file);
      const base64Image = `data:image/jpeg;base64,${base64}`;
      const localId = `photo_${Date.now()}`;

      const photo: Photo = {
        id: localId,
        projectId: this.project.id,
        localPath: `web_${Date.now()}.jpeg`,
        imageUrl: base64Image,
        latitude: marker.coordinate.lat,
        longitude: marker.coordinate.lng,
        timestamp: new Date().toISOString(),
        synced: false,
        notes: `Punto ${marker.order || '?'}: ${marker.name}`
      };

      // Guardar localmente primero
      await this.storageService.savePhoto(photo);
      this.photos.push(photo);

      // Actualizar marcador
      const projectMarker = this.project.markers?.find(m => m.id === markerId);
      if (projectMarker) {
        projectMarker.photoIds = projectMarker.photoIds || [];
        projectMarker.photoIds.push(photo.id);
        console.log('Foto añadida al marcador. Total fotos:', projectMarker.photoIds.length);
      }

      await this.saveProject();
      this.renderProjectElements();

      // Subir a la nube en background si hay serverId del proyecto
      if (this.project.serverId) {
        this.uploadPhotoToCloud(photo, base64Image, markerId);
      }
    } catch (error: any) {
      console.error('Error procesando foto:', error);
    } finally {
      this.pendingPhotoMarkerId = null;
      input.value = '';
    }
  }

  // Subir foto a la nube (Cloudinary)
  private async uploadPhotoToCloud(photo: Photo, base64Image: string, markerId?: string) {
    if (!this.project?.serverId) return;

    try {
      const response: any = await firstValueFrom(
        this.apiService.uploadPhoto(
          this.project.serverId,
          base64Image,
          photo.latitude,
          photo.longitude,
          photo.notes
        )
      );

      if (response?.success && response?.photo) {
        // Actualizar foto local con datos del servidor
        photo.serverId = response.photo.id;
        photo.imageUrl = response.photo.imageUrl;
        photo.thumbnailUrl = response.photo.thumbnailUrl;
        photo.synced = true;
        await this.storageService.savePhoto(photo);

        // Actualizar en el array local
        const index = this.photos.findIndex(p => p.id === photo.id);
        if (index >= 0) this.photos[index] = photo;

        // Actualizar serverPhotoIds en el marcador si existe
        if (markerId && this.project.markers && photo.serverId) {
          const marker = this.project.markers.find(m => m.id === markerId);
          if (marker) {
            marker.serverPhotoIds = marker.serverPhotoIds || [];
            if (!marker.serverPhotoIds.includes(photo.serverId)) {
              marker.serverPhotoIds.push(photo.serverId);
              await this.saveProject();
            }
          }
        }

        console.log('Foto subida a la nube:', response.photo.imageUrl);
      }
    } catch (e: any) {
      console.log('Error subiendo foto a la nube:', e?.message);
    }
  }

  // Convertir File a base64 CON COMPRESIÓN para no exceder cuota de almacenamiento
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Redimensionar a máximo 800px manteniendo proporción
        const maxSize = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        // Comprimir a JPEG con calidad 0.6 (60%)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };

      img.onerror = reject;

      // Leer archivo como URL para la imagen
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  // Mantener el método anterior para compatibilidad
  async takePhotoForMarker(marker: ProjectMarker) {
    await this.takePhotoForMarkerId(marker.id);
  }

  private addMarkerToMap(marker: ProjectMarker) {
    const hasPhotos = marker.photoIds && marker.photoIds.length > 0;
    const pinColor = hasPhotos ? '#10b981' : '#f59e0b';
    const badgeHtml = hasPhotos ? '<span class="photo-badge"></span>' : '';
    const orderNumber = marker.order || '?';

    // SVG location pin icon with number inside
    const svgIcon = `
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 14.4 25 15.1 25.7a1.2 1.2 0 001.8 0C17.6 41 32 26.5 32 16c0-8.837-7.163-16-16-16z" fill="${pinColor}"/>
        <circle cx="16" cy="16" r="11" fill="white"/>
        <text x="16" y="21" text-anchor="middle" font-size="14" font-weight="bold" fill="${pinColor}" font-family="Arial, sans-serif">${orderNumber}</text>
      </svg>
      ${badgeHtml}
    `;

    const icon = L.divIcon({
      className: hasPhotos ? 'project-marker has-photo' : 'project-marker',
      html: svgIcon,
      iconSize: [32, 42],
      iconAnchor: [16, 42]
    });
    const mapMarker = L.marker([marker.coordinate.lat, marker.coordinate.lng], {
      icon,
      pane: 'markersPane'
    });
    mapMarker.on('click', () => this.showMarkerOptionsById(marker.id));
    mapMarker.addTo(this.markersLayer!);
  }

  // Buscar marcador por ID para siempre usar la versión actualizada
  async showMarkerOptionsById(markerId: string) {
    const marker = this.project?.markers?.find(m => m.id === markerId);
    if (marker) {
      await this.showMarkerOptions(marker);
    }
  }

  async showMarkerOptions(marker: ProjectMarker) {
    // Guardar el ID para buscar la versión actualizada en cada handler
    const markerId = marker.id;

    const hasPhotos = marker.photoIds && marker.photoIds.length > 0;
    const markerPhotos = hasPhotos ? this.photos.filter(p => marker.photoIds!.includes(p.id)) : [];

    const buttons: any[] = [];

    // Si hay fotos, mostrar opción de ver
    if (hasPhotos) {
      buttons.push({
        text: `Ver ${markerPhotos.length} foto${markerPhotos.length > 1 ? 's' : ''}`,
        icon: 'images-outline',
        handler: () => {
          const m = this.project?.markers?.find(x => x.id === markerId);
          if (m) {
            const photos = this.photos.filter(p => m.photoIds?.includes(p.id));
            this.showMarkerPhotos(m, photos);
          }
        }
      });
    }

    buttons.push({
      text: 'Tomar foto',
      icon: 'camera-outline',
      handler: () => {
        // CRÍTICO: Guardar el markerId y disparar el input SINCRÓNICAMENTE
        // iOS Safari requiere que el click() ocurra en el mismo stack que el user gesture
        this.pendingPhotoMarkerId = markerId;
        if (this.hiddenPhotoInput?.nativeElement) {
          this.hiddenPhotoInput.nativeElement.click();
        }
        return false; // Prevenir cierre automático del action sheet
      }
    });

    // Opción de análisis IA siempre visible
    buttons.push({
      text: 'Analizar con IA',
      icon: 'sparkles-outline',
      handler: () => {
        const m = this.project?.markers?.find(x => x.id === markerId);
        if (m && m.photoIds && m.photoIds.length > 0) {
          const photos = this.photos.filter(p => m.photoIds?.includes(p.id));
          this.analyzeMarkerPhotosWithAI(photos);
        } else {
          this.showNoPhotosAlert();
        }
      }
    });

    buttons.push({
      text: 'Editar notas',
      icon: 'create-outline',
      handler: () => {
        const m = this.project?.markers?.find(x => x.id === markerId);
        if (m) this.editMarkerNotes(m);
      }
    });

    buttons.push({
      text: 'Eliminar punto',
      icon: 'trash-outline',
      role: 'destructive',
      handler: () => {
        const m = this.project?.markers?.find(x => x.id === markerId);
        if (m) this.deleteMarker(m);
      }
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
    // Show photo viewer instead of action sheet
    this.viewerPhoto = photo;
    this.viewerMarker = marker;
    this.showPhotoViewer = true;
  }

  closePhotoViewer() {
    this.showPhotoViewer = false;
    this.viewerPhoto = null;
    this.viewerMarker = null;
  }

  async editViewerPhotoNotes() {
    if (this.viewerPhoto) {
      await this.editPhotoNotes(this.viewerPhoto);
      // Refresh viewer photo after edit
      const updatedPhoto = this.photos.find(p => p.id === this.viewerPhoto?.id);
      if (updatedPhoto) this.viewerPhoto = updatedPhoto;
    }
  }

  async analyzeViewerPhotoWithAI() {
    if (this.viewerPhoto) {
      const photo = this.viewerPhoto;
      this.closePhotoViewer();
      await this.analyzePhotoWithAI(photo);
    }
  }

  async deleteViewerPhoto() {
    if (this.viewerPhoto && this.viewerMarker) {
      const photo = this.viewerPhoto;
      const marker = this.viewerMarker;
      this.closePhotoViewer();
      await this.deleteMarkerPhoto(photo, marker);
    }
  }

  async deleteMarkerPhoto(photo: Photo, marker: ProjectMarker) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar foto',
      message: '¿Seguro que quieres eliminar esta foto?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            // Eliminar foto del storage
            await this.storageService.deletePhoto(photo.id);
            this.photos = this.photos.filter(p => p.id !== photo.id);

            // Eliminar referencia del marcador
            if (marker.photoIds) {
              marker.photoIds = marker.photoIds.filter(id => id !== photo.id);
              await this.saveProject();
            }

            this.renderProjectElements();
          }
        }
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

  // ========== ORPHAN PHOTO OPTIONS ==========

  async showOrphanPhotoOptions(photo: Photo) {
    const buttons: any[] = [
      {
        text: 'Editar notas',
        icon: 'create-outline',
        handler: () => this.editPhotoNotes(photo)
      },
      {
        text: 'Analizar con IA',
        icon: 'sparkles-outline',
        handler: () => this.analyzePhotoWithAI(photo)
      },
      {
        text: 'Eliminar foto',
        icon: 'trash-outline',
        role: 'destructive',
        handler: () => this.deleteOrphanPhoto(photo)
      },
      { text: 'Cancelar', icon: 'close', role: 'cancel' }
    ];

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Foto',
      subHeader: photo.notes || photo.aiDescription || `${photo.latitude?.toFixed(5)}, ${photo.longitude?.toFixed(5)}`,
      buttons
    });
    await actionSheet.present();
  }

  async deleteOrphanPhoto(photo: Photo) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar foto',
      message: '¿Seguro que quieres eliminar esta foto?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.storageService.deletePhoto(photo.id);
            this.photos = this.photos.filter(p => p.id !== photo.id);
            this.renderProjectElements();
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteMarker(marker: ProjectMarker) {
    // IMPORTANTE: Buscar la versión actualizada del marcador en el proyecto
    const currentMarker = this.project?.markers?.find(m => m.id === marker.id);
    if (!currentMarker) return;

    const hasPhotos = currentMarker.photoIds && currentMarker.photoIds.length > 0;
    const photoCount = currentMarker.photoIds?.length || 0;

    const alert = await this.alertCtrl.create({
      header: 'Eliminar punto',
      message: hasPhotos
        ? `¿Seguro que quieres eliminar "${currentMarker.name}" y sus ${photoCount} foto${photoCount > 1 ? 's' : ''} asociada${photoCount > 1 ? 's' : ''}?`
        : `¿Seguro que quieres eliminar "${currentMarker.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            if (this.project) {
              // Buscar de nuevo para asegurar datos actualizados
              const markerToDelete = this.project.markers?.find(m => m.id === marker.id);

              // Eliminar fotos asociadas al marcador
              if (markerToDelete?.photoIds && markerToDelete.photoIds.length > 0) {
                for (const photoId of markerToDelete.photoIds) {
                  await this.storageService.deletePhoto(photoId);
                  this.photos = this.photos.filter(p => p.id !== photoId);
                }
              }

              // Eliminar el marcador
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
    // Calcular métricas de la zona
    const info = this.getZoneInfo(zone);

    const buttons: any[] = [
      {
        text: 'Ver información detallada',
        icon: 'information-circle-outline',
        handler: () => this.showZoneDetails(zone, info)
      },
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
      subHeader: `Área: ${this.formatArea(info.area)} | Perímetro: ${this.formatDistance(info.perimeter)}`,
      buttons
    });
    await actionSheet.present();
  }

  async showZoneDetails(zone: ProjectZone, info: { area: number; perimeter: number; vertices: number; bbox: { width: number; height: number } }) {
    const message = `
📐 ÁREA: ${this.formatArea(info.area)}

📏 PERÍMETRO: ${this.formatDistance(info.perimeter)}

📍 VÉRTICES: ${info.vertices} puntos

📦 DIMENSIONES:
   • Ancho: ${this.formatDistance(info.bbox.width)}
   • Alto: ${this.formatDistance(info.bbox.height)}

${zone.description ? '📝 DESCRIPCIÓN:\n' + zone.description : ''}
    `.trim();

    const alert = await this.alertCtrl.create({
      header: zone.name,
      subHeader: 'Información de la zona',
      message,
      buttons: ['Cerrar']
    });
    await alert.present();
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
    // Calcular métricas del trazado
    const info = this.getPathInfo(path);

    const buttons: any[] = [
      {
        text: 'Ver información detallada',
        icon: 'information-circle-outline',
        handler: () => this.showPathDetails(path, info)
      },
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
      subHeader: `Longitud: ${this.formatDistance(info.length)} | ${info.segments} tramos`,
      buttons
    });
    await actionSheet.present();
  }

  async showPathDetails(path: ProjectPath, info: { length: number; segments: number; bbox: { width: number; height: number } }) {
    const message = `
📏 LONGITUD TOTAL: ${this.formatDistance(info.length)}

🔗 TRAMOS: ${info.segments} segmentos

📍 PUNTOS: ${path.coordinates.length} vértices

📦 EXTENSIÓN:
   • Ancho: ${this.formatDistance(info.bbox.width)}
   • Alto: ${this.formatDistance(info.bbox.height)}

${path.description ? '📝 DESCRIPCIÓN:\n' + path.description : ''}
    `.trim();

    const alert = await this.alertCtrl.create({
      header: path.name,
      subHeader: 'Información del trazado',
      message,
      buttons: ['Cerrar']
    });
    await alert.present();
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
    this.aiLoadingMessage = 'Analizando imagen con IA...';
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
      this.aiLoadingMessage = '';
    }
  }

  // ========== MAP SCREENSHOT ==========

  /**
   * Genera una imagen del mapa dibujando manualmente los elementos
   */
  async captureMapScreenshot(): Promise<string> {
    if (!this.map || !this.project) return '';

    try {
      const width = 800;
      const height = 500;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      // Fondo gris claro
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(0, 0, width, height);

      // Obtener bounds del contenido
      const bounds = this.getContentBounds();
      if (!bounds) return '';

      // Dibujar grid de referencia
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Función para convertir coordenadas
      const latLngToPixel = (lat: number, lng: number): { x: number; y: number } => {
        const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * (width - 80) + 40;
        const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * (height - 80) + 40;
        return { x, y };
      };

      // Dibujar zonas
      if (this.project.zones) {
        this.project.zones.forEach(zone => {
          if (zone.coordinates.length < 3) return;
          ctx.beginPath();
          const first = latLngToPixel(zone.coordinates[0].lat, zone.coordinates[0].lng);
          ctx.moveTo(first.x, first.y);
          zone.coordinates.forEach((coord, i) => {
            if (i > 0) {
              const p = latLngToPixel(coord.lat, coord.lng);
              ctx.lineTo(p.x, p.y);
            }
          });
          ctx.closePath();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.fill();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.stroke();
        });
      }

      // Dibujar viales
      if (this.project.paths) {
        this.project.paths.forEach(path => {
          if (path.coordinates.length < 2) return;
          ctx.beginPath();
          const first = latLngToPixel(path.coordinates[0].lat, path.coordinates[0].lng);
          ctx.moveTo(first.x, first.y);
          path.coordinates.forEach((coord, i) => {
            if (i > 0) {
              const p = latLngToPixel(coord.lat, coord.lng);
              ctx.lineTo(p.x, p.y);
            }
          });
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        });
      }

      // Dibujar marcadores
      if (this.project.markers) {
        this.project.markers.forEach(marker => {
          const p = latLngToPixel(marker.coordinate.lat, marker.coordinate.lng);
          const hasPhotos = marker.photoIds && marker.photoIds.length > 0;
          const color = hasPhotos ? '#10b981' : '#f59e0b';
          const order = marker.order || '?';

          // Sombra
          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 2;

          // Pin
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.arc(p.x, p.y - 18, 16, 0, Math.PI * 2);
          ctx.fill();

          // Punta
          ctx.beginPath();
          ctx.moveTo(p.x - 10, p.y - 8);
          ctx.lineTo(p.x, p.y + 2);
          ctx.lineTo(p.x + 10, p.y - 8);
          ctx.fill();

          // Quitar sombra para el círculo blanco
          ctx.shadowColor = 'transparent';

          // Círculo blanco
          ctx.beginPath();
          ctx.fillStyle = 'white';
          ctx.arc(p.x, p.y - 18, 11, 0, Math.PI * 2);
          ctx.fill();

          // Número
          ctx.fillStyle = color;
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(order), p.x, p.y - 17);
        });
      }

      // Título
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, height - 30, width, 30);
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.project.name} - ${this.project.markers?.length || 0} puntos, ${this.project.zones?.length || 0} zonas, ${this.project.paths?.length || 0} viales`, width / 2, height - 12);

      return canvas.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      console.error('Error generando mapa:', error);
      return '';
    }
  }

  /**
   * Obtiene los bounds de todo el contenido del proyecto
   */
  private getContentBounds(): { north: number; south: number; east: number; west: number } | null {
    if (!this.project) return null;

    const allLats: number[] = [];
    const allLngs: number[] = [];

    // Marcadores
    this.project.markers?.forEach(m => {
      allLats.push(m.coordinate.lat);
      allLngs.push(m.coordinate.lng);
    });

    // Zonas
    this.project.zones?.forEach(z => {
      z.coordinates.forEach(c => {
        allLats.push(c.lat);
        allLngs.push(c.lng);
      });
    });

    // Viales
    this.project.paths?.forEach(p => {
      p.coordinates.forEach(c => {
        allLats.push(c.lat);
        allLngs.push(c.lng);
      });
    });

    if (allLats.length === 0) return null;

    const north = Math.max(...allLats);
    const south = Math.min(...allLats);
    const east = Math.max(...allLngs);
    const west = Math.min(...allLngs);

    // Añadir padding
    const latPadding = (north - south) * 0.1 || 0.001;
    const lngPadding = (east - west) * 0.1 || 0.001;

    return {
      north: north + latPadding,
      south: south - latPadding,
      east: east + lngPadding,
      west: west - lngPadding
    };
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
      // 0. Capturar screenshot del mapa
      this.aiLoadingMessage = 'Capturando mapa...';
      const mapScreenshot = await this.captureMapScreenshot();

      // 1. Preparar fotos con base64 y asociar con marcadores
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

        // Buscar el marcador asociado a esta foto
        let markerOrder: number | undefined;
        let markerName: string | undefined;
        const associatedMarker = this.project?.markers?.find(m => m.photoIds?.includes(photo.id));
        if (associatedMarker) {
          markerOrder = associatedMarker.order;
          markerName = associatedMarker.name;
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
          catastroRef: photo.catastroRef,
          markerOrder,
          markerName
        });
      }

      // Ordenar fotos por número de marcador
      reportPhotos.sort((a, b) => {
        if (a.markerOrder === undefined && b.markerOrder === undefined) return 0;
        if (a.markerOrder === undefined) return 1;
        if (b.markerOrder === undefined) return -1;
        return a.markerOrder - b.markerOrder;
      });

      // 1.5 Preparar datos de marcadores para el reporte
      const reportMarkers = this.project.markers?.map(m => ({
        order: m.order || 0,
        name: m.name,
        description: m.description,
        aiDescription: m.aiDescription,
        latitude: m.coordinate.lat,
        longitude: m.coordinate.lng,
        photoCount: m.photoIds?.length || 0
      })).sort((a, b) => a.order - b.order) || [];

      // 2. Calcular métricas geométricas para zonas y trazados
      const zonesWithMetrics = this.project.zones?.map(z => {
        const info = this.getZoneInfo(z);
        return {
          name: z.name,
          description: z.description,
          area: info.area,
          areaFormatted: this.formatArea(info.area),
          perimeter: info.perimeter,
          perimeterFormatted: this.formatDistance(info.perimeter),
          vertices: info.vertices,
          dimensions: `${this.formatDistance(info.bbox.width)} x ${this.formatDistance(info.bbox.height)}`
        };
      });

      const pathsWithMetrics = this.project.paths?.map(p => {
        const info = this.getPathInfo(p);
        return {
          name: p.name,
          description: p.description,
          length: info.length,
          lengthFormatted: this.formatDistance(info.length),
          segments: info.segments,
          dimensions: `${this.formatDistance(info.bbox.width)} x ${this.formatDistance(info.bbox.height)}`
        };
      });

      // 3. Intentar generar resumen con IA (opcional) - ahora incluye métricas
      this.aiLoadingMessage = 'Generando resumen con IA...';
      let aiSummary = '';
      try {
        const aiInput = {
          projectName: this.project.name,
          projectLocation: this.project.location,
          zones: zonesWithMetrics?.map(z => ({
            name: z.name,
            description: z.description,
            area: z.areaFormatted,
            perimeter: z.perimeterFormatted,
            vertices: z.vertices
          })),
          paths: pathsWithMetrics?.map(p => ({
            name: p.name,
            description: p.description,
            length: p.lengthFormatted,
            segments: p.segments
          })),
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
      this.aiLoadingMessage = '';

      // 4. Preparar datos del reporte con métricas
      const reportData: ReportData = {
        projectName: this.project.name,
        projectDescription: this.project.description,
        projectLocation: this.project.location,
        createdAt: this.project.createdAt.toString(),
        aiSummary,
        mapScreenshot,
        markers: reportMarkers,
        photos: reportPhotos,
        zones: zonesWithMetrics,
        paths: pathsWithMetrics,
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
    console.log('saveReportToProject llamado', { pendingReportData: !!this.pendingReportData, project: !!this.project });

    if (!this.pendingReportData || !this.project) {
      console.error('No hay datos de reporte o proyecto');
      return;
    }

    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('es-ES');
      const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const reportName = `Informe PDD ${dateStr} ${timeStr}`;

      // Intentar guardar en la nube si hay sesión
      const token = localStorage.getItem('token');
      const projectId = this.project.serverId || this.project.id;

      let reportId = `report_${Date.now()}`;
      let savedToCloud = false;

      if (token) {
        try {
          console.log('Guardando informe en la nube:', reportName);
          const response: any = await firstValueFrom(this.apiService.createReport(
            projectId,
            reportName,
            this.reportPreviewRawHtml
          ));
          console.log('Informe guardado en la nube');
          // Usar el ID del servidor si está disponible
          if (response?.report?.id) {
            reportId = response.report.id;
          }
          savedToCloud = true;
        } catch (cloudError: any) {
          console.warn('Error guardando en la nube, guardando solo localmente:', cloudError);
        }
      }

      // Siempre guardar localmente con el contenido completo
      const report = {
        id: reportId,
        name: reportName,
        htmlContent: this.reportPreviewRawHtml,
        createdAt: now.toISOString()
      };

      this.project.reports = this.project.reports || [];
      this.project.reports.push(report);
      await this.saveProject();

      console.log('Informe guardado localmente. Total informes:', this.project.reports.length, 'Cloud:', savedToCloud);

      const alert = await this.alertCtrl.create({
        header: 'Informe guardado',
        message: `El informe "${reportName}" se ha guardado correctamente.`,
        buttons: ['OK']
      });
      await alert.present();
      this.closeReportPreview();
    } catch (error: any) {
      console.error('Error guardando informe:', error);
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'No se pudo guardar el informe: ' + error.message,
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  private downloadReportAsHtml(name: string, htmlContent: string) {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Informe descargado', 'success');
  }

  async saveKmlToProject() {
    console.log('saveKmlToProject llamado', { project: !!this.project });

    if (!this.project) {
      console.error('No hay proyecto');
      return;
    }

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
        markers: this.project.markers?.map(m => {
          // Get photos associated with this marker
          const markerPhotos = m.photoIds?.map(photoId => {
            const photo = this.photos.find(p => p.id === photoId);
            if (photo) {
              return {
                id: photo.id,
                base64: photo.imageUrl || photo.localPath || '',
                notes: photo.notes,
                aiDescription: photo.aiDescription
              };
            }
            return null;
          }).filter(p => p !== null) || [];

          return {
            name: m.name,
            description: m.description,
            aiDescription: m.aiDescription,
            coordinate: m.coordinate,
            photos: markerPhotos
          };
        })
      };

      console.log('Generando KML...', exportData);

      // Generar KML content
      const kmlContent = this.kmlService.generateKml(exportData);

      const now = new Date();
      const dateStr = now.toLocaleDateString('es-ES');
      const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const kmlName = `Informe KML ${dateStr} ${timeStr}`;

      console.log('Guardando KML:', kmlName);

      // Intentar guardar en la nube si hay sesión
      const token = localStorage.getItem('token');
      const projectId = this.project.serverId || this.project.id;

      let kmlId = `kml_${Date.now()}`;
      let savedToCloud = false;

      if (token) {
        try {
          const response: any = await firstValueFrom(this.apiService.createKml(
            projectId,
            kmlName,
            kmlContent
          ));
          console.log('KML guardado en la nube');
          // Usar el ID del servidor si está disponible
          if (response?.kml?.id) {
            kmlId = response.kml.id;
          }
          savedToCloud = true;
        } catch (cloudError: any) {
          console.warn('Error guardando KML en la nube, guardando solo localmente:', cloudError);
        }
      }

      // Siempre guardar localmente con el contenido completo
      const kml = {
        id: kmlId,
        name: kmlName,
        kmlContent,
        createdAt: now.toISOString()
      };

      this.project.kmls = this.project.kmls || [];
      this.project.kmls.push(kml);
      await this.saveProject();

      console.log('KML guardado localmente. Total KMLs:', this.project.kmls.length, 'Cloud:', savedToCloud);

      const alert = await this.alertCtrl.create({
        header: 'Archivo KML guardado',
        message: `El archivo "${kmlName}.kml" se ha guardado correctamente.`,
        buttons: ['OK']
      });
      await alert.present();

    } catch (error: any) {
      console.error('Error guardando KML:', error);
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'No se pudo guardar el archivo KML: ' + error.message,
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  private downloadKmlFile(name: string, kmlContent: string) {
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.kml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Archivo KML descargado', 'success');
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

    // Sincronizar con servidor si hay conexión y tiene serverId
    if (this.project.serverId) {
      this.syncProjectContent();
    }
  }

  private async syncProjectContent() {
    if (!this.project?.serverId) return;

    try {
      const content = {
        zones: this.project.zones || [],
        paths: this.project.paths || [],
        markers: this.project.markers || [],
        coordinates: this.project.coordinates
      };

      await firstValueFrom(this.apiService.put(`/projects/${this.project.serverId}/content`, content));
      console.log('Contenido sincronizado con servidor');
    } catch (e: any) {
      console.log('Error sincronizando contenido:', e?.message);
      // No mostrar error al usuario, la sincronización es secundaria
    }
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

  // ========== GEOMETRIC CALCULATIONS ==========

  /**
   * Calcula la distancia entre dos puntos usando la fórmula de Haversine
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Calcula el área de un polígono usando la fórmula del Shoelace (en m²)
   */
  calculatePolygonArea(coordinates: GeoPoint[]): number {
    if (coordinates.length < 3) return 0;

    // Convertir a coordenadas planas (proyección simple para áreas pequeñas)
    const centerLat = coordinates.reduce((sum, c) => sum + c.lat, 0) / coordinates.length;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(this.toRad(centerLat));

    const points = coordinates.map(c => ({
      x: (c.lng - coordinates[0].lng) * metersPerDegreeLng,
      y: (c.lat - coordinates[0].lat) * metersPerDegreeLat
    }));

    // Fórmula del Shoelace
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  }

  /**
   * Calcula el perímetro de un polígono o la longitud de una línea (en metros)
   */
  calculatePathLength(coordinates: GeoPoint[], closed: boolean = false): number {
    if (coordinates.length < 2) return 0;

    let length = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      length += this.haversineDistance(
        coordinates[i].lat, coordinates[i].lng,
        coordinates[i + 1].lat, coordinates[i + 1].lng
      );
    }

    // Si es cerrado (polígono), añadir distancia del último al primero
    if (closed && coordinates.length > 2) {
      length += this.haversineDistance(
        coordinates[coordinates.length - 1].lat, coordinates[coordinates.length - 1].lng,
        coordinates[0].lat, coordinates[0].lng
      );
    }

    return length;
  }

  /**
   * Calcula las dimensiones del bounding box de un conjunto de coordenadas
   */
  calculateBoundingBox(coordinates: GeoPoint[]): { width: number; height: number; minLat: number; maxLat: number; minLng: number; maxLng: number } {
    if (coordinates.length === 0) {
      return { width: 0, height: 0, minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
    }

    const lats = coordinates.map(c => c.lat);
    const lngs = coordinates.map(c => c.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(this.toRad(centerLat));

    const width = (maxLng - minLng) * metersPerDegreeLng;
    const height = (maxLat - minLat) * metersPerDegreeLat;

    return { width, height, minLat, maxLat, minLng, maxLng };
  }

  /**
   * Formatea un área en m² o hectáreas
   */
  formatArea(areaM2: number): string {
    if (areaM2 >= 10000) {
      return `${(areaM2 / 10000).toFixed(2)} ha (${areaM2.toFixed(0)} m²)`;
    }
    return `${areaM2.toFixed(2)} m²`;
  }

  /**
   * Formatea una distancia en metros o km
   */
  formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(2)} m`;
  }

  /**
   * Obtiene información completa de una zona
   */
  getZoneInfo(zone: ProjectZone): { area: number; perimeter: number; vertices: number; bbox: { width: number; height: number } } {
    const area = this.calculatePolygonArea(zone.coordinates);
    const perimeter = this.calculatePathLength(zone.coordinates, true);
    const bbox = this.calculateBoundingBox(zone.coordinates);

    return {
      area,
      perimeter,
      vertices: zone.coordinates.length,
      bbox: { width: bbox.width, height: bbox.height }
    };
  }

  /**
   * Obtiene información completa de un trazado
   */
  getPathInfo(path: ProjectPath): { length: number; segments: number; bbox: { width: number; height: number } } {
    const length = this.calculatePathLength(path.coordinates, false);
    const bbox = this.calculateBoundingBox(path.coordinates);

    return {
      length,
      segments: path.coordinates.length - 1,
      bbox: { width: bbox.width, height: bbox.height }
    };
  }
}
