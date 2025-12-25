# Arquitectura GeoTech

## Visión General

GeoTech sigue una arquitectura cliente-servidor con capacidades offline-first. El frontend es una aplicación híbrida construida con Ionic + Capacitor, mientras que el backend es una API REST en Node.js.

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Ionic + Angular                        │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │    │
│  │  │ Cámara  │ │   GPS   │ │ Storage │ │  Sync   │       │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │    │
│  │       │           │           │           │             │    │
│  │  ┌────┴───────────┴───────────┴───────────┴────┐       │    │
│  │  │              Capacitor Plugins               │       │    │
│  │  └──────────────────────┬──────────────────────┘       │    │
│  └─────────────────────────┼───────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────┼───────────────────────────────┐    │
│  │                    SQLite Local                          │    │
│  │  (Cola de sincronización, caché, datos offline)         │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SERVIDOR                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Node.js + Express                      │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │    │
│  │  │  Auth   │ │  Fotos  │ │Catastro │ │ Export  │       │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │    │
│  │       │           │           │           │             │    │
│  │  ┌────┴───────────┴───────────┴───────────┴────┐       │    │
│  │  │              Servicios Core                  │       │    │
│  │  └──────────────────────┬──────────────────────┘       │    │
│  └─────────────────────────┼───────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────┼───────────────────────────────┐    │
│  │                    PostgreSQL                            │    │
│  │  (Usuarios, Proyectos, Fotos, Metadatos)                │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Catastro │  │ IGN/     │  │ Claude   │
        │   API    │  │ MITECO   │  │   API    │
        └──────────┘  └──────────┘  └──────────┘
```

## Componentes del Frontend

### 1. Páginas (Pages)

| Página | Descripción |
|--------|-------------|
| `LoginPage` | Autenticación de usuarios |
| `HomePage` | Dashboard con proyectos recientes |
| `ProjectListPage` | Lista de proyectos |
| `ProjectDetailPage` | Detalle de un proyecto |
| `CameraPage` | Captura de fotos |
| `PhotoDetailPage` | Detalle de una foto |
| `MapPage` | Visualización en mapa |
| `ExportPage` | Opciones de exportación |
| `SettingsPage` | Configuración de la app |

### 2. Servicios (Services)

| Servicio | Responsabilidad |
|----------|-----------------|
| `AuthService` | Gestión de autenticación y tokens |
| `ApiService` | Comunicación con el backend |
| `CameraService` | Captura de fotos con Capacitor |
| `GpsService` | Obtención de coordenadas GPS |
| `StorageService` | Almacenamiento local SQLite |
| `SyncService` | Sincronización offline/online |
| `CatastroService` | Consultas al Catastro |
| `ClaudeService` | Descripciones con IA |
| `ExportService` | Generación de PDF/Excel |

### 3. Modelos (Models)

```typescript
// Proyecto
interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  photos: Photo[];
}

// Foto
interface Photo {
  id: string;
  projectId: string;
  imagePath: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  catastroRef?: string;
  catastroData?: CatastroData;
  aiDescription?: string;
  notes?: string;
  createdAt: Date;
  synced: boolean;
}

// Datos del Catastro
interface CatastroData {
  referenciaCatastral: string;
  direccion: string;
  superficie: number;
  uso: string;
  clase: string;
}

// Cola de sincronización
interface SyncQueueItem {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'project' | 'photo';
  data: any;
  createdAt: Date;
  attempts: number;
}
```

## Componentes del Backend

### 1. Controladores (Controllers)

| Controlador | Endpoints |
|-------------|-----------|
| `AuthController` | POST /auth/login, POST /auth/register, POST /auth/refresh |
| `ProjectController` | CRUD /projects |
| `PhotoController` | CRUD /photos, POST /photos/upload |
| `CatastroController` | GET /catastro/lookup |
| `HydrologyController` | GET /hydrology/rivers |
| `ClaudeController` | POST /claude/describe |
| `ExportController` | POST /export/pdf, POST /export/excel |
| `SyncController` | POST /sync/batch |

### 2. Estructura de Base de Datos

```sql
-- Usuarios
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Proyectos
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Fotos
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  altitude DECIMAL(10, 2),
  accuracy DECIMAL(10, 2),
  catastro_ref VARCHAR(50),
  catastro_data JSONB,
  ai_description TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_photos_project ON photos(project_id);
CREATE INDEX idx_photos_location ON photos(latitude, longitude);
CREATE INDEX idx_projects_user ON projects(user_id);
```

## Flujo de Datos

### 1. Captura de Foto (Offline)

```
1. Usuario abre cámara
2. CameraService captura imagen
3. GpsService obtiene coordenadas
4. StorageService guarda localmente
5. SyncService añade a cola
6. (Cuando hay conexión) SyncService envía al servidor
```

### 2. Consulta Catastro

```
1. Usuario solicita datos catastrales
2. Frontend envía coordenadas al backend
3. Backend consulta API Catastro
4. Backend procesa y almacena respuesta
5. Backend devuelve datos al frontend
6. Frontend muestra información
```

### 3. Descripción IA

```
1. Usuario solicita descripción
2. Frontend envía imagen al backend
3. Backend convierte imagen a base64
4. Backend envía a Claude API (modelo Haiku)
5. Claude devuelve descripción
6. Backend almacena y devuelve descripción
7. Frontend muestra resultado
```

## Sistema Offline

### Cola de Sincronización

1. **Detección de conexión**: El servicio de red monitorea el estado de conexión
2. **Almacenamiento local**: Todas las operaciones se guardan en SQLite
3. **Cola de pendientes**: Las operaciones sin sincronizar se encolan
4. **Sincronización automática**: Cuando hay conexión, se procesan la cola
5. **Resolución de conflictos**: El servidor tiene la versión autoritativa

### Estrategia de Caché

- **Imágenes**: Comprimidas y almacenadas localmente
- **Datos de Catastro**: Cacheados por coordenadas
- **Proyectos**: Sincronización completa al inicio

## Seguridad

### Autenticación
- JWT con refresh tokens
- Tokens almacenados de forma segura (Keychain/Keystore)
- Expiración configurable

### Autorización
- Cada usuario solo ve sus proyectos
- Validación de permisos en cada endpoint

### Datos
- HTTPS obligatorio
- Encriptación de datos sensibles
- API keys en variables de entorno

## APIs Externas

### Catastro (OVC)
- **URL Base**: https://ovc.catastro.meh.es/ovcservweb/
- **Servicios**: INSPIRE, WFS, consulta puntual
- **Autenticación**: No requiere (API pública)
- **Límites**: Sin límite documentado

### IGN/MITECO (Hidrología)
- **URL Base**: Varios servicios WMS/WFS
- **Servicios**: Ríos, cuencas, datos hidrológicos
- **Autenticación**: No requiere
- **Límites**: Sin límite documentado

### Claude API
- **Modelo**: claude-3-haiku (más económico)
- **Uso**: Descripción de imágenes
- **Coste**: ~$0.00025 por imagen
- **Límites**: Según plan contratado
