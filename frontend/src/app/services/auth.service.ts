import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '../models';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private api: ApiService) {
    this.loadStoredUser();
  }

  private async loadStoredUser(): Promise<void> {
    const { value } = await Preferences.get({ key: 'user' });
    if (value) {
      this.currentUserSubject.next(JSON.parse(value));
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/login', credentials).pipe(
      tap(response => this.handleAuthResponse(response))
    );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/register', data).pipe(
      tap(response => this.handleAuthResponse(response))
    );
  }

  async logout(): Promise<void> {
    await Preferences.remove({ key: 'token' });
    await Preferences.remove({ key: 'refreshToken' });
    await Preferences.remove({ key: 'user' });
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
  }

  async refreshToken(): Promise<AuthResponse | null> {
    const { value: refreshToken } = await Preferences.get({ key: 'refreshToken' });

    if (!refreshToken) {
      return null;
    }

    try {
      const response = await this.api.post<AuthResponse>('/auth/refresh', { refreshToken }).toPromise();
      if (response) {
        await this.handleAuthResponse(response);
        return response;
      }
      return null;
    } catch {
      await this.logout();
      return null;
    }
  }

  private async handleAuthResponse(response: AuthResponse): Promise<void> {
    await Preferences.set({ key: 'token', value: response.token });
    await Preferences.set({ key: 'refreshToken', value: response.refreshToken });
    await Preferences.set({ key: 'user', value: JSON.stringify(response.user) });
    localStorage.setItem('token', response.token);
    this.currentUserSubject.next(response.user);
  }

  get isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }
}
