# API Documentation - GeoTech

## Base URL

```
Development: http://localhost:3000/api
Production: https://api.geotech.example.com/api
```

## Autenticación

Todas las rutas (excepto `/auth/*`) requieren un token JWT en el header:

```
Authorization: Bearer <token>
```

---

## Endpoints

### Auth

#### POST /auth/register
Registrar nuevo usuario.

**Request:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123",
  "name": "Nombre Usuario"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario"
  },
  "token": "jwt_token",
  "refreshToken": "refresh_token"
}
```

#### POST /auth/login
Iniciar sesión.

**Request:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario"
  },
  "token": "jwt_token",
  "refreshToken": "refresh_token"
}
```

#### POST /auth/refresh
Renovar token de acceso.

**Request:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response (200):**
```json
{
  "token": "new_jwt_token",
  "refreshToken": "new_refresh_token"
}
```

---

### Projects

#### GET /projects
Obtener todos los proyectos del usuario.

**Response (200):**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Proyecto 1",
      "description": "Descripción del proyecto",
      "photoCount": 5,
      "createdAt": "2024-12-25T10:00:00Z",
      "updatedAt": "2024-12-25T12:00:00Z"
    }
  ]
}
```

#### GET /projects/:id
Obtener un proyecto con sus fotos.

**Response (200):**
```json
{
  "project": {
    "id": "uuid",
    "name": "Proyecto 1",
    "description": "Descripción del proyecto",
    "photos": [...],
    "createdAt": "2024-12-25T10:00:00Z",
    "updatedAt": "2024-12-25T12:00:00Z"
  }
}
```

#### POST /projects
Crear nuevo proyecto.

**Request:**
```json
{
  "name": "Nuevo Proyecto",
  "description": "Descripción opcional"
}
```

**Response (201):**
```json
{
  "project": {
    "id": "uuid",
    "name": "Nuevo Proyecto",
    "description": "Descripción opcional",
    "createdAt": "2024-12-25T10:00:00Z"
  }
}
```

#### PUT /projects/:id
Actualizar proyecto.

**Request:**
```json
{
  "name": "Nombre Actualizado",
  "description": "Nueva descripción"
}
```

**Response (200):**
```json
{
  "project": {
    "id": "uuid",
    "name": "Nombre Actualizado",
    "description": "Nueva descripción",
    "updatedAt": "2024-12-25T14:00:00Z"
  }
}
```

#### DELETE /projects/:id
Eliminar proyecto y todas sus fotos.

**Response (204):** No content

---

### Photos

#### GET /photos/:id
Obtener detalle de una foto.

**Response (200):**
```json
{
  "photo": {
    "id": "uuid",
    "projectId": "uuid",
    "imageUrl": "https://storage.example.com/photos/uuid.jpg",
    "thumbnailUrl": "https://storage.example.com/thumbs/uuid.jpg",
    "latitude": 40.416775,
    "longitude": -3.703790,
    "altitude": 650.5,
    "accuracy": 5.2,
    "catastroRef": "1234567AB1234S0001AB",
    "catastroData": {
      "referenciaCatastral": "1234567AB1234S0001AB",
      "direccion": "Calle Ejemplo 123",
      "superficie": 150,
      "uso": "Residencial",
      "clase": "Urbano"
    },
    "aiDescription": "Edificio de viviendas de 4 plantas...",
    "notes": "Notas del usuario",
    "createdAt": "2024-12-25T10:30:00Z"
  }
}
```

#### POST /photos
Subir nueva foto.

**Request (multipart/form-data):**
```
file: <image_file>
projectId: "uuid"
latitude: 40.416775
longitude: -3.703790
altitude: 650.5
accuracy: 5.2
notes: "Notas opcionales"
```

**Response (201):**
```json
{
  "photo": {
    "id": "uuid",
    "projectId": "uuid",
    "imageUrl": "https://storage.example.com/photos/uuid.jpg",
    "thumbnailUrl": "https://storage.example.com/thumbs/uuid.jpg",
    "latitude": 40.416775,
    "longitude": -3.703790,
    "createdAt": "2024-12-25T10:30:00Z"
  }
}
```

#### PUT /photos/:id
Actualizar foto (notas).

**Request:**
```json
{
  "notes": "Nuevas notas"
}
```

**Response (200):**
```json
{
  "photo": {
    "id": "uuid",
    "notes": "Nuevas notas",
    "updatedAt": "2024-12-25T14:00:00Z"
  }
}
```

#### DELETE /photos/:id
Eliminar foto.

**Response (204):** No content

---

### Catastro

#### GET /catastro/lookup
Consultar datos catastrales por coordenadas.

**Query params:**
- `lat`: Latitud (requerido)
- `lon`: Longitud (requerido)

**Response (200):**
```json
{
  "catastro": {
    "referenciaCatastral": "1234567AB1234S0001AB",
    "direccion": "Calle Ejemplo 123, Madrid",
    "superficie": 150,
    "uso": "Residencial",
    "clase": "Urbano",
    "municipio": "Madrid",
    "provincia": "Madrid"
  }
}
```

#### POST /catastro/assign
Asignar datos catastrales a una foto.

**Request:**
```json
{
  "photoId": "uuid"
}
```

**Response (200):**
```json
{
  "photo": {
    "id": "uuid",
    "catastroRef": "1234567AB1234S0001AB",
    "catastroData": {...}
  }
}
```

---

### Hydrology

#### GET /hydrology/rivers
Obtener ríos cercanos a una ubicación.

**Query params:**
- `lat`: Latitud (requerido)
- `lon`: Longitud (requerido)
- `radius`: Radio en metros (opcional, default 1000)

**Response (200):**
```json
{
  "rivers": [
    {
      "name": "Río Manzanares",
      "distance": 250,
      "cuenca": "Tajo"
    }
  ]
}
```

---

### Claude (IA)

#### POST /claude/describe
Generar descripción de una imagen con IA.

**Request:**
```json
{
  "photoId": "uuid"
}
```

**Response (200):**
```json
{
  "description": "La imagen muestra un edificio de viviendas de aproximadamente 4 plantas de altura, con fachada de ladrillo visto. Se observa vegetación en el entorno y una acera peatonal. El estado de conservación parece bueno.",
  "photo": {
    "id": "uuid",
    "aiDescription": "..."
  }
}
```

---

### Export

#### POST /export/pdf
Generar informe PDF de un proyecto.

**Request:**
```json
{
  "projectId": "uuid",
  "options": {
    "includeMap": true,
    "includeCatastro": true,
    "includeAiDescriptions": true
  }
}
```

**Response (200):**
```json
{
  "downloadUrl": "https://storage.example.com/exports/uuid.pdf",
  "expiresAt": "2024-12-26T10:00:00Z"
}
```

#### POST /export/excel
Generar exportación Excel de un proyecto.

**Request:**
```json
{
  "projectId": "uuid"
}
```

**Response (200):**
```json
{
  "downloadUrl": "https://storage.example.com/exports/uuid.xlsx",
  "expiresAt": "2024-12-26T10:00:00Z"
}
```

---

### Sync

#### POST /sync/batch
Sincronizar cambios offline.

**Request:**
```json
{
  "items": [
    {
      "id": "local_uuid",
      "action": "CREATE",
      "entity": "photo",
      "data": {...},
      "timestamp": "2024-12-25T08:00:00Z"
    },
    {
      "id": "local_uuid_2",
      "action": "UPDATE",
      "entity": "project",
      "data": {...},
      "timestamp": "2024-12-25T09:00:00Z"
    }
  ]
}
```

**Response (200):**
```json
{
  "results": [
    {
      "localId": "local_uuid",
      "serverId": "server_uuid",
      "status": "success"
    },
    {
      "localId": "local_uuid_2",
      "serverId": "server_uuid_2",
      "status": "conflict",
      "serverVersion": {...}
    }
  ]
}
```

---

## Códigos de Error

| Código | Significado |
|--------|-------------|
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - Token inválido o expirado |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no encontrado |
| 409 | Conflict - Conflicto de sincronización |
| 500 | Internal Server Error - Error del servidor |

**Formato de error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El campo email es requerido",
    "details": {...}
  }
}
```
