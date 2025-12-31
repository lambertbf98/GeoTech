import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { ToastController, AlertController, NavController } from '@ionic/angular';
import { CatastroService } from '../../services/catastro.service';
import { GpsService } from '../../services/gps.service';
import { StorageService } from '../../services/storage.service';
import { KmlService, KmlDocument, KmlPlacemark } from '../../services/kml.service';
import { Measurement, MeasurementPoint } from '../../models';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';

@Component({
  standalone: false,
  selector: 'app-catastro',
  templateUrl: './catastro.page.html',
  styleUrls: ['./catastro.page.scss'],
})
export class CatastroPage implements OnInit, AfterViewInit, OnDestroy {
  viewMode: 'map' | 'earth' = 'map';
  mapType: 'satellite' | 'street' = 'satellite';
  showCatastro = true;
  latitude = '';
  longitude = '';
  parcelData: any = null;
  showInfoPanel = false;
  showSearch = false;

  // Nuevas propiedades
  searchAddress = '';
  searchResults: any[] = [];
  showAddressResults = false;
  measureMode: 'none' | 'distance' | 'area' = 'none';
  measurePoints: L.LatLng[] = [];
  measureDistance = 0;
  measureArea = 0;

  // KML properties
  @ViewChild('kmlFileInput') kmlFileInput!: ElementRef<HTMLInputElement>;
  showKmlPanel = false;
  kmlLayers: { name: string; layerGroup: L.LayerGroup; bounds: L.LatLngBounds; document: KmlDocument }[] = [];

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private satelliteLayer: L.TileLayer | null = null;
  private streetLayer: L.TileLayer | null = null;
  private catastroLayer: L.TileLayer.WMS | null = null;
  private cesiumViewer: any = null;
  private measureLayer: L.LayerGroup | null = null;
  private measurePolyline: L.Polyline | null = null;
  private measurePolygon: L.Polygon | null = null;

  // Cesium measurement entities
  private cesiumMeasureEntities: any[] = [];
  private cesiumMeasureLine: any = null;
  private cesiumMeasurePolygon: any = null;
  private cesiumClickHandler: any = null;
  private Cesium: any = null;

  constructor(
    private catastroService: CatastroService,
    private gpsService: GpsService,
    private storageService: StorageService,
    private kmlService: KmlService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private http: HttpClient
  ) {}

  ngOnInit() {
    // Verificar si hay coordenadas desde otra página
    this.checkIncomingCoordinates();
  }

  ionViewWillEnter() {
    // También verificar al volver a la página
    this.checkIncomingCoordinates();
  }

  private checkIncomingCoordinates() {
    const lat = localStorage.getItem('geovisor_lat');
    const lon = localStorage.getItem('geovisor_lon');
    const mode = localStorage.getItem('geovisor_mode');

    if (lat && lon) {
      this.latitude = lat;
      this.longitude = lon;
      // Limpiar después de usar
      localStorage.removeItem('geovisor_lat');
      localStorage.removeItem('geovisor_lon');
      localStorage.removeItem('geovisor_mode');

      // Si el mapa ya existe, ir a las coordenadas
      if (this.map) {
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        this.map.setView([latNum, lonNum], 19);
        this.addMarker(latNum, lonNum);

        if (mode === 'earth') {
          setTimeout(() => this.openEarthView(), 500);
        }
      }
    }
  }

  private hasRequestedLocation = false;

  ngAfterViewInit() {
    setTimeout(() => this.initMap(), 400);
  }

  ionViewDidEnter() {
    // Mostrar alerta para pedir ubicación (requerido en Safari iOS)
    setTimeout(() => {
      if (this.map && !this.hasRequestedLocation) {
        this.hasRequestedLocation = true;
        this.showLocationPrompt();
      }
    }, 500);
  }

  private async showLocationPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Usar ubicacion actual',
      message: '¿Deseas centrar el mapa en tu ubicacion actual?',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Si',
          handler: () => {
            this.locateMe();
          }
        }
      ]
    });
    await alert.present();
  }

  ngOnDestroy() {
    if (this.map) { this.map.remove(); this.map = null; }
    if (this.cesiumViewer) { this.cesiumViewer.destroy(); this.cesiumViewer = null; }
  }

  private async initMap() {
    if (this.map) return;
    const container = document.getElementById('mainMap');
    if (!container) return;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // Usar coordenadas existentes o Madrid como inicial
    let lat = parseFloat(this.latitude) || 40.416775;
    let lon = parseFloat(this.longitude) || -3.703790;

    this.map = L.map('mainMap', {
      zoomControl: false,
      maxZoom: 22,
      minZoom: 3
    }).setView([lat, lon], 17);

    // Capas con zoom máximo extendido
    this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
      maxZoom: 22,
      maxNativeZoom: 19
    });
    this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '',
      maxZoom: 22,
      maxNativeZoom: 19
    });
    this.catastroLayer = L.tileLayer.wms('https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx', {
      layers: 'Catastro', format: 'image/png', transparent: true, attribution: ''
    });

    this.satelliteLayer.addTo(this.map);
    if (this.showCatastro) this.catastroLayer.addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.latitude = e.latlng.lat.toFixed(6);
      this.longitude = e.latlng.lng.toFixed(6);
      this.addMarker(e.latlng.lat, e.latlng.lng);
    });
  }

  setMapType(type: 'satellite' | 'street') {
    if (!this.map) return;
    this.mapType = type;
    if (this.satelliteLayer) this.map.removeLayer(this.satelliteLayer);
    if (this.streetLayer) this.map.removeLayer(this.streetLayer);
    if (type === 'satellite') this.satelliteLayer?.addTo(this.map);
    else this.streetLayer?.addTo(this.map);
    if (this.showCatastro && this.catastroLayer) {
      this.map.removeLayer(this.catastroLayer);
      this.catastroLayer.addTo(this.map);
    }
  }

  toggleCatastro() {
    if (!this.map || !this.catastroLayer) return;
    this.showCatastro = !this.showCatastro;
    if (this.showCatastro) this.catastroLayer.addTo(this.map);
    else this.map.removeLayer(this.catastroLayer);
  }

  private addMarker(lat: number, lon: number) {
    if (!this.map) return;
    if (this.marker) this.map.removeLayer(this.marker);
    const icon = L.divIcon({ className: 'custom-marker', html: '<div class="marker-dot"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });
    this.marker = L.marker([lat, lon], { icon }).addTo(this.map);
    this.showInfoPanel = true;
  }

  async locateMe() {
    try {
      const pos = await this.gpsService.getCurrentPosition();
      this.latitude = pos.latitude.toFixed(6);
      this.longitude = pos.longitude.toFixed(6);
      if (this.map) { this.map.setView([pos.latitude, pos.longitude], 18); this.addMarker(pos.latitude, pos.longitude); }
    } catch (e: any) { this.showToast(e.message || 'Error GPS', 'danger'); }
  }

  goToCoords() {
    if (!this.latitude || !this.longitude) { this.showToast('Introduce coordenadas', 'warning'); return; }
    const lat = parseFloat(this.latitude);
    const lon = parseFloat(this.longitude);
    if (this.map) { this.map.setView([lat, lon], 18); this.addMarker(lat, lon); }
    this.showSearch = false;
  }

  async searchCatastro() {
    if (!this.latitude || !this.longitude) { this.showToast('Toca el mapa primero', 'warning'); return; }
    try {
      this.parcelData = await this.catastroService.getParcelByCoordinates(parseFloat(this.latitude), parseFloat(this.longitude));
      if (this.parcelData) {
        this.showInfoPanel = true;
      }
    } catch (error) {
      console.error('Error catastro:', error);
      this.parcelData = null;
    }
  }

  async openEarthView() {
    this.viewMode = 'earth';
    setTimeout(async () => {
      try {
        this.Cesium = await import('cesium');
        const Cesium = this.Cesium;
        (window as any).CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.113/Build/Cesium/';

        if (!document.getElementById('cesium-css')) {
          const link = document.createElement('link'); link.id = 'cesium-css'; link.rel = 'stylesheet';
          link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.113/Build/Cesium/Widgets/widgets.css';
          document.head.appendChild(link);
        }
        const lat = parseFloat(this.latitude) || 40.416775;
        const lon = parseFloat(this.longitude) || -3.703790;

        this.cesiumViewer = new Cesium.Viewer('earthView', {
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          creditContainer: document.createElement('div')
        });

        // Añadir capa de imágenes ArcGIS (gratuita, sin token)
        const imageryLayer = this.cesiumViewer.imageryLayers.addImageryProvider(
          await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
          )
        );

        this.cesiumViewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 800),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
          duration: 2
        });

        if (this.latitude && this.longitude) {
          this.cesiumViewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat),
            point: { pixelSize: 16, color: Cesium.Color.fromCssColorString('#ef4444'), outlineColor: Cesium.Color.WHITE, outlineWidth: 3 },
            label: {
              text: 'Ubicacion',
              font: '14px Inter, sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -20)
            }
          });
        }
      } catch (e) {
        console.error('Error cargando Cesium:', e);
        this.viewMode = 'map';
      }
    }, 400);
  }

  backToMap() {
    if (this.cesiumViewer) { this.cesiumViewer.destroy(); this.cesiumViewer = null; }
    this.viewMode = 'map';
    setTimeout(() => {
      this.map = null;
      this.initMap();
      setTimeout(() => {
        if (this.latitude && this.longitude && this.map) {
          const lat = parseFloat(this.latitude);
          const lon = parseFloat(this.longitude);
          this.map.setView([lat, lon], 18);
          this.addMarker(lat, lon);
        }
      }, 100);
    }, 200);
  }

  toggleSearch() { this.showSearch = !this.showSearch; }
  closeInfoPanel() { this.showInfoPanel = false; this.parcelData = null; }

  // ========== BÚSQUEDA POR DIRECCIÓN (Nominatim) ==========
  async searchByAddress() {
    if (!this.searchAddress || this.searchAddress.length < 3) {
      return;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.searchAddress)}&countrycodes=es&limit=5`;
      const results = await this.http.get<any[]>(url).toPromise();
      this.searchResults = results || [];
      this.showAddressResults = this.searchResults.length > 0;
    } catch (e) {
      console.error('Search error:', e);
    }
  }

  selectAddress(result: any) {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    this.latitude = lat.toFixed(6);
    this.longitude = lon.toFixed(6);
    if (this.map) {
      this.map.setView([lat, lon], 18);
      this.addMarker(lat, lon);
    }
    this.showAddressResults = false;
    this.showSearch = false;
    this.searchAddress = '';
    this.searchResults = [];
  }

  // ========== HERRAMIENTAS DE MEDICIÓN ==========
  toggleMeasureDistance() {
    if (this.measureMode === 'distance') {
      this.stopMeasure();
    } else {
      this.startMeasure('distance');
    }
  }

  toggleMeasureArea() {
    if (this.measureMode === 'area') {
      this.stopMeasure();
    } else {
      this.startMeasure('area');
    }
  }

  private startMeasure(mode: 'distance' | 'area') {
    this.stopMeasure();
    this.measureMode = mode;
    this.measurePoints = [];
    this.measureDistance = 0;
    this.measureArea = 0;

    if (this.viewMode === 'map' && this.map) {
      // Modo Leaflet
      this.measureLayer = L.layerGroup().addTo(this.map);
      this.map.off('click');
      this.map.on('click', (e: L.LeafletMouseEvent) => this.addMeasurePoint(e.latlng));
    } else if (this.viewMode === 'earth' && this.cesiumViewer && this.Cesium) {
      // Modo Cesium
      this.startCesiumMeasure();
    }
  }

  private startCesiumMeasure() {
    if (!this.cesiumViewer || !this.Cesium) return;
    const Cesium = this.Cesium;
    const viewer = this.cesiumViewer;

    // Configurar handler de clicks
    this.cesiumClickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    this.cesiumClickHandler.setInputAction((click: any) => {
      const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const lng = Cesium.Math.toDegrees(cartographic.longitude);
        this.addCesiumMeasurePoint(lat, lng);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  private addCesiumMeasurePoint(lat: number, lng: number) {
    if (!this.cesiumViewer || !this.Cesium) return;
    const Cesium = this.Cesium;
    const viewer = this.cesiumViewer;

    // Añadir punto a la lista usando L.LatLng para compatibilidad
    this.measurePoints.push(L.latLng(lat, lng));

    // Añadir marcador de punto
    const pointEntity = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString('#ef4444'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      }
    });
    this.cesiumMeasureEntities.push(pointEntity);

    // Actualizar línea o polígono
    if (this.measureMode === 'distance' && this.measurePoints.length >= 2) {
      this.updateCesiumLine();
      this.measureDistance = this.calculateDistance();
    } else if (this.measureMode === 'area' && this.measurePoints.length >= 3) {
      this.updateCesiumPolygon();
      this.measureArea = this.calculateArea();
    }
  }

  private updateCesiumLine() {
    if (!this.cesiumViewer || !this.Cesium) return;
    const Cesium = this.Cesium;
    const viewer = this.cesiumViewer;

    // Eliminar línea anterior
    if (this.cesiumMeasureLine) {
      viewer.entities.remove(this.cesiumMeasureLine);
    }

    const positions = this.measurePoints.map(p => Cesium.Cartesian3.fromDegrees(p.lng, p.lat));
    this.cesiumMeasureLine = viewer.entities.add({
      polyline: {
        positions,
        width: 3,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#ef4444'),
          dashLength: 16
        }),
        clampToGround: true
      }
    });
  }

  private updateCesiumPolygon() {
    if (!this.cesiumViewer || !this.Cesium) return;
    const Cesium = this.Cesium;
    const viewer = this.cesiumViewer;

    // Eliminar polígono anterior
    if (this.cesiumMeasurePolygon) {
      viewer.entities.remove(this.cesiumMeasurePolygon);
    }

    const positions = this.measurePoints.map(p => Cesium.Cartesian3.fromDegrees(p.lng, p.lat));
    this.cesiumMeasurePolygon = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.3),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#3b82f6'),
        outlineWidth: 2
      }
    });
  }

  private addMeasurePoint(latlng: L.LatLng) {
    if (!this.map || !this.measureLayer) return;
    this.measurePoints.push(latlng);

    const pointIcon = L.divIcon({ className: 'measure-point', html: '<div class="measure-dot"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
    L.marker(latlng, { icon: pointIcon }).addTo(this.measureLayer);

    if (this.measureMode === 'distance' && this.measurePoints.length >= 2) {
      if (this.measurePolyline) this.measureLayer.removeLayer(this.measurePolyline);
      this.measurePolyline = L.polyline(this.measurePoints, { color: '#ef4444', weight: 3, dashArray: '10, 5' }).addTo(this.measureLayer);
      this.measureDistance = this.calculateDistance();
    } else if (this.measureMode === 'area' && this.measurePoints.length >= 3) {
      if (this.measurePolygon) this.measureLayer.removeLayer(this.measurePolygon);
      this.measurePolygon = L.polygon(this.measurePoints, { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.3 }).addTo(this.measureLayer);
      this.measureArea = this.calculateArea();
    }
  }

  private calculateDistance(): number {
    let total = 0;
    for (let i = 1; i < this.measurePoints.length; i++) {
      total += this.measurePoints[i - 1].distanceTo(this.measurePoints[i]);
    }
    return Math.round(total * 100) / 100;
  }

  private calculateArea(): number {
    if (this.measurePoints.length < 3) return 0;
    const latlngs = this.measurePoints.map(p => [p.lat, p.lng]);
    let area = 0;
    for (let i = 0; i < latlngs.length; i++) {
      const j = (i + 1) % latlngs.length;
      area += latlngs[i][1] * latlngs[j][0];
      area -= latlngs[j][1] * latlngs[i][0];
    }
    area = Math.abs(area) / 2;
    const avgLat = latlngs.reduce((sum, p) => sum + p[0], 0) / latlngs.length;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLon = 111320 * Math.cos(avgLat * Math.PI / 180);
    return Math.round(area * metersPerDegreeLat * metersPerDegreeLon);
  }

  async stopMeasure() {
    // Guardar medición automáticamente si hay puntos
    if (this.measurePoints.length >= 2 && (this.measureDistance > 0 || this.measureArea > 0)) {
      await this.saveMeasurement();
    }

    // Limpiar Leaflet
    if (this.measureLayer && this.map) {
      this.map.removeLayer(this.measureLayer);
    }
    this.measureLayer = null;
    this.measurePolyline = null;
    this.measurePolygon = null;

    // Limpiar Cesium
    if (this.cesiumViewer) {
      this.cesiumMeasureEntities.forEach(e => this.cesiumViewer.entities.remove(e));
      this.cesiumMeasureEntities = [];
      if (this.cesiumMeasureLine) {
        this.cesiumViewer.entities.remove(this.cesiumMeasureLine);
        this.cesiumMeasureLine = null;
      }
      if (this.cesiumMeasurePolygon) {
        this.cesiumViewer.entities.remove(this.cesiumMeasurePolygon);
        this.cesiumMeasurePolygon = null;
      }
      if (this.cesiumClickHandler) {
        this.cesiumClickHandler.destroy();
        this.cesiumClickHandler = null;
      }
    }

    this.measureMode = 'none';
    this.measurePoints = [];
    this.measureDistance = 0;
    this.measureArea = 0;
    if (this.map) {
      this.map.off('click');
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.latitude = e.latlng.lat.toFixed(6);
        this.longitude = e.latlng.lng.toFixed(6);
        this.addMarker(e.latlng.lat, e.latlng.lng);
      });
    }
  }

  private async saveMeasurement() {
    const points: MeasurementPoint[] = this.measurePoints.map(p => ({ lat: p.lat, lng: p.lng }));

    // Obtener ubicación aproximada del centro
    const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const centerLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;

    let location = '';
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${centerLat}&lon=${centerLng}&zoom=18`;
      const result = await this.http.get<any>(url).toPromise();
      if (result?.display_name) {
        // Tomar solo las primeras partes de la dirección
        const parts = result.display_name.split(',').slice(0, 3);
        location = parts.join(',');
      }
    } catch (e) {
      location = `${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`;
    }

    const measurement: Measurement = {
      id: 'measure_' + Date.now(),
      type: this.measureMode as 'distance' | 'area',
      points,
      value: this.measureMode === 'distance' ? this.measureDistance : this.measureArea,
      location,
      createdAt: new Date().toISOString()
    };

    await this.storageService.saveMeasurement(measurement);
  }

  goToMeasurements() {
    this.navCtrl.navigateForward('/tabs/mediciones');
  }

  // ========== VISTAS INTERNAS (sin abrir navegador externo) ==========
  openInGoogleMaps() {
    // Cambiar a vista de mapa con capa de calle
    if (!this.latitude || !this.longitude) {
      return;
    }
    this.setMapType('street');
    const lat = parseFloat(this.latitude);
    const lon = parseFloat(this.longitude);
    if (this.map) {
      this.map.setView([lat, lon], 19);
    }
  }

  openInGoogleEarth() {
    // Abrir vista 3D de Cesium (interna)
    if (!this.latitude || !this.longitude) {
      return;
    }
    this.openEarthView();
  }

  openInCatastro() {
    // Activar capa de catastro y hacer zoom
    if (!this.showCatastro) {
      this.toggleCatastro();
    }
    if (this.map && this.latitude && this.longitude) {
      const lat = parseFloat(this.latitude);
      const lon = parseFloat(this.longitude);
      this.map.setView([lat, lon], 20);
    }
  }

  private async showToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 2000, position: 'top', color });
    await toast.present();
  }

  // ========== KML IMPORT METHODS ==========

  triggerKmlImport() {
    if (this.kmlLayers.length > 0) {
      this.showKmlPanel = true;
    } else {
      this.kmlFileInput.nativeElement.click();
    }
  }

  toggleKmlPanel() {
    this.showKmlPanel = !this.showKmlPanel;
  }

  async onKmlFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    try {
      const kmlDoc = await this.kmlService.readFile(file);
      this.displayKmlDocument(kmlDoc);
      this.showToast(`Capa "${kmlDoc.name}" cargada`, 'success');
      this.showKmlPanel = true;
    } catch (error: any) {
      console.error('Error loading KML:', error);
      this.showToast(error.message || 'Error al cargar el archivo', 'danger');
    } finally {
      input.value = ''; // Reset input
    }
  }

  private displayKmlDocument(kmlDoc: KmlDocument) {
    if (!this.map) return;

    const layerGroup = L.layerGroup();
    const allCoords: L.LatLng[] = [];

    kmlDoc.placemarks.forEach(placemark => {
      const layer = this.createLayerFromPlacemark(placemark, kmlDoc.images);
      if (layer) {
        layer.addTo(layerGroup);
        placemark.coordinates.forEach(c => allCoords.push(L.latLng(c.lat, c.lng)));
      }
    });

    layerGroup.addTo(this.map);

    // Calculate bounds
    let bounds: L.LatLngBounds;
    if (allCoords.length > 0) {
      bounds = L.latLngBounds(allCoords);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      bounds = this.map.getBounds();
    }

    this.kmlLayers.push({
      name: kmlDoc.name,
      layerGroup,
      bounds,
      document: kmlDoc
    });
  }

  private createLayerFromPlacemark(placemark: KmlPlacemark, images: Map<string, string>): L.Layer | null {
    if (placemark.coordinates.length === 0) return null;

    switch (placemark.type) {
      case 'point':
        return this.createPointLayer(placemark, images);
      case 'polygon':
        return this.createPolygonLayer(placemark);
      case 'line':
        return this.createLineLayer(placemark);
      default:
        return null;
    }
  }

  private createPointLayer(placemark: KmlPlacemark, images: Map<string, string>): L.Marker {
    const coord = placemark.coordinates[0];

    // Create custom icon
    const icon = L.divIcon({
      className: 'kml-marker',
      html: `<div class="kml-marker-dot"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([coord.lat, coord.lng], { icon });

    // Build popup content
    let popupContent = `<div class="kml-popup"><strong>${placemark.name}</strong>`;

    if (placemark.imageUrl) {
      const imageData = placemark.imageUrl.startsWith('data:')
        ? placemark.imageUrl
        : images.get(placemark.imageUrl) || placemark.imageUrl;
      popupContent += `<br><img src="${imageData}" style="max-width:200px;max-height:150px;margin-top:8px;">`;
    }

    if (placemark.description) {
      popupContent += `<br><span style="color:#666;font-size:12px;">${placemark.description}</span>`;
    }

    popupContent += '</div>';
    marker.bindPopup(popupContent, { maxWidth: 250 });

    return marker;
  }

  private createPolygonLayer(placemark: KmlPlacemark): L.Polygon {
    const latlngs = placemark.coordinates.map(c => L.latLng(c.lat, c.lng));

    const polygon = L.polygon(latlngs, {
      color: '#ff0000',
      weight: 3,
      fillColor: '#ff0000',
      fillOpacity: 0.2
    });

    polygon.bindPopup(`<strong>${placemark.name}</strong>${placemark.description ? '<br>' + placemark.description : ''}`);

    return polygon;
  }

  private createLineLayer(placemark: KmlPlacemark): L.Polyline {
    const latlngs = placemark.coordinates.map(c => L.latLng(c.lat, c.lng));

    const polyline = L.polyline(latlngs, {
      color: '#0066ff',
      weight: 4
    });

    polyline.bindPopup(`<strong>${placemark.name}</strong>${placemark.description ? '<br>' + placemark.description : ''}`);

    return polyline;
  }

  zoomToKmlLayer(index: number) {
    if (this.map && this.kmlLayers[index]) {
      this.map.fitBounds(this.kmlLayers[index].bounds, { padding: [50, 50] });
    }
  }

  removeKmlLayer(index: number) {
    if (this.map && this.kmlLayers[index]) {
      this.map.removeLayer(this.kmlLayers[index].layerGroup);
      this.kmlLayers.splice(index, 1);

      if (this.kmlLayers.length === 0) {
        this.showKmlPanel = false;
      }
    }
  }
}
