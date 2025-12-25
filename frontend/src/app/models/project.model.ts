export interface Project {
  id: string;
  name: string;
  description?: string;
  photoCount?: number;
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
}
