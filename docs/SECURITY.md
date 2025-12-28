# Guia de Seguridad - GeoTech

Este documento describe las medidas de seguridad implementadas en GeoTech.

---

## Indice

1. [Resumen de Seguridad](#resumen-de-seguridad)
2. [Seguridad del Frontend](#seguridad-del-frontend)
3. [Seguridad de Red](#seguridad-de-red)
4. [Seguridad de Datos](#seguridad-de-datos)
5. [Seguridad de Android](#seguridad-de-android)
6. [Seguridad de iOS](#seguridad-de-ios)
7. [Buenas Practicas](#buenas-practicas)

---

## Resumen de Seguridad

| Categoria | Medida | Estado |
|-----------|--------|--------|
| Codigo | Ofuscacion y minificacion | Implementado |
| Codigo | Eliminacion de source maps | Implementado |
| Red | HTTPS obligatorio | Implementado |
| Red | Certificate pinning | Configurado |
| Red | Content Security Policy | Implementado |
| Datos | Encriptacion AES-256-GCM | Implementado |
| Datos | Tokens seguros | Implementado |
| App | Deteccion root/jailbreak | Implementado |
| App | Anti-debugging | Implementado |
| Android | ProGuard | Configurado |
| Android | Network Security Config | Configurado |

---

## Seguridad del Frontend

### 1. Ofuscacion de Codigo

El codigo JavaScript se ofusca automaticamente en produccion:

```json
// angular.json - configuracion de produccion
{
  "optimization": {
    "scripts": true,
    "styles": { "minify": true, "inlineCritical": true },
    "fonts": true
  },
  "buildOptimizer": true,
  "sourceMap": false,
  "namedChunks": false
}
```

**Beneficios:**
- Nombres de variables y funciones ilegibles
- Codigo minificado dificil de analizar
- Sin source maps que revelen la estructura

### 2. Deshabilitacion de Debugging

En produccion, se deshabilitan herramientas de depuracion:

```typescript
// main.ts
if (environment.production) {
  enableProdMode();

  // Deshabilitar console
  window.console.log = () => {};
  window.console.debug = () => {};

  // Prevenir click derecho
  document.addEventListener('contextmenu', e => e.preventDefault());
}
```

### 3. Content Security Policy

Politica estricta de seguridad de contenido:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self' data: blob: https: capacitor: ionic:;
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cesium.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https: http:;
  connect-src 'self' https: wss: data: blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'self';
" />
```

**Protege contra:**
- Inyeccion de scripts maliciosos (XSS)
- Carga de recursos de dominios no autorizados
- Clickjacking

---

## Seguridad de Red

### 1. Interceptor HTTP Seguro

Todas las peticiones HTTP pasan por un interceptor de seguridad:

```typescript
// security.interceptor.ts
@Injectable()
export class SecurityInterceptor implements HttpInterceptor {
  private readonly ALLOWED_DOMAINS = [
    'localhost',
    'railway.app',
    'nominatim.openstreetmap.org',
    // ...
  ];

  intercept(request, next) {
    // Verificar dominio permitido
    if (!this.isAllowedDomain(request.url)) {
      return throwError(() => new Error('Unauthorized domain'));
    }

    // Forzar HTTPS en produccion
    if (environment.production && request.url.startsWith('http://')) {
      request = request.clone({
        url: request.url.replace('http://', 'https://')
      });
    }

    return next.handle(request);
  }
}
```

### 2. Certificate Pinning (Android)

Configuracion en `network_security_config.xml`:

```xml
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>

  <domain-config>
    <domain includeSubdomains="true">railway.app</domain>
    <pin-set expiration="2025-12-31">
      <pin digest="SHA-256">HASH_DEL_CERTIFICADO</pin>
    </pin-set>
  </domain-config>
</network-security-config>
```

**Para obtener el hash del certificado:**
```bash
openssl s_client -connect tu-api.railway.app:443 | \
  openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

---

## Seguridad de Datos

### 1. Almacenamiento Encriptado

Los datos sensibles se encriptan con AES-256-GCM:

```typescript
// secure-storage.service.ts
async encrypt(data: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    this.encryptionKey,
    encoder.encode(data)
  );
  return btoa(String.fromCharCode(...combined));
}
```

**Datos encriptados:**
- Tokens de autenticacion
- Credenciales de usuario
- Datos sensibles de proyectos

### 2. Generacion Segura de IDs

```typescript
generateSecureId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}
```

### 3. Sanitizacion de Inputs

```typescript
sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

---

## Seguridad de Android

### 1. ProGuard

Configuracion en `proguard-rules.pro`:

```proguard
# Ofuscacion agresiva
-optimizationpasses 5
-dontusemixedcaseclassnames
-verbose

# Remover logs
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# Mantener Capacitor
-keep class com.getcapacitor.** { *; }
```

### 2. Configuracion de Build

En `android/app/build.gradle`:

```gradle
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'),
                         'proguard-rules.pro'
        }
    }
}
```

### 3. Deteccion de Root

```typescript
private async checkRootJailbreak(): Promise<boolean> {
  const suspiciousFiles = [
    '/system/app/Superuser.apk',
    '/system/xbin/su',
    '/sbin/.magisk'
  ];
  // Verificar existencia de archivos
}
```

---

## Seguridad de iOS

### 1. App Transport Security

En `ios/App/App/Info.plist`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
</dict>
```

### 2. Keychain para Tokens

Los tokens se almacenan en el Keychain de iOS automaticamente mediante Capacitor Preferences.

### 3. Deteccion de Jailbreak

```typescript
const jailbreakFiles = [
  '/Applications/Cydia.app',
  '/Library/MobileSubstrate/MobileSubstrate.dylib',
  '/bin/bash',
  '/usr/sbin/sshd'
];
```

---

## Buenas Practicas

### Para Desarrolladores

1. **Nunca hardcodear credenciales**
   ```typescript
   // MAL
   const API_KEY = 'sk-ant-123456';

   // BIEN
   const API_KEY = environment.apiKey;
   ```

2. **Validar todos los inputs**
   ```typescript
   const email = securityService.sanitizeEmail(userInput);
   if (!email) throw new Error('Email invalido');
   ```

3. **Usar HTTPS siempre**
   ```typescript
   if (url.startsWith('http://')) {
     url = url.replace('http://', 'https://');
   }
   ```

4. **No loguear datos sensibles**
   ```typescript
   // MAL
   console.log('Token:', token);

   // BIEN
   console.log('Token received');
   ```

### Para Despliegue

1. **Verificar build de produccion**
   ```bash
   ionic build --configuration=production
   ```

2. **Actualizar certificados antes de expiracion**

3. **Rotar API keys periodicamente**

4. **Monitorear logs de errores**

### Checklist de Seguridad

- [ ] Build de produccion sin source maps
- [ ] HTTPS configurado correctamente
- [ ] Certificate pinning con certificados actuales
- [ ] ProGuard habilitado para Android
- [ ] Variables de entorno configuradas
- [ ] Logs deshabilitados en produccion
- [ ] Tokens encriptados en almacenamiento

---

## Actualizaciones de Seguridad

| Fecha | Version | Cambio |
|-------|---------|--------|
| 28/12/2024 | 1.0.0 | Implementacion inicial de seguridad |

---

*Documentacion actualizada el 28/12/2024*
