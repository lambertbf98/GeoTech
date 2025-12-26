# GeoTech - Guia de Despliegue Railway

## Requisitos Previos
- Cuenta en [Railway](https://railway.app)
- Repositorio en GitHub con el codigo
- Variables de entorno configuradas

## 1. Desplegar Backend en Railway

### Paso 1: Crear nuevo proyecto
1. Ve a [railway.app](https://railway.app) e inicia sesion
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Conecta tu cuenta de GitHub si no lo has hecho
5. Selecciona el repositorio de GeoTech

### Paso 2: Configurar el servicio Backend
1. En el proyecto, click en **"Add Service"** > **"GitHub Repo"**
2. Selecciona la carpeta `/backend` como root directory
3. O si ya se creo, click en el servicio y ve a **Settings** > **Root Directory**: `backend`

### Paso 3: Agregar base de datos PostgreSQL
1. Click en **"Add Service"** > **"Database"** > **"PostgreSQL"**
2. Railway creara automaticamente la variable `DATABASE_URL`

### Paso 4: Configurar Variables de Entorno
En el servicio backend, ve a **Variables** y agrega:

```
DATABASE_URL=<se genera automatico al conectar PostgreSQL>
JWT_SECRET=tu-clave-secreta-super-segura-cambiar-esto
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
CLAUDE_API_KEY=sk-ant-tu-api-key-de-claude
NODE_ENV=production
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

### Paso 5: Generar dominio publico
1. Ve a **Settings** del servicio backend
2. En **Networking** > **Public Networking**
3. Click en **"Generate Domain"**
4. Obtendras una URL como: `geotech-production.up.railway.app`

## 2. Actualizar Frontend

### Configurar URL de produccion
El archivo `frontend/src/environments/environment.prod.ts` ya esta configurado:
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://geotech-production.up.railway.app/api'
};
```

Si tu dominio de Railway es diferente, actualiza esta URL.

### Compilar para produccion
```bash
cd frontend
npm run build -- --configuration=production
```

### Opciones de despliegue del Frontend:

#### Opcion A: Como app movil (Capacitor)
```bash
# iOS
npx cap sync ios
npx cap open ios

# Android
npx cap sync android
npx cap open android
```

#### Opcion B: Como PWA en Vercel/Netlify
1. Sube la carpeta `www/` generada
2. Configura el redirect para SPA

## 3. Verificar Despliegue

### Probar el backend
```bash
curl https://geotech-production.up.railway.app/health
# Respuesta esperada: {"status":"ok"}

curl https://geotech-production.up.railway.app/api/health
# Respuesta esperada: {"status":"ok","timestamp":"..."}
```

### Verificar conexion desde la app
1. Abre la app en tu movil
2. Intenta iniciar sesion o registrarte
3. Si conecta correctamente, el deploy esta funcionando

## 4. Variables de Entorno Requeridas

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL (Railway la genera) | `postgresql://...` |
| `JWT_SECRET` | Clave secreta para tokens | `mi-clave-super-secreta-123` |
| `JWT_EXPIRES_IN` | Duracion token acceso | `7d` |
| `REFRESH_TOKEN_EXPIRES_IN` | Duracion refresh token | `30d` |
| `CLAUDE_API_KEY` | API key de Anthropic | `sk-ant-...` |
| `NODE_ENV` | Entorno | `production` |
| `UPLOAD_DIR` | Directorio uploads | `./uploads` |
| `MAX_FILE_SIZE` | Tamano max archivo | `10485760` |

## 5. Troubleshooting

### Error: "Cannot connect to database"
- Verifica que PostgreSQL este corriendo en Railway
- Confirma que `DATABASE_URL` este configurada correctamente

### Error: "CORS blocked"
- El backend ya tiene CORS configurado para todos los origenes
- Si persiste, verifica la URL del API en el frontend

### La app no carga datos
- Verifica en Railway > Logs si hay errores
- Prueba el endpoint `/api/health` directamente

## 6. Costos Railway

Railway tiene un plan gratuito con:
- $5 de credito mensual
- 500 horas de ejecucion
- PostgreSQL incluido

Para uso basico/pruebas es suficiente. Para produccion real considera el plan Pro.
