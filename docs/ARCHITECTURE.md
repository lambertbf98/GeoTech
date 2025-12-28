# Arquitectura GeoTech

## Vision General

GeoTech es una aplicacion movil hibrida con arquitectura offline-first. El frontend esta construido con Ionic + Angular + Capacitor, permitiendo ejecutarse como PWA (web), aplicacion Android o aplicacion iOS desde una unica base de codigo.

---

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTE                                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      Ionic + Angular 19                            │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                         PAGES                                 │ │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│ │  │
│  │  │  │ Login   │ │Projects │ │ Camera  │ │GeoVisor │ │Settings ││ │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘│ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │                               │                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                       SERVICES                                │ │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│ │  │
│  │  │  │  Auth   │ │ Camera  │ │   GPS   │ │ Storage │ │ Claude  ││ │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘│ │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                        │ │  │
│  │  │  │Catastro │ │   API   │ │  Sync   │                        │ │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘                        │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │                               │                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                   Capacitor Plugins                           │ │  │
│  │  │  Camera | Geolocation | Preferences | StatusBar | Keyboard   │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                  │                                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Almacenamiento Local                            │  │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐  │  │
│  │  │   Preferences   │ │   localStorage  │ │   Base64 Images     │  │  │
│  │  │   (Proyectos,   │ │   (Perfil,      │ │   (Fotos            │  │  │
│  │  │    Fotos,       │ │    Config)      │ │    guardadas)       │  │  │
│  │  │    Mediciones)  │ │                 │ │                     │  │  │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTPS
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            APIS EXTERNAS                                 │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │                 │  │                 │  │                         │  │
│  │  Catastro OVC   │  │   Nominatim     │  │      Claude API         │  │
│  │  (WMS/INSPIRE)  │  │   (Geocoding)   │  │   (Analisis imagenes)   │  │
│  │                 │  │                 │  │                         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐                               │
│  │                 │  │                 │                               │
│  │     ArcGIS      │  │  OpenStreetMap  │                               │
│  │   (Satelite)    │  │    (Mapas)      │                               │
│  │                 │  │                 │                               │
│  └─────────────────┘  └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes del Frontend

### 1. Paginas (Pages)

| Pagina | Ruta | Descripcion |
|--------|------|-------------|
| `LoginPage` | `/login` | Inicio de sesion con email/password |
| `RegisterPage` | `/register` | Registro de nuevos usuarios |
| `ProjectsPage` | `/tabs/projects` | Lista de proyectos con busqueda |
| `ProjectDetailPage` | `/project-detail/:id` | Detalle del proyecto con fotos |
| `CameraPage` | `/tabs/camera` | Captura e importacion de fotos |
| `CatastroPage` | `/tabs/catastro` | GeoVisor 2D/3D con mediciones |
| `MedicionesPage` | `/tabs/mediciones` | Historial de mediciones |
| `SettingsPage` | `/tabs/settings` | Ajustes y perfil de usuario |

### 2. Servicios (Services)

| Servicio | Archivo | Responsabilidad |
|----------|---------|-----------------|
| `AuthService` | `auth.service.ts` | Login, registro, logout, gestion de tokens |
| `ApiService` | `api.service.ts` | Comunicacion HTTP con backend |
| `CameraService` | `camera.service.ts` | Captura de fotos con Capacitor Camera |
| `GpsService` | `gps.service.ts` | Obtencion de coordenadas GPS |
| `StorageService` | `storage.service.ts` | CRUD local con Capacitor Preferences |
| `SyncService` | `sync.service.ts` | Sincronizacion offline/online |
| `CatastroService` | `catastro.service.ts` | Consultas WMS al Catastro espanol |
| `ClaudeService` | `claude.service.ts` | Analisis de imagenes con IA |

### 3. Modelos de Datos

#### Project (Proyecto)
```typescript
interface Project {
  id: string;              // Identificador unico
  name: string;            // Nombre del proyecto
  description?: string;    // Descripcion opcional
  location?: string;       // Ubicacion (direccion)
  photoCount?: number;     // Numero de fotos
  createdAt: Date;         // Fecha de creacion
  updatedAt: Date;         // Ultima modificacion
  synced: boolean;         // Estado de sincronizacion
}
```

#### Photo (Foto)
```typescript
interface Photo {
  id: string;              // Identificador unico
  projectId: string;       // ID del proyecto asociado
  imagePath?: string;      // Imagen en base64
  latitude: number;        // Coordenada latitud
  longitude: number;       // Coordenada longitud
  altitude?: number;       // Altitud (opcional)
  accuracy?: number;       // Precision GPS en metros
  location?: string;       // Direccion (reverse geocoding)
  catastroRef?: string;    // Referencia catastral
  catastroData?: CatastroData;  // Datos del catastro
  aiDescription?: string;  // Descripcion generada por IA
  notes?: string;          // Notas del usuario
  timestamp?: string;      // Fecha/hora ISO
  synced: boolean;         // Estado de sincronizacion
}
```

#### Measurement (Medicion)
```typescript
interface Measurement {
  id: string;              // Identificador unico
  type: 'distance' | 'area'; // Tipo de medicion
  points: MeasurementPoint[]; // Puntos de la medicion
  value: number;           // Valor (metros o m²)
  location?: string;       // Ubicacion aproximada
  createdAt: string;       // Fecha de creacion
  notes?: string;          // Notas opcionales
}

interface MeasurementPoint {
  lat: number;
  lng: number;
}
```

#### CatastroData (Datos Catastrales)
```typescript
interface CatastroData {
  referenciaCatastral: string;
  direccion?: string;
  superficie?: number;
  uso?: string;
  clase?: string;
  municipio?: string;
  provincia?: string;
}
```

---

## GeoVisor

### Modos de Visualizacion

#### 1. Modo Mapa (Leaflet)
- Capa base: OpenStreetMap
- Interaccion: click para seleccionar, drag para mover
- Zoom: niveles 1-22

#### 2. Modo Satelite (Leaflet + ArcGIS)
- Capa base: ArcGIS World Imagery (gratuito)
- Misma interaccion que modo mapa

#### 3. Modo Earth (Cesium)
- Globo 3D con imagenes ArcGIS
- Navegacion: rotar, zoom, inclinar
- Sin necesidad de API key

#### 4. Capa Catastro (WMS)
- Superposicion opcional sobre cualquier modo 2D
- Servicio: OVC Catastro INSPIRE
- Muestra limites de parcelas

### Herramientas de Medicion

```
Distancia:
1. Usuario activa modo distancia
2. Click en punto A → se crea marcador
3. Click en punto B → se dibuja linea
4. Se calcula distancia usando formula Haversine
5. Se puede continuar anadiendo puntos
6. Al finalizar, se guarda en StorageService

Area:
1. Usuario activa modo area
2. Click en puntos → se crea poligono
3. Minimo 3 puntos para calcular area
4. Se usa algoritmo de Shoelace para el calculo
5. Al finalizar, se guarda en StorageService
```

---

## Sistema de Almacenamiento

### Capacitor Preferences
Almacena datos estructurados en formato JSON:
- `geotech_projects`: Array de proyectos
- `geotech_photos`: Array de fotos
- `geotech_measurements`: Array de mediciones

### localStorage
Almacena configuracion de usuario:
- `user_profile_photo`: Foto de perfil en base64
- `user_profile_name`: Nombre del usuario
- `user_profile_email`: Email del usuario
- `geovisor_lat/lon/mode`: Ultima posicion del mapa

### Imagenes
- Las fotos se almacenan como strings base64 dentro de `imagePath`
- Permite persistencia completa sin necesidad de servidor de archivos

---

## Flujos de Datos

### 1. Crear Proyecto

```
Usuario pulsa "+"
       │
       ▼
┌──────────────────┐
│ GpsService       │
│ getCurrentPos()  │
└────────┬─────────┘
         │ coordenadas
         ▼
┌──────────────────┐
│ Nominatim API    │
│ reverse geocode  │
└────────┬─────────┘
         │ direccion
         ▼
┌──────────────────┐
│ AlertController  │
│ mostrar form     │
│ (nombre,desc,    │
│  ubicacion)      │
└────────┬─────────┘
         │ datos
         ▼
┌──────────────────┐
│ StorageService   │
│ setProjects()    │
└────────┬─────────┘
         │
         ▼
   Proyecto creado
```

### 2. Captura de Foto

```
Usuario pulsa "Camara" o "Galeria"
              │
              ▼
┌─────────────────────────┐
│ CameraService           │
│ takePhoto() / getPhoto()│
└───────────┬─────────────┘
            │ imagen
            ▼
┌─────────────────────────┐
│ GpsService              │
│ getCurrentPosition()    │
│ (o extraer de EXIF)     │
└───────────┬─────────────┘
            │ coordenadas
            ▼
┌─────────────────────────┐
│ Nominatim API           │
│ reverse geocode         │
└───────────┬─────────────┘
            │ direccion
            ▼
┌─────────────────────────┐
│ Convertir a base64      │
│ FileReader.readAsDataURL│
└───────────┬─────────────┘
            │ base64
            ▼
┌─────────────────────────┐
│ StorageService          │
│ addPhoto()              │
└───────────┬─────────────┘
            │
            ▼
     Foto guardada
```

### 3. Consulta Catastral

```
Usuario selecciona punto en mapa
              │
              ▼
┌─────────────────────────┐
│ CatastroService         │
│ getParcelByCoordinates()│
└───────────┬─────────────┘
            │ lat, lon
            ▼
┌─────────────────────────┐
│ OVC Catastro API        │
│ POST consulta_RCCOOR    │
└───────────┬─────────────┘
            │ XML response
            ▼
┌─────────────────────────┐
│ Parsear XML             │
│ extraer datos           │
└───────────┬─────────────┘
            │ CatastroData
            ▼
┌─────────────────────────┐
│ Mostrar en panel        │
│ info del mapa           │
└─────────────────────────┘
```

### 4. Descripcion con IA

```
Usuario pulsa icono IA
         │
         ▼
┌─────────────────────────┐
│ ClaudeService           │
│ analyzeImage()          │
└───────────┬─────────────┘
         │ base64 imagen
         ▼
┌─────────────────────────┐
│ Claude API              │
│ POST /messages          │
│ model: claude-3-haiku   │
└───────────┬─────────────┘
         │ descripcion
         ▼
┌─────────────────────────┐
│ StorageService          │
│ updatePhoto()           │
└───────────┬─────────────┘
         │
         ▼
   Descripcion guardada
```

---

## APIs Externas

### Catastro OVC
- **URL**: `https://ovc.catastro.meh.es/ovcservweb/`
- **Servicios**:
  - `OVCCallejero.asmx/ConsultaProvincia` - Lista de provincias
  - `OVCCoordenadas.asmx/Consulta_RCCOOR` - Busqueda por coordenadas
- **WMS**: `https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx`
- **Autenticacion**: No requiere
- **Limite**: Sin documentar (uso razonable)

### Nominatim (OpenStreetMap)
- **URL**: `https://nominatim.openstreetmap.org/`
- **Servicios**:
  - `/search` - Busqueda de direcciones
  - `/reverse` - Coordenadas a direccion
- **Autenticacion**: No requiere
- **Limite**: 1 request/segundo (politica de uso)

### ArcGIS (Imagenes Satelite)
- **URL**: `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer`
- **Uso**: Capa de tiles para Leaflet y Cesium
- **Autenticacion**: No requiere para uso basico
- **Limite**: Sin limite para visualizacion

### Claude API (Anthropic)
- **URL**: `https://api.anthropic.com/v1/messages`
- **Modelo**: claude-3-haiku (mas economico)
- **Autenticacion**: API Key requerida
- **Coste**: ~$0.00025 por imagen
- **Uso**: Descripcion tecnica de fotografias

---

## Seguridad

### Autenticacion
- JWT tokens almacenados en Preferences (seguro)
- Tokens de sesion con expiracion configurable
- Refresh tokens para renovacion automatica

### Almacenamiento
- Capacitor Preferences usa almacenamiento nativo seguro
- iOS: NSUserDefaults (sandboxed)
- Android: SharedPreferences (sandboxed)

### Comunicacion
- HTTPS obligatorio para todas las APIs
- API keys nunca expuestas en cliente (excepto Claude para demo)

### Datos Sensibles
- Contrasenas hasheadas (nunca en texto plano)
- Fotos almacenadas localmente (no se envian sin consentimiento)
- Coordenadas GPS solo se usan con permiso del usuario

---

## Rendimiento

### Optimizaciones
- Imagenes comprimidas automaticamente por Capacitor
- Lazy loading de modulos Angular
- Standalone components para reducir bundle size
- Carga bajo demanda de Cesium (solo en modo Earth)

### Metricas
- Tiempo de inicio: < 3 segundos
- Captura de foto: < 1 segundo
- Geocoding: < 2 segundos
- Carga de mapa: < 1 segundo

---

*Documentacion actualizada el 28/12/2024*
