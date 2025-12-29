import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders()
    });
  }

  post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, data, {
      headers: this.getHeaders()
    });
  }

  put<T>(endpoint: string, data: any): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, data, {
      headers: this.getHeaders()
    });
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders()
    });
  }

  uploadFile<T>(endpoint: string, formData: FormData): Observable<T> {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.post<T>(`${this.baseUrl}${endpoint}`, formData, {
      headers
    });
  }

  // ========== REPORTS ==========

  // Crear un informe en la nube
  createReport(projectId: string, name: string, htmlContent: string): Observable<any> {
    return this.post('/reports', { projectId, name, htmlContent });
  }

  // Obtener informes de un proyecto
  getReportsByProject(projectId: string): Observable<any> {
    return this.get(`/reports/project/${projectId}`);
  }

  // Obtener un informe específico
  getReport(reportId: string): Observable<any> {
    return this.get(`/reports/${reportId}`);
  }

  // Eliminar un informe
  deleteReport(reportId: string): Observable<any> {
    return this.delete(`/reports/${reportId}`);
  }

  // ========== KML FILES ==========

  // Crear un archivo KML en la nube
  createKml(projectId: string, name: string, kmlContent: string): Observable<any> {
    return this.post('/reports/kml', { projectId, name, kmlContent });
  }

  // Obtener archivos KML de un proyecto
  getKmlsByProject(projectId: string): Observable<any> {
    return this.get(`/reports/kml/project/${projectId}`);
  }

  // Obtener un KML específico
  getKml(kmlId: string): Observable<any> {
    return this.get(`/reports/kml/${kmlId}`);
  }

  // Eliminar un KML
  deleteKml(kmlId: string): Observable<any> {
    return this.delete(`/reports/kml/${kmlId}`);
  }
}
