# GeoTech

Aplicacion movil profesional para ingenieria civil que permite documentar trabajos de campo con fotografias geolocalizadas, integracion con el Catastro espanol, visor de mapas 2D/3D y descripciones automaticas mediante IA.

## Indice

1. [Caracteristicas](#caracteristicas)
2. [Tecnologias](#tecnologias)
3. [Requisitos](#requisitos)
4. [Instalacion](#instalacion)
5. [Estructura del Proyecto](#estructura-del-proyecto)
6. [Funcionalidades](#funcionalidades)
7. [Despliegue](#despliegue)
8. [Uso de la Aplicacion](#uso-de-la-aplicacion)

---

## Caracteristicas

### Gestion de Proyectos
- Crear, editar y eliminar proyectos
- Ubicacion automatica al crear proyecto (GPS + geocoding)
- Fecha y hora exacta de creacion
- Almacenamiento local persistente

### Captura de Fotos Geolocalizadas
- Captura desde camara o importacion desde galeria
- Coordenadas GPS automaticas (EXIF o dispositivo)
- Ubicacion (direccion) mediante reverse geocoding
- Fecha y hora con precision de segundos
- Almacenamiento en base64 para persistencia

### GeoVisor Integrado
- **Modo Mapa**: Vista de calles con OpenStreetMap
- **Modo Satelite**: Imagenes aereas de ArcGIS
- **Modo 3D Earth**: Vista 3D con Cesium (sin necesidad de API key)
- **Capa Catastro**: Superposicion WMS del Catastro espanol
- Zoom maximo extendido (hasta nivel 22)

### Herramientas de Medicion
- Medicion de distancias (en metros)
- Medicion de areas (en metros cuadrados)
- Funcionan en todos los modos (mapa, satelite, 3D)
- Guardado automatico de mediciones
- Historial de mediciones con ubicacion

### Consulta Catastral
- Busqueda por coordenadas GPS
- Datos de parcela (referencia, direccion, superficie, uso)
- Visualizacion en mapa con capa WMS

### Descripcion con IA
- Analisis automatico de imagenes con Claude API
- Descripcion tecnica del contenido fotografiado
- Guardado junto a la foto

### Perfil de Usuario
- Foto de perfil personalizable
- Edicion de nombre y correo
- Cambio de contrasena
- Datos guardados localmente

### Modo Offline
- Funciona completamente sin conexion
- Almacenamiento local con Capacitor Preferences
- Sincronizacion cuando hay red disponible

---

## Tecnologias

### Frontend
| Tecnologia | Version | Descripcion |
|------------|---------|-------------|
| Ionic | 8.x | Framework UI para apps hibridas |
| Angular | 19.x | Framework de desarrollo |
| Capacitor | 6.x | Runtime nativo iOS/Android |
| TypeScript | 5.x | Lenguaje tipado |
| Leaflet | 1.9.x | Mapas interactivos 2D |
| Cesium | 1.113 | Globo 3D |

### Backend
| Tecnologia | Version | Descripcion |
|------------|---------|-------------|
| Node.js | 20.x | Runtime JavaScript |
| Express | 4.x | Framework web |
| TypeScript | 5.x | Lenguaje tipado |

### APIs Externas
| Servicio | Uso |
|----------|-----|
| Catastro OVC | Datos catastrales de Espana |
| Nominatim (OSM) | Geocoding y busqueda de direcciones |
| ArcGIS | Imagenes satelite (gratuito) |
| Claude API | Analisis de imagenes con IA |

### Infraestructura
| Servicio | Uso |
|----------|-----|
| Railway | Hosting del frontend (PWA) |
| GitHub | Control de versiones |

---

## Requisitos

### Desarrollo
- Node.js 20 o superior
- npm 10 o superior
- Git

### Compilacion Movil
- Android Studio (para Android)
- Xcode 15+ (para iOS, requiere macOS)

---

## Instalacion

### 1. Clonar el repositorio

```bash
git clone https://github.com/lambertbf98/GeoTech.git
cd GeoTech
```

### 2. Instalar dependencias del Frontend

```bash
cd frontend
npm install
```

### 3. Configurar variables de entorno

Crear archivo `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  claudeApiKey: 'tu_api_key_de_anthropic'
};
```

### 4. Ejecutar en desarrollo

```bash
# Modo web (navegador)
ionic serve

# Modo Android
ionic cap run android

# Modo iOS (solo macOS)
ionic cap run ios
```

### 5. Instalar dependencias del Backend

```bash
cd backend
npm install
```

### 6. Configurar backend

Crear archivo `.env`:

```bash
PORT=3000
NODE_ENV=development
JWT_SECRET=tu_secreto_jwt_seguro
CLAUDE_API_KEY=tu_api_key_de_anthropic
```

### 7. Ejecutar backend

```bash
npm run dev
```

---

## Estructura del Proyecto

```
GeoTech/
├── frontend/                    # Aplicacion Ionic + Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── models/         # Interfaces TypeScript
│   │   │   │   ├── project.model.ts
│   │   │   │   ├── photo.model.ts
│   │   │   │   ├── measurement.model.ts
│   │   │   │   └── catastro.model.ts
│   │   │   │
│   │   │   ├── pages/          # Paginas de la aplicacion
│   │   │   │   ├── login/      # Inicio de sesion
│   │   │   │   ├── register/   # Registro de usuario
│   │   │   │   ├── projects/   # Lista de proyectos
│   │   │   │   ├── project-detail/ # Detalle y fotos
│   │   │   │   ├── camera/     # Captura de fotos
│   │   │   │   ├── catastro/   # GeoVisor (mapas/3D)
│   │   │   │   ├── mediciones/ # Historial mediciones
│   │   │   │   └── settings/   # Ajustes y perfil
│   │   │   │
│   │   │   ├── services/       # Servicios
│   │   │   │   ├── api.service.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── camera.service.ts
│   │   │   │   ├── gps.service.ts
│   │   │   │   ├── storage.service.ts
│   │   │   │   ├── sync.service.ts
│   │   │   │   ├── catastro.service.ts
│   │   │   │   └── claude.service.ts
│   │   │   │
│   │   │   ├── guards/         # Guards de navegacion
│   │   │   └── tabs/           # Navegacion por pestanas
│   │   │
│   │   ├── assets/             # Recursos estaticos
│   │   │   └── icon/           # Iconos de la app
│   │   │
│   │   ├── theme/              # Estilos globales
│   │   │   └── variables.scss  # Variables CSS
│   │   │
│   │   └── index.html          # HTML principal (PWA)
│   │
│   ├── android/                # Proyecto Android nativo
│   ├── ios/                    # Proyecto iOS nativo
│   ├── capacitor.config.ts     # Configuracion Capacitor
│   ├── Dockerfile              # Contenedor para Railway
│   └── package.json
│
├── backend/                    # API Node.js + Express
│   ├── src/
│   │   ├── index.ts           # Punto de entrada
│   │   ├── routes/            # Rutas de la API
│   │   ├── controllers/       # Controladores
│   │   ├── services/          # Logica de negocio
│   │   └── middleware/        # Middleware (auth, etc)
│   │
│   ├── Dockerfile             # Contenedor Docker
│   └── package.json
│
├── docs/                       # Documentacion
│   ├── API.md                 # Documentacion de la API
│   ├── ARCHITECTURE.md        # Arquitectura del sistema
│   └── DEPLOYMENT.md          # Guia de despliegue
│
└── README.md                   # Este archivo
```

---

## Funcionalidades

### 1. Autenticacion

#### Registro de Usuario
1. Abrir la aplicacion
2. Pulsar "Crear una cuenta nueva"
3. Introducir nombre, email y contrasena
4. Pulsar "Crear cuenta"

#### Inicio de Sesion
1. Introducir email y contrasena
2. Pulsar "Iniciar Sesion"
3. Se redirige a la lista de proyectos

#### Recuperar Contrasena
1. Pulsar "Olvidaste tu contrasena?"
2. Introducir email
3. Se enviaran instrucciones (requiere backend configurado)

### 2. Gestion de Proyectos

#### Crear Proyecto
1. Ir a la pestana "Proyectos"
2. Pulsar el boton "+" (esquina superior o FAB)
3. Introducir nombre del proyecto
4. La ubicacion se detecta automaticamente
5. Pulsar "Crear"

#### Ver Proyecto
1. Pulsar sobre un proyecto de la lista
2. Se muestra: nombre, ubicacion, fecha/hora, fotos

#### Eliminar Proyecto
1. Pulsar los tres puntos del proyecto
2. Seleccionar "Eliminar"

### 3. Captura de Fotos

#### Tomar Foto con Camara
1. Ir a la pestana "Registro"
2. Seleccionar un proyecto
3. Pulsar "Camara"
4. Tomar la foto
5. Se guarda automaticamente con GPS y ubicacion

#### Importar desde Galeria
1. Ir a la pestana "Registro"
2. Seleccionar un proyecto
3. Pulsar "Galeria"
4. Seleccionar imagen
5. Se extraen coordenadas EXIF o se usa GPS actual

#### Ver Foto en Proyecto
1. Ir al detalle del proyecto
2. Pulsar sobre una foto
3. Se muestra: imagen, ubicacion, coordenadas, fecha/hora
4. Si tiene descripcion IA o notas, tambien se muestran

#### Eliminar Foto
1. Abrir la foto en el visor
2. Pulsar "Eliminar foto"
3. Confirmar eliminacion

### 4. GeoVisor

#### Navegacion por el Mapa
1. Ir a la pestana "GeoVisor"
2. El mapa se centra en Espana por defecto
3. Pulsar en cualquier punto para seleccionarlo
4. Se muestran las coordenadas

#### Cambiar Tipo de Mapa
- **Satelite**: Pulsar icono de satelite
- **Mapa**: Pulsar icono de mapa
- **Catastro**: Pulsar icono de capa para activar/desactivar

#### Vista 3D (Earth)
1. Pulsar icono de globo terraqueo
2. Se carga Cesium con vista 3D
3. Navegar con gestos (rotar, zoom, inclinar)
4. Pulsar "Volver" para regresar al mapa 2D

#### Localizar Posicion Actual
1. Pulsar icono de ubicacion (punto de mira)
2. El mapa se centra en tu posicion

#### Buscar Direccion
1. Pulsar icono de busqueda
2. Escribir direccion o coordenadas
3. Seleccionar resultado
4. El mapa se centra en esa ubicacion

#### Consultar Catastro
1. Seleccionar un punto en el mapa
2. Pulsar icono de catastro
3. Se muestran los datos de la parcela

### 5. Herramientas de Medicion

#### Medir Distancia
1. En el GeoVisor, pulsar icono de regla
2. Pulsar puntos en el mapa para crear linea
3. La distancia se muestra en metros
4. Pulsar de nuevo el icono para finalizar y guardar

#### Medir Area
1. Pulsar icono de poligono
2. Pulsar al menos 3 puntos para crear area
3. El area se muestra en metros cuadrados
4. Pulsar de nuevo el icono para finalizar y guardar

#### Ver Historial de Mediciones
1. Ir a la pestana "Mediciones"
2. Se listan todas las mediciones guardadas
3. Cada una muestra: tipo, valor, ubicacion, fecha

### 6. Descripcion con IA

#### Generar Descripcion
1. Despues de tomar/importar una foto
2. Pulsar icono de IA (chispa)
3. Claude analiza la imagen
4. La descripcion se guarda con la foto

#### Ver Descripcion
1. Abrir una foto en el proyecto
2. Si tiene descripcion IA, aparece en seccion morada

### 7. Ajustes y Perfil

#### Cambiar Foto de Perfil
1. Ir a la pestana "Ajustes"
2. Pulsar sobre el avatar
3. Seleccionar imagen de la galeria

#### Editar Nombre
1. Ir a "Ajustes" > "Perfil"
2. Pulsar "Nombre"
3. Modificar y guardar

#### Editar Email
1. Ir a "Ajustes" > "Perfil"
2. Pulsar "Correo electronico"
3. Modificar y guardar

#### Cambiar Contrasena
1. Ir a "Ajustes" > "Perfil"
2. Pulsar "Cambiar contrasena"
3. Introducir contrasena actual y nueva
4. Confirmar

#### Cerrar Sesion
1. Ir a "Ajustes"
2. Pulsar "Cerrar sesion"
3. Confirmar

---

## Despliegue

### Railway (Actual)

El frontend esta desplegado como PWA en Railway:

1. Push a la rama `main`
2. Railway detecta cambios automaticamente
3. Ejecuta el Dockerfile
4. Despliega en la URL asignada

Ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para mas detalles.

### Compilacion Movil

#### Android
```bash
cd frontend
ionic build --prod
ionic cap sync android
ionic cap open android
# Generar APK/AAB en Android Studio
```

#### iOS
```bash
cd frontend
ionic build --prod
ionic cap sync ios
ionic cap open ios
# Archivar y distribuir en Xcode
```

---

## Documentacion Adicional

- [API.md](docs/API.md) - Documentacion completa de la API REST
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Arquitectura del sistema
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Guia detallada de despliegue

---

## Licencia

Proyecto privado - Todos los derechos reservados.

---

## Autor

Desarrollado para uso profesional en ingenieria civil.

---

*Documentacion actualizada el 28/12/2024*
