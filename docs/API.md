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

---

## Licencias

### GET /licenses/status
Obtener estado de licencia del usuario autenticado.

**Response (200):**
```json
{
  "hasValidLicense": true,
  "license": {
    "id": "uuid",
    "licenseKey": "XXXX-XXXX-XXXX-XXXX",
    "type": "Mensual",
    "status": "active",
    "expiresAt": "2025-01-30T10:00:00Z",
    "daysRemaining": 30,
    "hoursRemaining": 720,
    "minutesRemaining": 43200
  }
}
```

### POST /licenses/activate
Activar una licencia con clave.

**Request:**
```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Licencia activada correctamente",
  "license": {
    "id": "uuid",
    "type": "Mensual",
    "expiresAt": "2025-01-30T10:00:00Z"
  }
}
```

**Errores posibles:**
- `Clave de licencia no válida` - La clave no existe
- `Esta licencia ya fue utilizada` - Licencia de un solo uso ya activada
- `Esta licencia ya fue utilizada por otro usuario` - Otra cuenta la activó
- `Esta licencia ha sido revocada` - Admin la revocó
- `Esta licencia ha expirado` - Fecha de expiración pasada

### GET /licenses/types
Obtener tipos de licencia disponibles (público).

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Mensual",
    "code": "monthly",
    "durationDays": 30,
    "durationHours": 0,
    "price": 9.99,
    "promoPrice": null,
    "promoEndsAt": null,
    "description": "Acceso completo por 30 días",
    "isActive": true
  },
  {
    "id": "uuid",
    "name": "Prueba 2 horas",
    "code": "trial_2h",
    "durationDays": 0,
    "durationHours": 2,
    "price": 0.99,
    "description": "Licencia de prueba",
    "isActive": true
  }
]
```

---

## Informes (Reports)

### GET /reports/project/:projectId
Obtener todos los informes de un proyecto.

**Response (200):**
```json
{
  "reports": [
    {
      "id": "uuid",
      "name": "Informe PDD - Proyecto A",
      "createdAt": "2024-12-25T10:00:00Z",
      "updatedAt": "2024-12-25T10:00:00Z"
    }
  ]
}
```

### GET /reports/:id
Obtener un informe específico con contenido (verifica propiedad).

**Response (200):**
```json
{
  "report": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Informe PDD - Proyecto A",
    "htmlContent": "<!DOCTYPE html>...",
    "fileUrl": null,
    "createdAt": "2024-12-25T10:00:00Z",
    "updatedAt": "2024-12-25T10:00:00Z"
  }
}
```

### POST /reports
Crear nuevo informe.

**Request:**
```json
{
  "projectId": "uuid",
  "name": "Informe PDD - Proyecto A",
  "htmlContent": "<!DOCTYPE html>..."
}
```

**Response (201):**
```json
{
  "report": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Informe PDD - Proyecto A",
    "htmlContent": "<!DOCTYPE html>...",
    "createdAt": "2024-12-25T10:00:00Z"
  }
}
```

### DELETE /reports/:id
Eliminar un informe.

**Response (204):** No content

---

## Archivos KML

### GET /reports/kml/project/:projectId
Obtener todos los KML de un proyecto.

**Response (200):**
```json
{
  "kmlFiles": [
    {
      "id": "uuid",
      "name": "Proyecto A - Mapa",
      "createdAt": "2024-12-25T10:00:00Z",
      "updatedAt": "2024-12-25T10:00:00Z"
    }
  ]
}
```

### GET /reports/kml/:id
Obtener un KML específico con contenido (verifica propiedad).

**Response (200):**
```json
{
  "kml": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Proyecto A - Mapa",
    "kmlContent": "<?xml version=\"1.0\"?>...",
    "fileUrl": null,
    "createdAt": "2024-12-25T10:00:00Z",
    "updatedAt": "2024-12-25T10:00:00Z"
  }
}
```

### POST /reports/kml
Crear nuevo archivo KML.

**Request:**
```json
{
  "projectId": "uuid",
  "name": "Proyecto A - Mapa",
  "kmlContent": "<?xml version=\"1.0\"?>..."
}
```

**Response (201):**
```json
{
  "kml": {
    "id": "uuid",
    "name": "Proyecto A - Mapa",
    "createdAt": "2024-12-25T10:00:00Z"
  }
}
```

### DELETE /reports/kml/:id
Eliminar un archivo KML.

**Response (204):** No content

---

## Admin - Licencias

> **Nota:** Todas las rutas de admin requieren token de usuario con `isAdmin: true`

### GET /licenses/admin/stats
Obtener estadísticas generales.

**Response (200):**
```json
{
  "totalUsers": 150,
  "totalLicenses": 200,
  "activeLicenses": 45,
  "expiredLicenses": 155,
  "totalProjects": 320,
  "totalRevenue": 1500.50
}
```

### GET /licenses/admin/users
Obtener todos los usuarios paginados.

**Query params:**
- `page`: Número de página (default: 1)
- `limit`: Resultados por página (default: 20)

**Response (200):**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "usuario@ejemplo.com",
      "name": "Nombre Usuario",
      "isAdmin": false,
      "createdAt": "2024-12-01T10:00:00Z",
      "hasActiveLicense": true,
      "licenses": [...],
      "_count": { "projects": 5 }
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

### GET /licenses/admin/user/:id
Obtener detalle de usuario con proyectos y licencias.

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario",
    "isAdmin": false,
    "createdAt": "2024-12-01T10:00:00Z",
    "licenses": [...],
    "projects": [
      {
        "id": "uuid",
        "name": "Proyecto A",
        "description": "...",
        "createdAt": "2024-12-10T10:00:00Z",
        "_count": { "photos": 15 }
      }
    ],
    "_count": { "projects": 5 }
  }
}
```

### GET /licenses/admin/all
Obtener todas las licencias paginadas.

**Query params:**
- `page`: Número de página (default: 1)
- `limit`: Resultados por página (default: 20)

**Response (200):**
```json
{
  "licenses": [
    {
      "id": "uuid",
      "licenseKey": "XXXX-XXXX-XXXX-XXXX",
      "status": "active",
      "expiresAt": "2025-01-30T10:00:00Z",
      "createdAt": "2024-12-30T10:00:00Z",
      "user": {
        "id": "uuid",
        "email": "usuario@ejemplo.com",
        "name": "Nombre"
      },
      "licenseType": {
        "id": "uuid",
        "name": "Mensual",
        "code": "monthly"
      }
    }
  ],
  "total": 200,
  "page": 1,
  "limit": 20,
  "totalPages": 10
}
```

### POST /licenses/admin/create
Crear nueva licencia manualmente.

**Request:**
```json
{
  "licenseTypeId": "uuid",
  "userId": "uuid"  // Opcional - si no se envía, queda pendiente de activar
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "status": "pending",  // o "active" si se asignó usuario
  "expiresAt": "2025-01-30T10:00:00Z",
  "licenseType": {...}
}
```

### POST /licenses/admin/revoke/:id
Revocar una licencia activa.

**Response (200):**
```json
{
  "success": true,
  "message": "Licencia revocada",
  "license": {
    "id": "uuid",
    "status": "revoked"
  }
}
```

### POST /licenses/admin/types
Crear nuevo tipo de licencia.

**Request:**
```json
{
  "name": "Mensual",
  "code": "monthly",
  "durationDays": 30,
  "durationHours": 0,
  "price": 9.99,
  "description": "Acceso completo por 30 días"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Mensual",
  "code": "monthly",
  "durationDays": 30,
  "durationHours": 0,
  "price": 9.99,
  "isActive": true
}
```

### PUT /licenses/admin/types/:id
Actualizar tipo de licencia existente.

**Request:**
```json
{
  "name": "Mensual Premium",
  "durationDays": 30,
  "durationHours": 0,
  "price": 14.99,
  "promoPrice": 9.99,
  "promoEndsAt": "2025-01-31T23:59:59Z",
  "description": "Acceso premium por 30 días",
  "isActive": true
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Mensual Premium",
  "price": 14.99,
  "promoPrice": 9.99,
  "promoEndsAt": "2025-01-31T23:59:59Z",
  "isActive": true
}
```

---

## Admin - Usuarios

### PUT /licenses/admin/user/:id
Actualizar datos de usuario.

**Request:**
```json
{
  "name": "Nuevo Nombre",
  "email": "nuevo@email.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "Nuevo Nombre",
    "email": "nuevo@email.com"
  }
}
```

### PUT /licenses/admin/user/:id/password
Cambiar contraseña de usuario.

**Request:**
```json
{
  "password": "nuevaContraseña123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Contraseña actualizada"
}
```

### PUT /licenses/admin/user/:id/admin
Cambiar rol de administrador.

**Request:**
```json
{
  "isAdmin": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Usuario es ahora admin"
}
```

### DELETE /licenses/admin/user/:id
Eliminar usuario y todos sus datos (cascade).

**Response (200):**
```json
{
  "success": true,
  "message": "Usuario eliminado"
}
```

---

## Admin - Proyectos

### GET /licenses/admin/project/:id
Obtener detalle de proyecto con fotos, informes y KMLs.

**Response (200):**
```json
{
  "project": {
    "id": "uuid",
    "name": "Proyecto A",
    "description": "...",
    "createdAt": "2024-12-10T10:00:00Z",
    "user": {
      "id": "uuid",
      "email": "usuario@ejemplo.com",
      "name": "Nombre"
    },
    "photos": [...],
    "reports": [...],
    "kmlFiles": [...]
  }
}
```

### DELETE /licenses/admin/project/:id
Eliminar proyecto y todos sus datos.

**Response (200):**
```json
{
  "success": true,
  "message": "Proyecto eliminado"
}
```

---

## Admin - Informes y KML (sin verificación de propiedad)

### GET /reports/admin/:id
Obtener informe sin verificar propiedad (solo admin).

**Response (200):**
```json
{
  "report": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Informe PDD",
    "htmlContent": "<!DOCTYPE html>...",
    "fileUrl": null,
    "createdAt": "2024-12-25T10:00:00Z",
    "updatedAt": "2024-12-25T10:00:00Z"
  }
}
```

### GET /reports/kml/admin/:id
Obtener KML sin verificar propiedad (solo admin).

**Response (200):**
```json
{
  "kml": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Mapa KML",
    "kmlContent": "<?xml version=\"1.0\"?>...",
    "fileUrl": null,
    "createdAt": "2024-12-25T10:00:00Z",
    "updatedAt": "2024-12-25T10:00:00Z"
  }
}
```

---

## Notas de Implementación

### Sesión Única
Al hacer login, se eliminan automáticamente todos los refresh tokens anteriores del usuario. Esto garantiza que solo puede haber una sesión activa por usuario.

**Archivo:** `backend/src/services/auth.service.ts` (líneas 111-115)

### Licencias de Un Solo Uso
Una licencia solo puede ser activada una vez. Si ya tiene un `userId` asignado, no permite reactivación por otro usuario.

**Archivo:** `backend/src/services/license.service.ts` (líneas 56-66)

### Tiempo de Licencia
El backend envía `daysRemaining`, `hoursRemaining` y `minutesRemaining`. El frontend muestra:
- Menos de 1 hora: "X minutos restantes"
- Menos de 24 horas: "X horas restantes"
- 24+ horas: "X días restantes"

**Archivos:**
- Backend: `backend/src/routes/license.routes.ts` (líneas 39-56)
- Frontend: `frontend/src/app/services/license.service.ts` (líneas 181-206)
