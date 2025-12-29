import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Project, Photo, SyncQueueItem, Measurement } from '../models';

// IndexedDB para fotos (más espacio que localStorage)
const DB_NAME = 'geotech_db';
const DB_VERSION = 1;
const PHOTOS_STORE = 'photos';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly PROJECTS_KEY = 'geotech_projects';
  private readonly SYNC_QUEUE_KEY = 'geotech_sync_queue';
  private readonly MEASUREMENTS_KEY = 'geotech_measurements';

  private db: IDBDatabase | null = null;

  constructor() {
    this.initIndexedDB();
  }

  // ========== INDEXED DB PARA FOTOS ==========
  private async initIndexedDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error opening IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Crear store para fotos si no existe
        if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
          const store = db.createObjectStore(PHOTOS_STORE, { keyPath: 'id' });
          store.createIndex('projectId', 'projectId', { unique: false });
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return this.initIndexedDB();
  }

  // ========== PROJECTS (Preferences - son pequeños) ==========
  async getProjects(): Promise<Project[]> {
    const { value } = await Preferences.get({ key: this.PROJECTS_KEY });
    return value ? JSON.parse(value) : [];
  }

  async setProjects(projects: Project[]): Promise<void> {
    await Preferences.set({
      key: this.PROJECTS_KEY,
      value: JSON.stringify(projects)
    });
  }

  async saveProject(project: Project): Promise<void> {
    const projects = await this.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    await Preferences.set({
      key: this.PROJECTS_KEY,
      value: JSON.stringify(projects)
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    const projects = await this.getProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    await Preferences.set({
      key: this.PROJECTS_KEY,
      value: JSON.stringify(filtered)
    });

    // Eliminar fotos del proyecto de IndexedDB
    const photos = await this.getPhotos(projectId);
    for (const photo of photos) {
      await this.deletePhoto(photo.id);
    }
  }

  async getProject(projectId: string): Promise<Project | undefined> {
    const projects = await this.getProjects();
    return projects.find(p => p.id === projectId);
  }

  // ========== PHOTOS (IndexedDB - más espacio) ==========
  async getPhotos(projectId?: string): Promise<Photo[]> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PHOTOS_STORE], 'readonly');
        const store = transaction.objectStore(PHOTOS_STORE);

        if (projectId) {
          const index = store.index('projectId');
          const request = index.getAll(projectId);
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        } else {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        }
      });
    } catch (error) {
      console.error('Error getting photos from IndexedDB:', error);
      // Fallback a Preferences si IndexedDB falla
      return this.getPhotosFromPreferences(projectId);
    }
  }

  // Fallback para compatibilidad
  private async getPhotosFromPreferences(projectId?: string): Promise<Photo[]> {
    const { value } = await Preferences.get({ key: 'geotech_photos' });
    const photos: Photo[] = value ? JSON.parse(value) : [];
    if (projectId) {
      return photos.filter(p => p.projectId === projectId);
    }
    return photos;
  }

  async savePhoto(photo: Photo): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PHOTOS_STORE], 'readwrite');
        const store = transaction.objectStore(PHOTOS_STORE);
        const request = store.put(photo);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('Error saving photo:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error saving photo to IndexedDB:', error);
      throw error;
    }
  }

  async addPhoto(photo: Photo): Promise<void> {
    await this.savePhoto(photo);
  }

  async updatePhoto(photo: Photo): Promise<void> {
    await this.savePhoto(photo);
  }

  async deletePhoto(photoId: string): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PHOTOS_STORE], 'readwrite');
        const store = transaction.objectStore(PHOTOS_STORE);
        const request = store.delete(photoId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error deleting photo from IndexedDB:', error);
    }
  }

  async getPhoto(photoId: string): Promise<Photo | undefined> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PHOTOS_STORE], 'readonly');
        const store = transaction.objectStore(PHOTOS_STORE);
        const request = store.get(photoId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting photo from IndexedDB:', error);
      return undefined;
    }
  }

  // ========== SYNC QUEUE ==========
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const { value } = await Preferences.get({ key: this.SYNC_QUEUE_KEY });
    return value ? JSON.parse(value) : [];
  }

  async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    const queue = await this.getSyncQueue();
    queue.push(item);
    await Preferences.set({
      key: this.SYNC_QUEUE_KEY,
      value: JSON.stringify(queue)
    });
  }

  async updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    const queue = await this.getSyncQueue();
    const index = queue.findIndex(q => q.id === item.id);
    if (index >= 0) {
      queue[index] = item;
      await Preferences.set({
        key: this.SYNC_QUEUE_KEY,
        value: JSON.stringify(queue)
      });
    }
  }

  async removeFromSyncQueue(itemId: string): Promise<void> {
    const queue = await this.getSyncQueue();
    const filtered = queue.filter(q => q.id !== itemId);
    await Preferences.set({
      key: this.SYNC_QUEUE_KEY,
      value: JSON.stringify(filtered)
    });
  }

  async clearSyncQueue(): Promise<void> {
    await Preferences.set({
      key: this.SYNC_QUEUE_KEY,
      value: JSON.stringify([])
    });
  }

  async getPendingSyncCount(): Promise<number> {
    const queue = await this.getSyncQueue();
    return queue.filter(q => q.status === 'pending').length;
  }

  generateId(): string {
    return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async clearAll(): Promise<void> {
    await Preferences.clear();
    // También limpiar IndexedDB
    try {
      const db = await this.getDB();
      const transaction = db.transaction([PHOTOS_STORE], 'readwrite');
      const store = transaction.objectStore(PHOTOS_STORE);
      store.clear();
    } catch (error) {
      console.error('Error clearing IndexedDB:', error);
    }
  }

  async clear(): Promise<void> {
    await this.clearAll();
  }

  // ========== MEASUREMENTS ==========
  async getMeasurements(): Promise<Measurement[]> {
    const { value } = await Preferences.get({ key: this.MEASUREMENTS_KEY });
    return value ? JSON.parse(value) : [];
  }

  async saveMeasurement(measurement: Measurement): Promise<void> {
    const measurements = await this.getMeasurements();
    const index = measurements.findIndex(m => m.id === measurement.id);
    if (index >= 0) {
      measurements[index] = measurement;
    } else {
      measurements.unshift(measurement);
    }
    await Preferences.set({
      key: this.MEASUREMENTS_KEY,
      value: JSON.stringify(measurements)
    });
  }

  async deleteMeasurement(measurementId: string): Promise<void> {
    const measurements = await this.getMeasurements();
    const filtered = measurements.filter(m => m.id !== measurementId);
    await Preferences.set({
      key: this.MEASUREMENTS_KEY,
      value: JSON.stringify(filtered)
    });
  }

  async clearMeasurements(): Promise<void> {
    await Preferences.set({
      key: this.MEASUREMENTS_KEY,
      value: JSON.stringify([])
    });
  }

  // ========== MIGRACIÓN DE FOTOS ANTIGUAS ==========
  async migratePhotosToIndexedDB(): Promise<void> {
    try {
      // Obtener fotos del localStorage antiguo
      const { value } = await Preferences.get({ key: 'geotech_photos' });
      if (!value) return;

      const oldPhotos: Photo[] = JSON.parse(value);
      if (oldPhotos.length === 0) return;

      console.log(`Migrando ${oldPhotos.length} fotos a IndexedDB...`);

      // Guardar cada foto en IndexedDB
      for (const photo of oldPhotos) {
        await this.savePhoto(photo);
      }

      // Limpiar las fotos del localStorage
      await Preferences.remove({ key: 'geotech_photos' });
      console.log('Migración completada');
    } catch (error) {
      console.error('Error durante migración:', error);
    }
  }
}
