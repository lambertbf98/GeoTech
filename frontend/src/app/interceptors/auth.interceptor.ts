import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, from } from 'rxjs';
import { catchError, filter, take, switchMap, finalize } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  private refreshFailed = false; // Evitar múltiples intentos fallidos

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Resetear refreshFailed cuando el usuario inicia sesión
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.refreshFailed = false;
        this.isRefreshing = false;
      }
    });
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return this.handle401Error(request, next);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Si ya falló el refresh anteriormente, no intentar de nuevo
    if (this.refreshFailed) {
      return throwError(() => new Error('Sesión expirada'));
    }

    // Si ya estamos refrescando, esperar
    if (this.isRefreshing) {
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(token => {
          return next.handle(this.addTokenToRequest(request, token!));
        })
      );
    }

    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    // Intentar refrescar el token
    return from(this.authService.refreshToken()).pipe(
      switchMap(response => {
        if (response && response.token) {
          this.refreshFailed = false; // Reset si tuvo éxito
          this.refreshTokenSubject.next(response.token);
          return next.handle(this.addTokenToRequest(request, response.token));
        }
        // Si no hay refresh token, ir al login
        this.refreshFailed = true;
        this.goToLogin();
        return throwError(() => new Error('Sesión expirada'));
      }),
      catchError(err => {
        // Si falla el refresh, ir al login (solo una vez)
        this.refreshFailed = true;
        this.goToLogin();
        return throwError(() => err);
      }),
      finalize(() => {
        this.isRefreshing = false;
      })
    );
  }

  private addTokenToRequest(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private goToLogin(): void {
    this.authService.logout().then(() => {
      this.router.navigate(['/login']);
    });
  }
}
