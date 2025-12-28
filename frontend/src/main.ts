import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// Habilitar modo produccion
if (environment.production) {
  enableProdMode();

  // Deshabilitar console en produccion
  if (!environment.enableLogging) {
    window.console.log = () => {};
    window.console.debug = () => {};
    window.console.info = () => {};
    window.console.warn = () => {};
    // Mantener console.error para errores criticos
  }

  // Prevenir click derecho (anti-inspect)
  if (!environment.enableDevTools) {
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Detectar DevTools
    const detectDevTools = () => {
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        document.body.innerHTML = '<h1 style="text-align:center;margin-top:50px;">Acceso no autorizado</h1>';
      }
    };

    // Verificar periodicamente (desactivado por usabilidad)
    // setInterval(detectDevTools, 1000);
  }
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error('Error bootstrapping app:', err));
