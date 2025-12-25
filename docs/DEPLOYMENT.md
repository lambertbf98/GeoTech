# Guía de Despliegue - GeoTech

## Desarrollo Local

### Requisitos

- Node.js 20+ (https://nodejs.org)
- npm 10+
- Git
- PostgreSQL 16 (o Docker)
- Android Studio (para desarrollo Android)
- Xcode 15+ (solo macOS, para desarrollo iOS)

### Instalación Inicial

```bash
# Clonar repositorio
git clone <repo_url>
cd geotech

# Instalar dependencias del backend
cd backend
npm install

# Configurar base de datos
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar migraciones
npx prisma migrate dev

# Iniciar servidor
npm run dev

# En otra terminal, instalar frontend
cd ../frontend
npm install

# Iniciar desarrollo web
ionic serve
```

### Base de Datos con Docker

Si prefieres usar Docker para PostgreSQL:

```bash
docker run --name geotech-db \
  -e POSTGRES_USER=geotech \
  -e POSTGRES_PASSWORD=geotech123 \
  -e POSTGRES_DB=geotech \
  -p 5432:5432 \
  -d postgres:16
```

---

## Despliegue Backend (Railway)

Railway ofrece hosting gratuito perfecto para desarrollo y pruebas.

### Paso 1: Crear cuenta

1. Ir a https://railway.app
2. Registrarse con GitHub

### Paso 2: Crear proyecto

1. Click en "New Project"
2. Seleccionar "Deploy from GitHub repo"
3. Autorizar acceso al repositorio
4. Seleccionar el repositorio de GeoTech

### Paso 3: Configurar PostgreSQL

1. En el proyecto, click en "New"
2. Seleccionar "Database" → "Add PostgreSQL"
3. Railway creará automáticamente la base de datos

### Paso 4: Configurar variables de entorno

En el servicio del backend, añadir:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
CLAUDE_API_KEY=tu_api_key_de_anthropic
JWT_SECRET=un_secreto_largo_y_aleatorio
NODE_ENV=production
PORT=3000
```

### Paso 5: Configurar el build

Railway detectará automáticamente Node.js. Asegúrate de tener en `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "postinstall": "prisma generate"
  }
}
```

### Paso 6: Deploy

Railway desplegará automáticamente con cada push a la rama principal.

---

## Despliegue Backend (IONOS VPS)

Para producción con más control y recursos.

### Paso 1: Preparar VPS

```bash
# Conectar por SSH
ssh root@tu_ip_vps

# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Instalar PostgreSQL
apt install -y postgresql postgresql-contrib

# Instalar Nginx
apt install -y nginx

# Instalar PM2 (gestor de procesos)
npm install -g pm2
```

### Paso 2: Configurar PostgreSQL

```bash
# Acceder a PostgreSQL
sudo -u postgres psql

# Crear base de datos y usuario
CREATE DATABASE geotech;
CREATE USER geotech WITH ENCRYPTED PASSWORD 'tu_contraseña_segura';
GRANT ALL PRIVILEGES ON DATABASE geotech TO geotech;
\q
```

### Paso 3: Configurar aplicación

```bash
# Crear directorio
mkdir -p /var/www/geotech
cd /var/www/geotech

# Clonar repositorio
git clone <repo_url> .

# Instalar dependencias
cd backend
npm install --production

# Configurar entorno
cp .env.example .env
nano .env  # Editar con valores de producción

# Ejecutar migraciones
npx prisma migrate deploy

# Compilar TypeScript
npm run build

# Iniciar con PM2
pm2 start dist/index.js --name geotech-api
pm2 save
pm2 startup
```

### Paso 4: Configurar Nginx

```bash
nano /etc/nginx/sites-available/geotech
```

```nginx
server {
    listen 80;
    server_name api.tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Activar sitio
ln -s /etc/nginx/sites-available/geotech /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Paso 5: SSL con Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.tudominio.com
```

---

## Compilación App Móvil

### Android

```bash
cd frontend

# Compilar Angular
ionic build --prod

# Sincronizar con Capacitor
ionic cap sync android

# Abrir en Android Studio
ionic cap open android
```

En Android Studio:
1. Build → Generate Signed Bundle / APK
2. Seguir asistente para crear keystore
3. Generar AAB para Google Play

### iOS

```bash
cd frontend

# Compilar Angular
ionic build --prod

# Sincronizar con Capacitor
ionic cap sync ios

# Abrir en Xcode
ionic cap open ios
```

En Xcode:
1. Seleccionar "Any iOS Device"
2. Product → Archive
3. Distribute App → App Store Connect

---

## Publicación en Tiendas

### Google Play Store

1. Crear cuenta de desarrollador ($25 único)
2. Crear aplicación en Google Play Console
3. Subir AAB generado
4. Completar ficha de la tienda
5. Configurar precios y distribución
6. Enviar para revisión

### Apple App Store

1. Crear cuenta de desarrollador ($99/año)
2. Crear App ID en Apple Developer
3. Crear aplicación en App Store Connect
4. Subir build desde Xcode
5. Completar información de la app
6. Enviar para revisión

---

## Variables de Entorno

### Backend (.env)

```bash
# Base de datos
DATABASE_URL=postgresql://user:password@host:5432/geotech

# Autenticación
JWT_SECRET=tu_secreto_jwt_muy_largo_y_aleatorio
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# Claude API
CLAUDE_API_KEY=sk-ant-...

# Storage (si usas S3 o similar)
STORAGE_TYPE=local  # o 's3'
S3_BUCKET=geotech-photos
S3_REGION=eu-west-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# Servidor
PORT=3000
NODE_ENV=production
```

### Frontend (environment.prod.ts)

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.tudominio.com/api',
};
```

---

## Monitorización

### PM2 (Backend)

```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs geotech-api

# Monitorizar
pm2 monit

# Reiniciar
pm2 restart geotech-api
```

### Logs de Nginx

```bash
# Acceso
tail -f /var/log/nginx/access.log

# Errores
tail -f /var/log/nginx/error.log
```

---

## Backups

### Base de datos

```bash
# Backup manual
pg_dump -U geotech geotech > backup_$(date +%Y%m%d).sql

# Automatizar con cron
crontab -e
# Añadir:
0 3 * * * pg_dump -U geotech geotech > /var/backups/geotech_$(date +\%Y\%m\%d).sql
```

### Fotos

Si usas almacenamiento local:

```bash
# Backup de fotos
rsync -avz /var/www/geotech/uploads/ /var/backups/photos/
```
