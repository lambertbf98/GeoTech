import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable()
export class SecurityInterceptor implements HttpInterceptor {
  private readonly REQUEST_TIMEOUT = 30000; // 30 segundos
  private readonly ALLOWED_DOMAINS = [
    'localhost',
    'railway.app',
    'nominatim.openstreetmap.org',
    'ovc.catastro.meh.es',
    'services.arcgisonline.com',
    'api.anthropic.com',
    'cesium.com'
  ];

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Verificar dominio permitido
    if (!this.isAllowedDomain(request.url)) {
      console.warn('Blocked request to unauthorized domain:', request.url);
      return throwError(() => new Error('Unauthorized domain'));
    }

    // Clonar request con headers de seguridad
    let secureRequest = request.clone({
      setHeaders: this.getSecurityHeaders()
    });

    // Forzar HTTPS en produccion
    if (environment.production && request.url.startsWith('http://')) {
      const httpsUrl = request.url.replace('http://', 'https://');
      secureRequest = secureRequest.clone({ url: httpsUrl });
    }

    return next.handle(secureRequest).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError((error: HttpErrorResponse) => {
        return this.handleError(error);
      })
    );
  }

  private isAllowedDomain(url: string): boolean {
    try {
      // Permitir URLs relativas
      if (url.startsWith('/')) return true;
      if (url.startsWith('data:')) return true;
      if (url.startsWith('blob:')) return true;

      const urlObj = new URL(url);
      return this.ALLOWED_DOMAINS.some(domain =>
        urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
      );
    } catch {
      // Si no es una URL valida, permitir (probablemente relativa)
      return true;
    }
  }

  private getSecurityHeaders(): { [key: string]: string } {
    const headers: { [key: string]: string } = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Client-Version': '1.0.0'
    };

    // No enviar cookies a dominios externos
    return headers;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Error de conexion';

    if (error.error instanceof ErrorEvent) {
      // Error del cliente
      errorMessage = error.error.message;
    } else {
      // Error del servidor
      switch (error.status) {
        case 0:
          errorMessage = 'Sin conexion a internet';
          break;
        case 401:
          errorMessage = 'Sesion expirada';
          break;
        case 403:
          errorMessage = 'Acceso denegado';
          break;
        case 404:
          errorMessage = 'Recurso no encontrado';
          break;
        case 429:
          errorMessage = 'Demasiadas solicitudes';
          break;
        case 500:
          errorMessage = 'Error del servidor';
          break;
        case 503:
          errorMessage = 'Servicio no disponible';
          break;
        default:
          errorMessage = `Error: ${error.status}`;
      }
    }

    // No loguear datos sensibles
    if (environment.production) {
      console.error('HTTP Error:', error.status);
    } else {
      console.error('HTTP Error:', error);
    }

    return throwError(() => new Error(errorMessage));
  }
}
