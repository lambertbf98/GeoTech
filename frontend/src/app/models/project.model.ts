export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ProjectZone {
  id: string;
  name: string;
  description?: string;
  coordinates: GeoPoint[];
  color?: string;
  createdAt: string;
}

export interface ProjectPath {
  id: string;
  name: string;
  description?: string;
  coordinates: GeoPoint[];
  color?: string;
  createdAt: string;
}

export interface ProjectMarker {
  id: string;
  name: string;
  description?: string;
  coordinate: GeoPoint;
  photoIds?: string[];
  aiDescription?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  location?: string;
  coordinates?: GeoPoint;
  photoCount?: number;
  zones?: ProjectZone[];
  paths?: ProjectPath[];
  markers?: ProjectMarker[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  location?: string;
  coordinates?: GeoPoint;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  location?: string;
  zones?: ProjectZone[];
  paths?: ProjectPath[];
  markers?: ProjectMarker[];
  notes?: string;
}
