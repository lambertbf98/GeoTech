import { CatastroData } from './catastro.model';

export interface Photo {
  id: string;
  projectId: string;
  localPath?: string;
  imagePath?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  catastroRef?: string;
  catastroData?: CatastroData;
  aiDescription?: string;
  notes?: string;
  timestamp?: string;
  createdAt?: Date;
  updatedAt?: Date;
  synced: boolean;
}

export interface CreatePhotoDto {
  projectId: string;
  localPath: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  notes?: string;
}

export interface PhotoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}
