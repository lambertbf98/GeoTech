import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Project, Photo, SyncQueueItem } from '../models';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly PROJECTS_KEY = 'geotech_projects';
  private readonly PHOTOS_KEY = 'geotech_photos';
  private readonly SYNC_QUEUE_KEY = 'geotech_sync_queue';

  constructor() {}

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
    const photos = await this.getPhotos();
    const remainingPhotos = photos.filter(p => p.projectId !== projectId);
    await Preferences.set({
      key: this.PHOTOS_KEY,
      value: JSON.stringify(remainingPhotos)
    });
  }

  async getProject(projectId: string): Promise<Project | undefined> {
    const projects = await this.getProjects();
    return projects.find(p => p.id === projectId);
  }

  async getPhotos(projectId?: string): Promise<Photo[]> {
    const { value } = await Preferences.get({ key: this.PHOTOS_KEY });
    const photos: Photo[] = value ? JSON.parse(value) : [];
    if (projectId) {
      return photos.filter(p => p.projectId === projectId);
    }
    return photos;
  }

  async savePhoto(photo: Photo): Promise<void> {
    const photos = await this.getPhotos();
    const index = photos.findIndex(p => p.id === photo.id);
    if (index >= 0) {
      photos[index] = photo;
    } else {
      photos.push(photo);
    }
    await Preferences.set({
      key: this.PHOTOS_KEY,
      value: JSON.stringify(photos)
    });
  }

  async addPhoto(photo: Photo): Promise<void> {
    await this.savePhoto(photo);
  }

  async updatePhoto(photo: Photo): Promise<void> {
    await this.savePhoto(photo);
  }

  async deletePhoto(photoId: string): Promise<void> {
    const photos = await this.getPhotos();
    const filtered = photos.filter(p => p.id !== photoId);
    await Preferences.set({
      key: this.PHOTOS_KEY,
      value: JSON.stringify(filtered)
    });
  }

  async getPhoto(photoId: string): Promise<Photo | undefined> {
    const photos = await this.getPhotos();
    return photos.find(p => p.id === photoId);
  }

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
  }

  async clear(): Promise<void> {
    await Preferences.clear();
  }
}
