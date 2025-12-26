import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { LoadingController, ToastController, AlertController, NavController } from '@ionic/angular';
import { CatastroService } from '../../services/catastro.service';
import { GpsService } from '../../services/gps.service';
import { StorageService } from '../../services/storage.service';
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

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private satelliteLayer: L.TileLayer | null = null;
  private streetLayer: L.TileLayer | null = null;
  private catastroLayer: L.TileLayer.WMS | null = null;
  private cesiumViewer: any = null;
  private measureLayer: L.LayerGroup | null = null;
  private measurePolyline: L.Polyline | null = null;
  private measurePolygon: L.Polygon | null = null;

  constructor(
    private catastroService: CatastroService,
    private gpsService: GpsService,
    private storageService: StorageService,
    private loadingCtrl: LoadingController,
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

  ngAfterViewInit() {
    setTimeout(() => this.initMap(), 400);
  }

  ngOnDestroy() {
    if (this.map) { this.map.remove(); this.map = null; }
    if (this.cesiumViewer) { this.cesiumViewer.destroy(); this.cesiumViewer = null; }
  }

  private initMap() {
    if (this.map) return;
    const container = document.getElementById('mainMap');
    if (!container) return;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const lat = parseFloat(this.latitude) || 40.416775;
    const lon = parseFloat(this.longitude) || -3.703790;

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
    const loading = await this.loadingCtrl.create({ message: 'Localizando...', spinner: 'crescent' });
    await loading.present();
    try {
      const pos = await this.gpsService.getCurrentPosition();
      this.latitude = pos.latitude.toFixed(6);
      this.longitude = pos.longitude.toFixed(6);
      if (this.map) { this.map.setView([pos.latitude, pos.longitude], 18); this.addMarker(pos.latitude, pos.longitude); }
      this.showToast('Ubicacion encontrada', 'success');
    } catch (e: any) { this.showToast(e.message || 'Error GPS', 'danger'); }
    await loading.dismiss();
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
    const loading = await this.loadingCtrl.create({ message: 'Consultando Catastro...', spinner: 'crescent' });
    await loading.present();
    try {
      this.parcelData = await this.catastroService.getParcelByCoordinates(parseFloat(this.latitude), parseFloat(this.longitude));
      if (this.parcelData) {
        this.showInfoPanel = true;
        this.showToast('Parcela encontrada', 'success');
        console.log('Datos catastro:', this.parcelData);
      }
    } catch (error) {
      console.error('Error catastro:', error);
      this.parcelData = null;
      this.showToast('Sin datos catastrales', 'warning');
    }
    await loading.dismiss();
  }

  async openEarthView() {
    this.viewMode = 'earth';
    const loading = await this.loadingCtrl.create({ message: 'Cargando 3D...', spinner: 'crescent' });
    await loading.present();
    setTimeout(async () => {
      try {
        const Cesium = await import('cesium');
        (window as any).CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.113/Build/Cesium/';

        // Token de Cesium Ion (gratuito en cesium.com)
        // Si no tienes token, el visor funcionara pero sin terreno 3D avanzado
        Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYmM4OTk0Yy01OGM2LTQ0NTAtOWEwOC02MDg0NDEzZjY4MzciLCJpZCI6MjU5LCJpYXQiOjE3MzUyMTk4MTV9.demo_token_replace_with_yours';

        if (!document.getElementById('cesium-css')) {
          const link = document.createElement('link'); link.id = 'cesium-css'; link.rel = 'stylesheet';
          link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.113/Build/Cesium/Widgets/widgets.css';
          document.head.appendChild(link);
        }
        const lat = parseFloat(this.latitude) || 40.416775;
        const lon = parseFloat(this.longitude) || -3.703790;

        // Usar EllipsoidTerrainProvider si no hay token valido (terreno plano pero funcional)
        let terrainProvider;
        try {
          terrainProvider = await Cesium.createWorldTerrainAsync();
        } catch {
          terrainProvider = new Cesium.EllipsoidTerrainProvider();
        }

        this.cesiumViewer = new Cesium.Viewer('earthView', {
          terrainProvider,
          baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
          navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false,
          infoBox: false, selectionIndicator: false, creditContainer: document.createElement('div')
        });

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
        this.showToast('Error cargando vista 3D', 'danger');
        this.viewMode = 'map';
      }
      await loading.dismiss();
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
      this.showToast('Escribe al menos 3 caracteres', 'warning');
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Buscando...', spinner: 'crescent' });
    await loading.present();
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.searchAddress)}&countrycodes=es&limit=5`;
      const results = await this.http.get<any[]>(url).toPromise();
      this.searchResults = results || [];
      this.showAddressResults = this.searchResults.length > 0;
      if (this.searchResults.length === 0) {
        this.showToast('No se encontraron resultados', 'warning');
      }
    } catch (e) {
      this.showToast('Error en la busqueda', 'danger');
    }
    await loading.dismiss();
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
    if (!this.map) return;
    this.measureLayer = L.layerGroup().addTo(this.map);
    this.showToast(mode === 'distance' ? 'Toca puntos para medir distancia' : 'Toca puntos para medir area', 'primary');
    this.map.off('click');
    this.map.on('click', (e: L.LeafletMouseEvent) => this.addMeasurePoint(e.latlng));
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

    if (this.measureLayer && this.map) {
      this.map.removeLayer(this.measureLayer);
    }
    this.measureLayer = null;
    this.measurePolyline = null;
    this.measurePolygon = null;
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
    this.showToast(
      `${this.measureMode === 'distance' ? 'Distancia' : 'Área'} guardada: ${measurement.value.toFixed(2)} ${this.measureMode === 'distance' ? 'm' : 'm²'}`,
      'success'
    );
  }

  goToMeasurements() {
    this.navCtrl.navigateForward('/tabs/mediciones');
  }

  // ========== VISTAS INTERNAS (sin abrir navegador externo) ==========
  openInGoogleMaps() {
    // Cambiar a vista de mapa con capa de calle
    if (!this.latitude || !this.longitude) {
      this.showToast('Selecciona una ubicacion primero', 'warning');
      return;
    }
    this.setMapType('street');
    const lat = parseFloat(this.latitude);
    const lon = parseFloat(this.longitude);
    if (this.map) {
      this.map.setView([lat, lon], 19);
    }
    this.showToast('Vista de mapa activada', 'primary');
  }

  openInGoogleEarth() {
    // Abrir vista 3D de Cesium (interna)
    if (!this.latitude || !this.longitude) {
      this.showToast('Selecciona una ubicacion primero', 'warning');
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
    this.showToast('Capa Catastro activada', 'primary');
  }

  private async showToast(msg: string, color: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 2000, position: 'top', color });
    await toast.present();
  }
}
