export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncEntity = 'project' | 'photo';
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'error';

export interface SyncQueueItem {
  id: string;
  action: SyncAction;
  entity: SyncEntity;
  entityId: string;
  data: any;
  createdAt: Date;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  status: SyncStatus;
}

export interface SyncBatchRequest {
  items: Array<{
    id: string;
    action: SyncAction;
    entity: SyncEntity;
    data: any;
    timestamp: string;
  }>;
}

export interface SyncBatchResponse {
  results: Array<{
    localId: string;
    serverId?: string;
    status: 'success' | 'conflict' | 'error';
    error?: string;
    serverVersion?: any;
  }>;
}
