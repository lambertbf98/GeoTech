import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { CameraService } from './camera.service';
import { SyncQueueItem, SyncBatchRequest, SyncBatchResponse } from '../models';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private isOnlineSubject = new BehaviorSubject<boolean>(true);
  private isSyncingSubject = new BehaviorSubject<boolean>(false);
  private pendingCountSubject = new BehaviorSubject<number>(0);

  public isOnline$ = this.isOnlineSubject.asObservable();
  public isSyncing$ = this.isSyncingSubject.asObservable();
  public pendingCount$ = this.pendingCountSubject.asObservable();

  private syncInProgress = false;

  constructor(
    private api: ApiService,
    private storage: StorageService,
    private camera: CameraService
  ) {
    this.initNetworkListener();
  }

  private async initNetworkListener(): Promise<void> {
    // Verificar estado inicial
    const status = await Network.getStatus();
    this.isOnlineSubject.next(status.connected);

    // Escuchar cambios de conexión
    Network.addListener('networkStatusChange', async (status) => {
      this.isOnlineSubject.next(status.connected);

      // Si volvemos a estar online, intentar sincronizar
      if (status.connected && !this.syncInProgress) {
        await this.syncPending();
      }
    });

    // Actualizar contador de pendientes
    await this.updatePendingCount();
  }

  async updatePendingCount(): Promise<void> {
    const count = await this.storage.getPendingSyncCount();
    this.pendingCountSubject.next(count);
  }

  async queueForSync(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entity: 'project' | 'photo',
    entityId: string,
    data: any
  ): Promise<void> {
    const item: SyncQueueItem = {
      id: this.storage.generateId(),
      action,
      entity,
      entityId,
      data,
      createdAt: new Date(),
      attempts: 0,
      status: 'pending'
    };

    await this.storage.addToSyncQueue(item);
    await this.updatePendingCount();

    // Si estamos online, intentar sincronizar inmediatamente
    if (this.isOnlineSubject.value && !this.syncInProgress) {
      await this.syncPending();
    }
  }

  async syncPending(): Promise<void> {
    if (this.syncInProgress || !this.isOnlineSubject.value) {
      return;
    }

    this.syncInProgress = true;
    this.isSyncingSubject.next(true);

    try {
      const queue = await this.storage.getSyncQueue();
      const pendingItems = queue.filter(item =>
        item.status === 'pending' && item.attempts < 3
      );

      if (pendingItems.length === 0) {
        return;
      }

      // Procesar cada item
      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          await this.storage.removeFromSyncQueue(item.id);
        } catch (error) {
          // Incrementar intentos y marcar error
          item.attempts++;
          item.lastAttempt = new Date();
          item.error = error instanceof Error ? error.message : 'Error desconocido';

          if (item.attempts >= 3) {
            item.status = 'error';
          }

          await this.storage.updateSyncQueueItem(item);
        }
      }
    } finally {
      this.syncInProgress = false;
      this.isSyncingSubject.next(false);
      await this.updatePendingCount();
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    switch (item.entity) {
      case 'project':
        await this.syncProject(item);
        break;
      case 'photo':
        await this.syncPhoto(item);
        break;
    }
  }

  private async syncProject(item: SyncQueueItem): Promise<void> {
    switch (item.action) {
      case 'CREATE':
        const response: any = await this.api.post('/projects', item.data).toPromise();
        // Actualizar proyecto local con el serverId del servidor
        if (response && response.project && response.project.id) {
          const projects = await this.storage.getProjects();
          const localProject = projects.find(p => p.id === item.entityId);
          if (localProject) {
            localProject.serverId = response.project.id;
            localProject.synced = true;
            await this.storage.saveProject(localProject);
            console.log('Proyecto sincronizado con serverId:', response.project.id);
          }
        }
        break;
      case 'UPDATE':
        await this.api.put(`/projects/${item.entityId}`, item.data).toPromise();
        break;
      case 'DELETE':
        await this.api.delete(`/projects/${item.entityId}`).toPromise();
        break;
    }
  }

  private async syncPhoto(item: SyncQueueItem): Promise<void> {
    switch (item.action) {
      case 'CREATE':
        // Para fotos, necesitamos subir el archivo
        const photo = await this.storage.getPhoto(item.entityId);
        if (photo && photo.localPath) {
          const base64 = await this.camera.getPhotoBase64(photo.localPath);

          const formData = new FormData();
          const blob = this.base64ToBlob(base64, 'image/jpeg');
          formData.append('file', blob, 'photo.jpg');
          formData.append('projectId', photo.projectId);
          formData.append('latitude', photo.latitude.toString());
          formData.append('longitude', photo.longitude.toString());
          if (photo.altitude) formData.append('altitude', photo.altitude.toString());
          if (photo.accuracy) formData.append('accuracy', photo.accuracy.toString());
          if (photo.notes) formData.append('notes', photo.notes);

          const response = await this.api.uploadFile<any>('/photos', formData).toPromise();

          // Actualizar foto local con datos del servidor
          if (response && response.photo) {
            photo.imageUrl = response.photo.imageUrl;
            photo.synced = true;
            await this.storage.savePhoto(photo);
          }
        }
        break;
      case 'UPDATE':
        await this.api.put(`/photos/${item.entityId}`, item.data).toPromise();
        break;
      case 'DELETE':
        await this.api.delete(`/photos/${item.entityId}`).toPromise();
        break;
    }
  }

  private base64ToBlob(base64: string, contentType: string): Blob {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: contentType });
  }

  get isOnline(): boolean {
    return this.isOnlineSubject.value;
  }

  get isSyncing(): boolean {
    return this.isSyncingSubject.value;
  }
  async getPendingCount(): Promise<number> {
    return await this.storage.getPendingSyncCount();
  }

  async syncAll(): Promise<void> {
    await this.syncPending();
  }
}
