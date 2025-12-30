import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { SecurityInterceptor } from './interceptors/security.interceptor';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { SecurityService } from './services/security.service';

// Factory para inicializar seguridad al arrancar la app
export function initializeSecurity(securityService: SecurityService) {
  return () => securityService.performSecurityChecks();
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    IonicModule.forRoot(),
    AppRoutingModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: SecurityInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeSecurity,
      deps: [SecurityService],
      multi: true
    }
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
