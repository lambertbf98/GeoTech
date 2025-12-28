// This file can be replaced during build by using the fileReplacements array.
// ng build replaces environment.ts with environment.prod.ts.

export const environment = {
  production: false,
  apiUrl: 'https://geotech-production.up.railway.app/api',
  // Seguridad - Desarrollo
  enableLogging: true,
  enableDevTools: true,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 horas en desarrollo
  maxLoginAttempts: 999,
  lockoutDuration: 0
};
