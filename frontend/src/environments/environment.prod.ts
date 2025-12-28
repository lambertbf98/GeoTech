export const environment = {
  production: true,
  apiUrl: '/api',
  // Seguridad
  enableLogging: false,
  enableDevTools: false,
  sessionTimeout: 30 * 60 * 1000, // 30 minutos
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000 // 15 minutos
};
