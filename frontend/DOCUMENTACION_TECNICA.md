# GeoTech - Documentación Técnica Completa

**Versión:** 1.0
**Fecha:** 29/12/2025
**Tipo de Aplicación:** Aplicación Móvil Híbrida (iOS/Android/Web)
**Framework:** Ionic 8 + Angular 20 + Capacitor 8

---

## Índice

1. [Descripción General](#1-descripción-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Modelos de Datos](#4-modelos-de-datos)
5. [Servicios](#5-servicios)
6. [Páginas y Componentes](#6-páginas-y-componentes)
7. [Sistema de Almacenamiento](#7-sistema-de-almacenamiento)
8. [Funcionalidades Principales](#8-funcionalidades-principales)
9. [Integraciones Externas](#9-integraciones-externas)
10. [Seguridad](#10-seguridad)
11. [Configuración de Entornos](#11-configuración-de-entornos)
12. [Dependencias](#12-dependencias)
13. [Guía de Despliegue](#13-guía-de-despliegue)

---

## 1. Descripción General

### 1.1 Propósito

GeoTech es una aplicación móvil diseñada para profesionales del sector de arquitectura, topografía e ingeniería civil. Permite la gestión integral de proyectos de campo con capacidades de:

- Georreferenciación de fotografías
- Análisis de imágenes mediante Inteligencia Artificial
- Consulta de datos catastrales
- Generación de informes profesionales
- Exportación de datos geográficos (KML/KMZ)
- Mediciones de distancias y áreas
- Visualización cartográfica 2D y 3D

### 1.2 Usuarios Objetivo

- Arquitectos
- Ingenieros civiles
- Topógrafos
- Técnicos de urbanismo
- Peritos tasadores
- Inspectores de obra

### 1.3 Plataformas Soportadas

| Plataforma | Estado | Notas |
|------------|--------|-------|
| iOS | ✅ Soportado | Requiere iOS 13+ |
| Android | ✅ Soportado | Requiere Android 8+ |
| Web (PWA) | ✅ Soportado | Navegadores modernos |

---

## 2. Arquitectura del Sistema

### 2.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Frontend)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Angular   │  │    Ionic    │  │       Capacitor         │  │
│  │  Framework  │  │     UI      │  │   (APIs Nativas)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      SERVICIOS                            │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │   │
│  │  │  Auth  │ │Storage │ │  Sync  │ │ Camera │ │  GPS   │  │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │   │
│  │  │Catastro│ │ Report │ │  KML   │ │ Claude │ │Security│  │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   ALMACENAMIENTO LOCAL                    │   │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐    │   │
│  │  │    IndexedDB    │  │   Capacitor Preferences     │    │   │
│  │  │ (Fotos/Proyectos)│  │ (Config/Cola Sync/Medidas) │    │   │
│  │  └─────────────────┘  └─────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SERVIDOR (Backend)                         │
├─────────────────────────────────────────────────────────────────┤
│  URL: https://geotech-production.up.railway.app/api             │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │    Auth    │  │  Projects  │  │   Photos   │                 │
│  │   /auth/*  │  │ /projects/*│  │  /photos/* │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │  Reports   │  │    KML     │  │   Claude   │                 │
│  │ /reports/* │  │   /kml/*   │  │  /claude/* │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICIOS EXTERNOS                            │
├─────────────────────────────────────────────────────────────────┤
│  • Catastro España (ovc.catastro.meh.es)                        │
│  • OpenStreetMap Nominatim (geocoding)                          │
│  • ArcGIS Online (mapas satélite)                               │
│  • Claude AI API (análisis de imágenes)                         │
│  • Cesium Ion (visualización 3D)                                │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Patrones de Diseño Implementados

| Patrón | Implementación |
|--------|----------------|
| **Singleton** | Servicios inyectables con `providedIn: 'root'` |
| **Observer** | RxJS Observables para reactividad |
| **Repository** | StorageService como abstracción de persistencia |
| **Interceptor** | SecurityInterceptor para HTTP |
| **Lazy Loading** | Carga diferida de módulos de páginas |
| **Reactive Forms** | Formularios con validación reactiva |

### 2.3 Flujo de Datos

```
Usuario → Página → Servicio → API/Storage → Respuesta → UI
                      ↓
              Cola de Sincronización
                      ↓
              Sync cuando hay conexión
```

---

## 3. Estructura del Proyecto

```
frontend/
├── src/
│   ├── app/
│   │   ├── pages/                    # Páginas de la aplicación
│   │   │   ├── login/                # Autenticación
│   │   │   ├── register/             # Registro de usuarios
│   │   │   ├── tabs/                 # Hub de navegación
│   │   │   ├── projects/             # Listado de proyectos
│   │   │   ├── project-detail/       # Detalle del proyecto
│   │   │   ├── project-editor/       # Editor de mapa/proyecto
│   │   │   ├── camera/               # Captura de fotos
│   │   │   ├── catastro/             # Visor geográfico
│   │   │   ├── mediciones/           # Mediciones guardadas
│   │   │   ├── settings/             # Configuración
│   │   │   └── export/               # Exportación
│   │   │
│   │   ├── services/                 # Lógica de negocio
│   │   │   ├── api.service.ts        # Cliente HTTP base
│   │   │   ├── auth.service.ts       # Autenticación
│   │   │   ├── camera.service.ts     # Cámara/Galería
│   │   │   ├── gps.service.ts        # Geolocalización
│   │   │   ├── storage.service.ts    # Persistencia local
│   │   │   ├── sync.service.ts       # Sincronización
│   │   │   ├── catastro.service.ts   # API Catastro
│   │   │   ├── report.service.ts     # Generación informes
│   │   │   ├── kml.service.ts        # Export/Import KML
│   │   │   ├── claude.service.ts     # IA análisis
│   │   │   └── security.service.ts   # Seguridad
│   │   │
│   │   ├── models/                   # Interfaces TypeScript
│   │   │   ├── user.model.ts
│   │   │   ├── project.model.ts
│   │   │   ├── photo.model.ts
│   │   │   ├── measurement.model.ts
│   │   │   ├── catastro.model.ts
│   │   │   └── sync.model.ts
│   │   │
│   │   ├── interceptors/             # Interceptores HTTP
│   │   │   └── security.interceptor.ts
│   │   │
│   │   ├── app.module.ts             # Módulo raíz
│   │   ├── app-routing.module.ts     # Rutas
│   │   └── app.component.ts          # Componente raíz
│   │
│   ├── environments/                 # Configuración por entorno
│   │   ├── environment.ts            # Desarrollo
│   │   └── environment.prod.ts       # Producción
│   │
│   ├── theme/                        # Variables de estilo
│   │   └── variables.scss
│   │
│   ├── global.scss                   # Estilos globales
│   └── index.html                    # HTML principal
│
├── angular.json                      # Config Angular CLI
├── ionic.config.json                 # Config Ionic
├── capacitor.config.ts               # Config Capacitor
├── package.json                      # Dependencias
└── tsconfig.json                     # Config TypeScript
```

---

## 4. Modelos de Datos

### 4.1 Usuario (User)

```typescript
interface User {
  id: string;
  email: string;
  name: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface AuthResponse {
  user: User;
  token: string;        // JWT de acceso
  refreshToken: string; // Token de refresco
}
```

### 4.2 Proyecto (Project)

```typescript
interface GeoPoint {
  lat: number;
  lng: number;
}

interface Project {
  id: string;                    // ID local (UUID)
  serverId?: string;             // ID en servidor (para sync)
  name: string;                  // Nombre del proyecto
  description?: string;          // Descripción
  location?: string;             // Dirección/ubicación
  coordinates?: GeoPoint;        // Coordenadas centrales
  photoCount?: number;           // Contador de fotos
  zones?: ProjectZone[];         // Zonas de estudio (polígonos)
  paths?: ProjectPath[];         // Viales (líneas)
  markers?: ProjectMarker[];     // Puntos de interés
  reports?: ProjectReport[];     // Informes generados
  kmls?: ProjectKml[];           // Archivos KML guardados
  notes?: string;                // Notas generales
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;               // Estado de sincronización
}

interface ProjectZone {
  id: string;
  name: string;
  description?: string;
  coordinates: GeoPoint[];       // Vértices del polígono
  color?: string;                // Color de visualización
  createdAt: string;
}

interface ProjectPath {
  id: string;
  name: string;
  description?: string;
  coordinates: GeoPoint[];       // Puntos del trazado
  color?: string;
  createdAt: string;
}

interface ProjectMarker {
  id: string;
  name: string;
  description?: string;
  coordinate: GeoPoint;          // Ubicación del punto
  photoIds?: string[];           // IDs de fotos asociadas
  aiDescription?: string;        // Descripción generada por IA
  createdAt: string;
}

interface ProjectReport {
  id: string;
  name: string;                  // "Informe PDD 29/12/2025 13:37:11"
  htmlContent: string;           // Contenido HTML del informe
  createdAt: string;
}

interface ProjectKml {
  id: string;
  name: string;                  // "Informe KML 29/12/2025 13:37:04"
  kmlContent: string;            // Contenido XML del KML
  createdAt: string;
}
```

### 4.3 Fotografía (Photo)

```typescript
interface Photo {
  id: string;                    // UUID
  projectId: string;             // Proyecto al que pertenece
  localPath?: string;            // Ruta local del archivo
  imageUrl?: string;             // URL o Base64 de la imagen
  thumbnailUrl?: string;         // Miniatura
  latitude: number;              // Coordenada GPS
  longitude: number;
  altitude?: number;             // Altitud en metros
  accuracy?: number;             // Precisión GPS en metros
  location?: string;             // Dirección geocodificada
  catastroRef?: string;          // Referencia catastral
  catastroData?: CatastroData;   // Datos completos del catastro
  aiDescription?: string;        // Análisis de IA
  notes?: string;                // Notas del usuario
  timestamp?: string;            // Fecha de captura
  createdAt?: Date;
  updatedAt?: Date;
  synced: boolean;
}
```

### 4.4 Medición (Measurement)

```typescript
interface MeasurementPoint {
  lat: number;
  lng: number;
}

interface Measurement {
  id: string;
  type: 'distance' | 'area';     // Tipo de medición
  points: MeasurementPoint[];    // Puntos que definen la medición
  value: number;                 // Valor en metros o m²
  location?: string;             // Ubicación aproximada
  createdAt: string;
  notes?: string;
}
```

### 4.5 Catastro (CatastroData)

```typescript
interface CatastroData {
  referenciaCatastral: string;   // Ref. catastral de 20 dígitos
  direccion: string;             // Dirección completa
  superficie?: number;           // Superficie en m²
  uso?: string;                  // Uso principal
  clase?: string;                // Rústico/Urbano
  municipio?: string;
  provincia?: string;
}
```

### 4.6 Sincronización (Sync)

```typescript
type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';
type SyncEntity = 'project' | 'photo';
type SyncStatus = 'pending' | 'syncing' | 'completed' | 'error';

interface SyncQueueItem {
  id: string;
  action: SyncAction;
  entity: SyncEntity;
  entityId: string;
  data: any;                     // Datos a sincronizar
  createdAt: Date;
  attempts: number;              // Intentos realizados
  lastAttempt?: Date;
  error?: string;                // Último error
  status: SyncStatus;
}
```

---

## 5. Servicios

### 5.1 ApiService

**Archivo:** `services/api.service.ts`

**Propósito:** Cliente HTTP centralizado para todas las comunicaciones con el backend.

**Métodos principales:**

| Método | Descripción |
|--------|-------------|
| `get<T>(endpoint)` | Petición GET genérica |
| `post<T>(endpoint, body)` | Petición POST genérica |
| `put<T>(endpoint, body)` | Petición PUT genérica |
| `delete<T>(endpoint)` | Petición DELETE genérica |
| `uploadFile<T>(endpoint, file, fieldName)` | Subida de archivos |
| `createReport(projectId, name, htmlContent)` | Guardar informe |
| `createKml(projectId, name, kmlContent)` | Guardar KML |

**Características:**
- Inyección automática de token JWT en headers
- Manejo centralizado de errores HTTP
- Timeout configurable (30 segundos por defecto)

---

### 5.2 AuthService

**Archivo:** `services/auth.service.ts`

**Propósito:** Gestión completa del ciclo de autenticación.

**Métodos principales:**

| Método | Descripción |
|--------|-------------|
| `login(email, password)` | Iniciar sesión |
| `register(name, email, password)` | Registrar usuario |
| `logout()` | Cerrar sesión |
| `refreshToken()` | Renovar token expirado |
| `isAuthenticated` | Verificar si hay sesión activa |

**Observables:**
- `currentUser$`: Emite cambios en el usuario actual

**Almacenamiento:**
- Token guardado en Capacitor Preferences
- Sesión persistente entre reinicios de app

---

### 5.3 StorageService

**Archivo:** `services/storage.service.ts`

**Propósito:** Abstracción de almacenamiento local con soporte offline.

**Arquitectura de almacenamiento:**

```
IndexedDB (geotech_db v2)
├── photos     → Fotos con imágenes base64
└── projects   → Proyectos completos

Capacitor Preferences
├── sync_queue      → Cola de sincronización
└── measurements    → Mediciones realizadas
```

**Métodos para Proyectos:**

| Método | Descripción |
|--------|-------------|
| `getProjects()` | Obtener todos los proyectos |
| `getProject(id)` | Obtener proyecto por ID |
| `saveProject(project)` | Guardar/actualizar proyecto |
| `deleteProject(id)` | Eliminar proyecto |

**Métodos para Fotos:**

| Método | Descripción |
|--------|-------------|
| `getPhotos(projectId?)` | Obtener fotos (filtro opcional) |
| `getPhoto(id)` | Obtener foto por ID |
| `savePhoto(photo)` | Guardar foto |
| `updatePhoto(photo)` | Actualizar foto existente |
| `deletePhoto(id)` | Eliminar foto |

**Métodos para Sincronización:**

| Método | Descripción |
|--------|-------------|
| `getSyncQueue()` | Obtener cola pendiente |
| `addToSyncQueue(item)` | Añadir a cola |
| `removeFromSyncQueue(id)` | Eliminar de cola |
| `clearSyncQueue()` | Limpiar cola completa |

**Límites de almacenamiento:**
- IndexedDB: ~50MB+ (depende del navegador/dispositivo)
- Preferences: ~5MB (solo datos pequeños)

---

### 5.4 SyncService

**Archivo:** `services/sync.service.ts`

**Propósito:** Sincronización automática bidireccional con el servidor.

**Observables:**

| Observable | Tipo | Descripción |
|------------|------|-------------|
| `isOnline$` | `BehaviorSubject<boolean>` | Estado de conexión |
| `isSyncing$` | `BehaviorSubject<boolean>` | Sincronización en curso |
| `pendingCount$` | `BehaviorSubject<number>` | Items pendientes |

**Métodos:**

| Método | Descripción |
|--------|-------------|
| `syncPending()` | Sincronizar cola pendiente |
| `syncAll()` | Sincronización completa |
| `queueForSync(action, entity, entityId, data)` | Encolar para sync |

**Comportamiento:**
- Detecta automáticamente cambios de conexión
- Reintenta hasta 3 veces en caso de error
- Sincroniza automáticamente al recuperar conexión

---

### 5.5 CameraService

**Archivo:** `services/camera.service.ts`

**Propósito:** Captura de imágenes desde cámara o galería.

**Métodos:**

| Método | Descripción |
|--------|-------------|
| `takePhoto()` | Abrir cámara y capturar |
| `pickFromGallery()` | Seleccionar de galería |
| `getPhotoBase64(path)` | Obtener imagen en base64 |
| `deletePhoto(path)` | Eliminar archivo local |

**Características:**
- Soporte nativo (Capacitor Camera) y web (File Input)
- Compresión automática a 800px máximo
- Calidad JPEG al 60% para optimizar espacio
- Compatible con iOS Safari (gestión especial de user gesture)

---

### 5.6 GpsService

**Archivo:** `services/gps.service.ts`

**Propósito:** Geolocalización de alta precisión.

**Métodos:**

| Método | Descripción |
|--------|-------------|
| `getCurrentPosition()` | Obtener posición actual |
| `watchPosition(callback)` | Monitorizar posición |
| `clearWatch(watchId)` | Detener monitorización |
| `calculateDistance(p1, p2)` | Calcular distancia (Haversine) |
| `formatCoordinates(lat, lng)` | Formatear coordenadas |

**Configuración:**
- Alta precisión habilitada
- Timeout: 10 segundos
- Edad máxima de caché: 0 (siempre fresco)

---

### 5.7 CatastroService

**Archivo:** `services/catastro.service.ts`

**Propósito:** Consulta de datos catastrales españoles.

**Métodos:**

| Método | Descripción |
|--------|-------------|
| `getParcelByCoordinates(lat, lng)` | Buscar parcela por ubicación |
| `getParcelByReference(ref)` | Buscar por referencia catastral |
| `getViewerUrl(ref)` | URL del visor de Catastro |
| `formatReferencia(ref)` | Formatear referencia |

**API utilizada:**
- Endpoint: `https://ovc.catastro.meh.es/ovcservweb/`
- Formato de respuesta: XML
- Datos obtenidos: Referencia, dirección, superficie, uso, clase

---

### 5.8 ReportService

**Archivo:** `services/report.service.ts`

**Propósito:** Generación de informes profesionales.

**Métodos:**

| Método | Descripción |
|--------|-------------|
| `generateReport(data)` | Generar documento Word (Blob) |
| `generateHtmlPreview(data)` | Generar vista previa HTML |
| `downloadReport(blob, filename)` | Descargar archivo |

**Estructura del informe:**
1. Portada con datos del proyecto
2. Resumen ejecutivo (IA)
3. Zonas de estudio
4. Viales identificados
5. Puntos de interés con fotos
6. Fotos georreferenciadas
7. Observaciones y notas

**Formato de nombre:** `Informe PDD DD/MM/YYYY HH:MM:SS`

---

### 5.9 KmlService

**Archivo:** `services/kml.service.ts`

**Propósito:** Exportación e importación de datos geográficos.

**Métodos de exportación:**

| Método | Descripción |
|--------|-------------|
| `generateKml(data)` | Generar KML (string XML) |
| `generateKmz(data)` | Generar KMZ (Blob ZIP) |
| `downloadKmz(data, filename)` | Descargar KMZ |

**Métodos de importación:**

| Método | Descripción |
|--------|-------------|
| `parseKml(kmlString)` | Parsear contenido KML |
| `parseKmz(kmzData)` | Parsear archivo KMZ |
| `readFile(file)` | Leer archivo KML/KMZ |

**Elementos soportados:**
- Puntos (Placemarks con Point)
- Líneas (LineString)
- Polígonos (Polygon)
- Imágenes embebidas (en KMZ)
- Descripciones HTML con fotos, notas y análisis IA

**Formato de nombre:** `Informe KML DD/MM/YYYY HH:MM:SS`

---

### 5.10 ClaudeService

**Archivo:** `services/claude.service.ts`

**Propósito:** Análisis de imágenes mediante IA.

**Métodos:**

| Método | Descripción |
|--------|-------------|
| `analyzeImage(imagePath)` | Analizar imagen individual |
| `generateProjectReport(input)` | Generar informe completo |
| `describePhoto(base64)` | Describir foto |
| `describePhotoWithContext(base64, context)` | Descripción contextual |

**Tipos de análisis disponibles:**
1. General
2. Terreno
3. Estructura
4. Hidrología
5. Accesibilidad
6. Impacto Ambiental

**Fallback:** Si el backend falla, genera descripción local básica.

---

### 5.11 SecurityService

**Archivo:** `services/security.service.ts`

**Propósito:** Verificaciones y utilidades de seguridad.

**Métodos de verificación:**

| Método | Descripción |
|--------|-------------|
| `checkSecurity()` | Verificación completa al inicio |
| `isRooted()` | Detectar root/jailbreak |
| `isDebuggerAttached()` | Detectar depurador |
| `isEmulator()` | Detectar emulador |

**Métodos de sanitización:**

| Método | Descripción |
|--------|-------------|
| `sanitizeInput(input)` | Limpiar entrada de texto |
| `sanitizeEmail(email)` | Validar/limpiar email |
| `validatePassword(password)` | Validar fortaleza |

**Utilidades:**

| Método | Descripción |
|--------|-------------|
| `generateSecureId()` | Generar UUID seguro |
| `hashData(data)` | Hash SHA-256 |
| `clearSensitiveData()` | Limpiar datos sensibles |

---

## 6. Páginas y Componentes

### 6.1 LoginPage

**Ruta:** `/login`

**Funcionalidad:**
- Formulario de inicio de sesión
- Validación de email y contraseña
- Redirección automática si ya autenticado
- Enlace a registro

### 6.2 RegisterPage

**Ruta:** `/register`

**Funcionalidad:**
- Formulario de registro
- Validación de campos
- Confirmación de contraseña

### 6.3 TabsPage

**Ruta:** `/tabs`

**Funcionalidad:**
- Hub central de navegación
- Pestañas: Proyectos, Cámara, Catastro, Ajustes

### 6.4 ProjectsPage

**Ruta:** `/tabs/projects`

**Funcionalidad:**
- Listado de proyectos
- Búsqueda en tiempo real
- Crear nuevo proyecto
- Eliminar proyectos
- Pull-to-refresh

### 6.5 ProjectDetailPage

**Ruta:** `/project-detail/:id`

**Funcionalidad:**
- Vista completa del proyecto
- Galería de fotos
- Visor de informes guardados
- Visor de archivos KML con mapa
- Análisis de fotos con IA
- Eliminar elementos

### 6.6 ProjectEditorPage

**Ruta:** `/project-editor/:id`

**Funcionalidad:**
- Mapa interactivo (Leaflet)
- Dibujar zonas (polígonos)
- Trazar viales (líneas)
- Añadir puntos de interés
- Capturar fotos para puntos
- Análisis IA de marcadores
- Generar informes PDD
- Exportar a KML
- Visor de fotos con notas y análisis

**Herramientas de dibujo:**
- Modo zona: Click para añadir vértices
- Modo vial: Click para añadir puntos
- Modo marcador: Click para colocar punto

### 6.7 CameraPage

**Ruta:** `/tabs/camera`

**Funcionalidad:**
- Capturar foto con cámara
- Importar desde galería
- Lectura automática de EXIF GPS
- Geocoding inverso
- Análisis con IA
- Añadir notas
- Guardar en proyecto

### 6.8 CatastroPage

**Ruta:** `/tabs/catastro`

**Funcionalidad:**
- Mapa 2D (Leaflet) y 3D (Cesium)
- Capas: Satélite, Calles, Catastro WMS
- Búsqueda de direcciones
- Consulta catastral por click
- Herramientas de medición
- Importar archivos KML/KMZ

### 6.9 MedicionesPage

**Ruta:** `/mediciones`

**Funcionalidad:**
- Listado de mediciones guardadas
- Mostrar distancias y áreas
- Eliminar mediciones

### 6.10 SettingsPage

**Ruta:** `/tabs/settings`

**Funcionalidad:**
- Información del usuario
- Cerrar sesión
- Sincronización manual

---

## 7. Sistema de Almacenamiento

### 7.1 IndexedDB

**Base de datos:** `geotech_db`
**Versión:** 2

**Stores:**

| Store | Clave | Contenido |
|-------|-------|-----------|
| `photos` | `id` | Fotos con imágenes base64 |
| `projects` | `id` | Proyectos completos |

**Ventajas:**
- Capacidad: 50MB+ (según dispositivo)
- Acceso asíncrono no bloqueante
- Soporte para datos binarios (imágenes)
- Persistencia entre sesiones

### 7.2 Capacitor Preferences

**Claves utilizadas:**

| Clave | Contenido |
|-------|-----------|
| `sync_queue` | Cola de sincronización (JSON) |
| `measurements` | Mediciones guardadas (JSON) |
| `token` | JWT de autenticación |
| `refreshToken` | Token de refresco |
| `user` | Datos del usuario (JSON) |

**Límite:** ~5MB total

### 7.3 Migración de Datos

El sistema incluye migración automática de datos antiguos:
- Detecta datos en localStorage
- Migra a IndexedDB automáticamente
- Limpia localStorage después de migrar

---

## 8. Funcionalidades Principales

### 8.1 Gestión de Proyectos

```
Crear Proyecto
     │
     ▼
Añadir Elementos (Zonas, Viales, Puntos)
     │
     ▼
Capturar Fotos Georreferenciadas
     │
     ▼
Analizar con IA
     │
     ▼
Generar Informe PDD / Exportar KML
```

### 8.2 Captura de Fotos

**Flujo:**
1. Usuario abre cámara o selecciona de galería
2. Sistema obtiene coordenadas GPS (EXIF o GPS actual)
3. Geocoding inverso para obtener dirección
4. Opcionalmente: análisis con IA
5. Usuario añade notas
6. Foto se guarda en IndexedDB

**Compresión:**
- Tamaño máximo: 800px (lado mayor)
- Calidad JPEG: 60%
- Formato: Base64

### 8.3 Análisis con IA

**Proceso:**
1. Imagen se envía al backend
2. Backend llama a Claude API
3. IA analiza la imagen
4. Retorna descripción técnica
5. Se guarda en la foto/marcador

**Tipos de análisis:**
- Características del terreno
- Estado de estructuras
- Elementos hidrológicos
- Accesibilidad
- Impacto ambiental

### 8.4 Generación de Informes

**Informe PDD (Word/HTML):**
- Portada profesional
- Índice de contenidos
- Resumen ejecutivo (IA)
- Secciones por tipo de elemento
- Fotos con coordenadas y análisis
- Formato empresarial

### 8.5 Exportación KML

**Contenido del KML:**
- Metadatos del proyecto
- Carpeta de fotos (con imágenes)
- Carpeta de zonas (polígonos)
- Carpeta de viales (líneas)
- Carpeta de puntos de interés
- Descripciones HTML con fotos, notas y análisis IA

**Visualización:**
- Compatible con Google Earth
- Visor integrado en la app
- Popup con tema oscuro al hacer click

### 8.6 Consulta Catastral

**Datos obtenidos:**
- Referencia catastral completa
- Dirección de la parcela
- Superficie registrada
- Uso del suelo
- Clasificación (urbano/rústico)
- Municipio y provincia

### 8.7 Mediciones

**Distancia:**
- Click en dos o más puntos
- Cálculo con fórmula Haversine
- Resultado en metros/kilómetros

**Área:**
- Click para definir vértices
- Cálculo de polígono
- Resultado en m²/hectáreas

---

## 9. Integraciones Externas

### 9.1 API del Catastro Español

**URL:** `https://ovc.catastro.meh.es/ovcservweb/`

**Servicios utilizados:**
- OVCCoordenadas: Búsqueda por coordenadas
- OVCCallejero: Búsqueda por referencia

**Formato:** XML (parseado a JSON)

### 9.2 OpenStreetMap Nominatim

**URL:** `https://nominatim.openstreetmap.org/`

**Usos:**
- Geocoding (dirección → coordenadas)
- Reverse geocoding (coordenadas → dirección)
- Búsqueda de direcciones

### 9.3 ArcGIS Online

**URL:** `https://services.arcgisonline.com/`

**Uso:** Capa de mapa satélite

### 9.4 Claude AI (Anthropic)

**Vía:** Backend propio

**Uso:** Análisis de imágenes y generación de descripciones

### 9.5 Cesium Ion

**URL:** `https://cesium.com/`

**Uso:** Visualización 3D del terreno

---

## 10. Seguridad

### 10.1 Autenticación

- JWT (JSON Web Token) para sesiones
- Token de refresco para renovación automática
- Almacenamiento seguro en Capacitor Preferences
- Timeout de sesión configurable

### 10.2 Comunicaciones

- HTTPS obligatorio en producción
- Validación de dominios permitidos
- Timeout de requests (30 segundos)
- Interceptor de seguridad en todas las peticiones

### 10.3 Dominios Permitidos

```typescript
const ALLOWED_DOMAINS = [
  'localhost',
  'railway.app',
  'nominatim.openstreetmap.org',
  'ovc.catastro.meh.es',
  'services.arcgisonline.com',
  'api.anthropic.com',
  'cesium.com',
  'unpkg.com'
];
```

### 10.4 Sanitización

- Inputs de texto sanitizados
- Emails validados con regex
- Contraseñas con requisitos mínimos
- Prevención de XSS en contenido HTML

### 10.5 Verificaciones de Seguridad

Al iniciar la app se verifican:
- Root/Jailbreak del dispositivo
- Depurador conectado
- Ejecución en emulador
- Integridad de la aplicación

---

## 11. Configuración de Entornos

### 11.1 Desarrollo

```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: 'https://geotech-production.up.railway.app/api',
  enableLogging: true,
  enableDevTools: true,
  sessionTimeout: 24 * 60 * 60 * 1000,  // 24 horas
  maxLoginAttempts: 999,
  lockoutDuration: 0
};
```

### 11.2 Producción

```typescript
// environment.prod.ts
export const environment = {
  production: true,
  apiUrl: '/api',
  enableLogging: false,
  enableDevTools: false,
  sessionTimeout: 30 * 60 * 1000,       // 30 minutos
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000       // 15 minutos bloqueo
};
```

---

## 12. Dependencias

### 12.1 Dependencias Principales

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| @angular/core | 20.0.0 | Framework principal |
| @ionic/angular | 8.0.0 | UI Components |
| @capacitor/core | 8.0.0 | APIs nativas |
| rxjs | 7.8.0 | Programación reactiva |
| leaflet | 1.9.4 | Mapas 2D |
| cesium | 1.136.0 | Visualización 3D |
| docx | 9.5.1 | Generación Word |
| jszip | 3.10.1 | Compresión KMZ |
| exifr | 7.1.3 | Lectura EXIF |
| file-saver | 2.0.5 | Descarga archivos |

### 12.2 Plugins de Capacitor

| Plugin | Propósito |
|--------|-----------|
| @capacitor/camera | Acceso a cámara |
| @capacitor/geolocation | GPS |
| @capacitor/filesystem | Sistema de archivos |
| @capacitor/preferences | Almacenamiento clave-valor |
| @capacitor/network | Estado de conexión |
| @capacitor/status-bar | Barra de estado |
| @capacitor/keyboard | Teclado virtual |
| @capacitor/haptics | Vibración |

---

## 13. Guía de Despliegue

### 13.1 Requisitos Previos

- Node.js 18+
- npm 9+
- Angular CLI 20
- Ionic CLI 7+
- Capacitor CLI 8

### 13.2 Instalación

```bash
# Clonar repositorio
git clone https://github.com/lambertbf98/GeoTech.git
cd GeoTech/frontend

# Instalar dependencias
npm install

# Ejecutar en desarrollo
ionic serve
```

### 13.3 Build para Producción

```bash
# Build web
ionic build --prod

# Sincronizar con Capacitor
npx cap sync

# Abrir proyecto iOS
npx cap open ios

# Abrir proyecto Android
npx cap open android
```

### 13.4 Variables de Entorno

Configurar en `src/environments/`:
- `apiUrl`: URL del backend
- `production`: true/false
- `sessionTimeout`: Tiempo de sesión en ms

### 13.5 Configuración del Backend

El backend debe estar desplegado y accesible en la URL configurada.

**Endpoints requeridos:**
- POST `/auth/login`
- POST `/auth/register`
- POST `/auth/refresh`
- GET/POST/PUT/DELETE `/projects/*`
- GET/POST/DELETE `/photos/*`
- POST `/claude/analyze`
- POST `/reports`
- POST `/kml`

---

## Historial de Cambios Recientes

| Fecha | Cambio |
|-------|--------|
| 29/12/2025 | Migración completa a IndexedDB v2 |
| 29/12/2025 | Fix cámara iOS Safari (user gesture) |
| 29/12/2025 | KML con fotos, notas y análisis IA |
| 29/12/2025 | Popup KML con tema oscuro |
| 29/12/2025 | Visor de fotos pantalla completa |
| 29/12/2025 | Iconos de marcador estilo Google Maps |
| 29/12/2025 | Formato nombre KML igual que informes |

---

**Documento generado automáticamente**
**GeoTech © 2025**
