export interface MeasurementPoint {
  lat: number;
  lng: number;
}

export interface Measurement {
  id: string;
  type: 'distance' | 'area';
  points: MeasurementPoint[];
  value: number; // metros o m²
  location?: string; // dirección aproximada
  createdAt: string;
  notes?: string;
}
