# Guia de Despliegue - GeoTech

Esta guia detalla los pasos para desplegar GeoTech en diferentes entornos.

---

## Indice

1. [Desarrollo Local](#desarrollo-local)
2. [Despliegue en Railway (PWA)](#despliegue-en-railway-pwa)
3. [Compilacion Android](#compilacion-android)
4. [Compilacion iOS](#compilacion-ios)
5. [Variables de Entorno](#variables-de-entorno)
6. [Solucion de Problemas](#solucion-de-problemas)

---

## Desarrollo Local

### Requisitos Previos

| Software | Version | Descarga |
|----------|---------|----------|
| Node.js | 20.x o superior | https://nodejs.org |
| npm | 10.x o superior | Incluido con Node.js |
| Git | 2.x o superior | https://git-scm.com |
| Ionic CLI | 7.x | `npm install -g @ionic/cli` |

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/lambertbf98/GeoTech.git
cd GeoTech
```

### Paso 2: Instalar Dependencias del Frontend

```bash
cd frontend
npm install
```

### Paso 3: Configurar Variables de Entorno

Crear archivo `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  claudeApiKey: 'tu_api_key_de_anthropic'  // Opcional
};
```

Crear archivo `src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://tu-backend.railway.app/api',
  claudeApiKey: 'tu_api_key_de_anthropic'
};
```

### Paso 4: Ejecutar en Modo Desarrollo

```bash
# Abrir en navegador
ionic serve

# Con live reload en dispositivo Android conectado
ionic cap run android -l --external

# Con live reload en simulador iOS (solo macOS)
ionic cap run ios -l --external
```

El servidor de desarrollo estara disponible en `http://localhost:8100`

### Paso 5: Instalar y Ejecutar Backend (Opcional)

```bash
cd ../backend
npm install

# Crear archivo .env
echo "PORT=3000
NODE_ENV=development
JWT_SECRET=mi_secreto_jwt_desarrollo
CLAUDE_API_KEY=sk-ant-..." > .env

# Ejecutar en modo desarrollo
npm run dev
```

---

## Despliegue en Railway (PWA)

Railway permite desplegar la aplicacion como Progressive Web App accesible desde cualquier navegador.

### Paso 1: Crear Cuenta en Railway

1. Ir a https://railway.app
2. Registrarse con cuenta de GitHub
3. Verificar email si es necesario

### Paso 2: Conectar Repositorio

1. En el dashboard de Railway, click en **"New Project"**
2. Seleccionar **"Deploy from GitHub repo"**
3. Autorizar acceso a GitHub si es la primera vez
4. Buscar y seleccionar el repositorio **GeoTech**
5. Seleccionar la carpeta **frontend** como root directory

### Paso 3: Configurar Build

Railway detectara automaticamente el Dockerfile. Verificar que existe `frontend/Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

# Production stage
FROM nginx:alpine
COPY --from=build /app/www /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Verificar que existe `frontend/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

### Paso 4: Configurar Variables de Entorno (Opcional)

En Railway, ir a la pestana **Variables** del servicio:

```
NODE_ENV=production
```

### Paso 5: Desplegar

1. Railway iniciara automaticamente el build
2. Esperar a que el estado cambie a **"Deployed"**
3. Click en el dominio generado (ej: `geotech-production.up.railway.app`)
4. La aplicacion estara disponible como PWA

### Paso 6: Configurar Dominio Personalizado (Opcional)

1. En Railway, ir a **Settings** > **Domains**
2. Click en **"Add Custom Domain"**
3. Introducir tu dominio (ej: `app.geotech.es`)
4. Configurar DNS segun instrucciones de Railway

---

## Compilacion Android

### Requisitos Previos

| Software | Version | Descarga |
|----------|---------|----------|
| Android Studio | Hedgehog o superior | https://developer.android.com/studio |
| JDK | 17 | Incluido con Android Studio |
| Android SDK | API 34 | Via Android Studio SDK Manager |

### Paso 1: Preparar Entorno Android

1. Abrir Android Studio
2. Ir a **Settings** > **SDK Manager**
3. Instalar:
   - Android SDK Platform 34
   - Android SDK Build-Tools 34
   - Android Emulator
   - Android SDK Platform-Tools

### Paso 2: Compilar Proyecto Angular

```bash
cd frontend
ionic build --configuration=production
```

### Paso 3: Sincronizar con Capacitor

```bash
ionic cap sync android
```

### Paso 4: Abrir en Android Studio

```bash
ionic cap open android
```

### Paso 5: Configurar Firma (Primera vez)

1. En Android Studio: **Build** > **Generate Signed Bundle / APK**
2. Seleccionar **Android App Bundle**
3. Click en **Create new...**
4. Completar datos del keystore:
   - Key store path: `geotech-release.jks`
   - Password: (crear password seguro)
   - Alias: `geotech`
   - Validity: 25 years
   - Certificate info: Datos de la empresa
5. Guardar el keystore en lugar seguro

### Paso 6: Generar APK/AAB

**Para pruebas (APK):**
1. **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**
2. El APK estara en `android/app/build/outputs/apk/debug/`

**Para Google Play (AAB):**
1. **Build** > **Generate Signed Bundle / APK**
2. Seleccionar **Android App Bundle**
3. Usar el keystore creado
4. Seleccionar **release**
5. El AAB estara en `android/app/build/outputs/bundle/release/`

### Paso 7: Publicar en Google Play

1. Ir a https://play.google.com/console
2. Crear cuenta de desarrollador ($25 unico)
3. **Create app** > Completar informacion
4. Ir a **Production** > **Create new release**
5. Subir el archivo AAB
6. Completar ficha de la tienda (screenshots, descripcion, etc.)
7. Enviar para revision

---

## Compilacion iOS

### Requisitos Previos

| Software | Version | Requisito |
|----------|---------|-----------|
| macOS | Sonoma o superior | Obligatorio |
| Xcode | 15 o superior | https://developer.apple.com/xcode |
| CocoaPods | 1.14+ | `sudo gem install cocoapods` |
| Apple Developer Account | - | https://developer.apple.com |

### Paso 1: Compilar Proyecto Angular

```bash
cd frontend
ionic build --configuration=production
```

### Paso 2: Sincronizar con Capacitor

```bash
ionic cap sync ios
```

### Paso 3: Instalar Pods

```bash
cd ios/App
pod install
cd ../..
```

### Paso 4: Abrir en Xcode

```bash
ionic cap open ios
```

### Paso 5: Configurar Equipo de Desarrollo

1. En Xcode, seleccionar el proyecto **App**
2. Ir a **Signing & Capabilities**
3. Seleccionar tu **Team** (cuenta de desarrollador)
4. Xcode gestionara automaticamente los certificados

### Paso 6: Configurar Bundle Identifier

1. En **General** > **Identity**
2. Cambiar Bundle Identifier a: `com.tuempresa.geotech`
3. Cambiar Display Name a: `GeoTech`
4. Cambiar Version a la version actual

### Paso 7: Generar Build para App Store

1. Seleccionar dispositivo: **Any iOS Device (arm64)**
2. Menu **Product** > **Archive**
3. Esperar a que termine la compilacion
4. Se abrira el **Organizer**

### Paso 8: Subir a App Store Connect

1. En Organizer, seleccionar el archive
2. Click en **Distribute App**
3. Seleccionar **App Store Connect**
4. Seguir el asistente
5. Esperar a que se procese (10-30 minutos)

### Paso 9: Publicar en App Store

1. Ir a https://appstoreconnect.apple.com
2. Seleccionar la app
3. Ir a **App Store** > **iOS App**
4. Seleccionar el build subido
5. Completar informacion (screenshots, descripcion, etc.)
6. Enviar para revision

---

## Variables de Entorno

### Frontend (environment.ts)

```typescript
export const environment = {
  production: boolean,        // true para produccion
  apiUrl: string,            // URL del backend
  claudeApiKey?: string      // API key de Anthropic (opcional)
};
```

### Backend (.env)

```bash
# Servidor
PORT=3000
NODE_ENV=production

# Autenticacion
JWT_SECRET=clave_secreta_muy_larga_y_aleatoria
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# Claude API
CLAUDE_API_KEY=sk-ant-api03-...

# Base de datos (si se usa)
DATABASE_URL=postgresql://user:password@host:5432/geotech
```

---

## Solucion de Problemas

### Error: "ionic: command not found"

```bash
npm install -g @ionic/cli
```

### Error: "Could not find the AndroidManifest.xml"

```bash
ionic cap sync android
```

### Error: "Signing for App requires a development team"

1. Abrir Xcode
2. Seleccionar proyecto App
3. En Signing & Capabilities, seleccionar tu Team

### Error: "npm ERR! ERESOLVE"

```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Error: "Capacitor could not find native platform"

```bash
ionic cap add android
# o
ionic cap add ios
```

### Build tarda mucho en Railway

1. Verificar que no hay archivos innecesarios
2. Anadir a `.dockerignore`:
```
node_modules
android
ios
*.log
```

### La app no carga imagenes en produccion

1. Verificar que las imagenes estan en base64
2. Verificar Content-Security-Policy en index.html:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self' data: blob: https:;
               img-src 'self' data: blob: https: *;
               style-src 'self' 'unsafe-inline';">
```

### GPS no funciona en navegador

1. La geolocalizacion requiere HTTPS
2. En desarrollo, usar `ionic serve` con `--ssl`
3. En produccion, verificar certificado SSL

---

## Comandos Utiles

```bash
# Ver version de Ionic/Capacitor
ionic info

# Actualizar plugins de Capacitor
npm update @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# Limpiar cache de build
rm -rf www node_modules/.cache
ionic build --configuration=production

# Ver logs de Android
adb logcat | grep -i capacitor

# Ver logs de iOS (en Xcode)
# Window > Devices and Simulators > Seleccionar dispositivo > Open Console
```

---

*Documentacion actualizada el 28/12/2024*
