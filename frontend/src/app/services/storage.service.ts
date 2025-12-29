import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Project, Photo, SyncQueueItem, Measurement } from '../models';

// IndexedDB para todo el almacenamiento grande
const DB_NAME = 'geotech_db';
const DB_VERSION = 2; // Incrementar versión para agregar stores
const PHOTOS_STORE = 'photos';
const PROJECTS_STORE = 'projects';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly SYNC_QUEUE_KEY = 'geotech_sync_queue';
  private readonly MEASUREMENTS_KEY = 'geotech_measurements';

  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase> | null = null;

  constructor() {
    this.dbReady = this.initIndexedDB();
  }

  // ========== INDEXED DB ==========
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

        // Store para fotos
        if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
          const photosStore = db.createObjectStore(PHOTOS_STORE, { keyPath: 'id' });
          photosStore.createIndex('projectId', 'projectId', { unique: false });
        }

        // Store para proyectos (nuevo en v2)
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbReady) return this.dbReady;
    return this.initIndexedDB();
  }

  // ========== PROJECTS (IndexedDB) ==========
  async getProjects(): Promise<Project[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PROJECTS_STORE], 'readonly');
        const store = transaction.objectStore(PROJECTS_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting projects from IndexedDB:', error);
      // Fallback a Preferences
      return this.getProjectsFromPreferences();
    }
  }

  private async getProjectsFromPreferences(): Promise<Project[]> {
    const { value } = await Preferences.get({ key: 'geotech_projects' });
    return value ? JSON.parse(value) : [];
  }

  async setProjects(projects: Project[]): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([PROJECTS_STORE], 'readwrite');
      const store = transaction.objectStore(PROJECTS_STORE);

      // Limpiar y re-agregar todos
      store.clear();
      for (const project of projects) {
        store.put(project);
      }
    } catch (error) {
      console.error('Error setting projects:', error);
    }
  }

  async saveProject(project: Project): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PROJECTS_STORE], 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE);
        const request = store.put(project);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error saving project:', error);
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      const db = await this.getDB();

      // Eliminar proyecto
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([PROJECTS_STORE], 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE);
        const request = store.delete(projectId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Eliminar fotos del proyecto
      const photos = await this.getPhotos(projectId);
      for (const photo of photos) {
        await this.deletePhoto(photo.id);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  }

  async getProject(projectId: string): Promise<Project | undefined> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PROJECTS_STORE], 'readonly');
        const store = transaction.objectStore(PROJECTS_STORE);
        const request = store.get(projectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting project:', error);
      return undefined;
    }
  }

  // ========== PHOTOS (IndexedDB) ==========
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
      console.error('Error getting photos:', error);
      return [];
    }
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
      console.error('Error deleting photo:', error);
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
      console.error('Error getting photo:', error);
      return undefined;
    }
  }

  // ========== SYNC QUEUE (pequeño, usa Preferences) ==========
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
    try {
      const db = await this.getDB();
      const transaction = db.transaction([PHOTOS_STORE, PROJECTS_STORE], 'readwrite');
      transaction.objectStore(PHOTOS_STORE).clear();
      transaction.objectStore(PROJECTS_STORE).clear();
    } catch (error) {
      console.error('Error clearing IndexedDB:', error);
    }
  }

  async clear(): Promise<void> {
    await this.clearAll();
  }

  // ========== MEASUREMENTS (pequeño, usa Preferences) ==========
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

  // ========== MIGRACIÓN DE DATOS ANTIGUOS ==========
  async migrateToIndexedDB(): Promise<void> {
    try {
      // Migrar proyectos de localStorage a IndexedDB
      const { value: projectsValue } = await Preferences.get({ key: 'geotech_projects' });
      if (projectsValue) {
        const oldProjects: Project[] = JSON.parse(projectsValue);
        if (oldProjects.length > 0) {
          console.log(`Migrando ${oldProjects.length} proyectos a IndexedDB...`);
          for (const project of oldProjects) {
            await this.saveProject(project);
          }
          await Preferences.remove({ key: 'geotech_projects' });
          console.log('Proyectos migrados');
        }
      }

      // Migrar fotos de localStorage a IndexedDB
      const { value: photosValue } = await Preferences.get({ key: 'geotech_photos' });
      if (photosValue) {
        const oldPhotos: Photo[] = JSON.parse(photosValue);
        if (oldPhotos.length > 0) {
          console.log(`Migrando ${oldPhotos.length} fotos a IndexedDB...`);
          for (const photo of oldPhotos) {
            await this.savePhoto(photo);
          }
          await Preferences.remove({ key: 'geotech_photos' });
          console.log('Fotos migradas');
        }
      }
    } catch (error) {
      console.error('Error durante migración:', error);
    }
  }
}
