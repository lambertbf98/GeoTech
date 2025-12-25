# GeoTech

Aplicación móvil profesional para ingeniería civil que permite documentar trabajos de campo con fotografías geolocalizadas, integración con el Catastro español, datos hidrológicos y descripciones automáticas mediante IA.

## 📋 Características

- **Captura de Fotos Geolocalizadas**: Fotografías con coordenadas GPS automáticas
- **Integración Catastro**: Consulta de referencias catastrales y datos de parcelas
- **Datos Hidrológicos**: Información de ríos y cuencas hidrográficas (IGN/MITECO)
- **Descripción IA**: Análisis automático de imágenes con Claude API
- **Modo Offline**: Funciona sin conexión, sincroniza cuando hay red
- **Exportación**: Generación de informes en PDF y Excel
- **Multiplataforma**: iOS (App Store) y Android (Google Play)

## 🏗️ Arquitectura

```
geotech/
├── frontend/                 # Aplicación Ionic + Capacitor
│   ├── src/
│   │   ├── app/
│   │   │   ├── pages/       # Páginas de la aplicación
│   │   │   ├── components/  # Componentes reutilizables
│   │   │   ├── services/    # Servicios (API, GPS, Camera, etc.)
│   │   │   ├── models/      # Interfaces y tipos TypeScript
│   │   │   └── guards/      # Guards de navegación
│   │   ├── assets/          # Recursos estáticos
│   │   └── theme/           # Estilos globales
│   ├── android/             # Proyecto Android nativo
│   ├── ios/                 # Proyecto iOS nativo
│   └── capacitor.config.ts  # Configuración Capacitor
│
├── backend/                  # API Node.js + Express
│   ├── src/
│   │   ├── controllers/     # Controladores de rutas
│   │   ├── services/        # Lógica de negocio
│   │   ├── models/          # Modelos de base de datos
│   │   ├── middleware/      # Middleware (auth, validation)
│   │   ├── routes/          # Definición de rutas
│   │   ├── utils/           # Utilidades
│   │   └── config/          # Configuración
│   └── package.json
│
└── docs/                     # Documentación adicional
    ├── API.md               # Documentación de la API
    ├── DEPLOYMENT.md        # Guía de despliegue
    └── ARCHITECTURE.md      # Arquitectura detallada
```

## 🛠️ Stack Tecnológico

### Frontend
- **Ionic 7**: Framework UI para aplicaciones híbridas
- **Angular 17**: Framework de desarrollo
- **Capacitor 5**: Runtime nativo para iOS/Android
- **TypeScript**: Lenguaje tipado

### Backend
- **Node.js 20**: Runtime JavaScript
- **Express 4**: Framework web
- **PostgreSQL 16**: Base de datos relacional
- **Prisma**: ORM para base de datos

### APIs Externas
- **Catastro**: API pública del Catastro español
- **IGN/MITECO**: Datos hidrológicos de España
- **Claude API**: Análisis de imágenes con IA (modelo Haiku)

### Infraestructura
- **Railway**: Hosting inicial (desarrollo)
- **IONOS VPS**: Producción (cuando sea necesario)

## 📱 Funcionalidades Detalladas

### 1. Captura de Fotos
- Acceso a cámara nativa del dispositivo
- Captura automática de coordenadas GPS
- Almacenamiento local con compresión
- Cola de sincronización offline

### 2. Integración Catastro
- Búsqueda por coordenadas GPS
- Obtención de referencia catastral
- Datos de la parcela (superficie, uso, etc.)
- Visualización en mapa

### 3. Datos Hidrológicos
- Consulta de ríos cercanos
- Información de cuencas hidrográficas
- Datos de caudales (cuando disponibles)

### 4. Descripción IA
- Envío de imagen a Claude API
- Análisis automático del contenido
- Generación de descripción técnica
- Detección de elementos relevantes

### 5. Sistema Offline
- Base de datos local SQLite
- Cola de sincronización
- Detección automática de conexión
- Sincronización en segundo plano

### 6. Exportación
- Generación de PDF con fotos y datos
- Exportación a Excel de registros
- Plantillas personalizables

## 🚀 Instalación

### Requisitos Previos
- Node.js 20+
- npm 10+
- Android Studio (para Android)
- Xcode 15+ (para iOS, requiere macOS)

### Frontend

```bash
cd frontend
npm install
ionic serve          # Desarrollo web
ionic cap run android # Desarrollo Android
ionic cap run ios     # Desarrollo iOS
```

### Backend

```bash
cd backend
npm install
cp .env.example .env  # Configurar variables de entorno
npm run dev           # Servidor de desarrollo
```

## 📝 Variables de Entorno

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/geotech
CLAUDE_API_KEY=your_claude_api_key
JWT_SECRET=your_jwt_secret
PORT=3000
```

### Frontend (environment.ts)
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
};
```

## 📄 Licencia

Proyecto privado - Todos los derechos reservados.

## 👤 Autor

Desarrollado para uso profesional en ingeniería civil.

---

*Documentación generada el 25/12/2024*
