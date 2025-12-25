export interface CatastroData {
  referenciaCatastral: string;
  direccion: string;
  superficie?: number;
  uso?: string;
  clase?: string;
  municipio?: string;
  provincia?: string;
}

export interface CatastroLookupResponse {
  success: boolean;
  data?: CatastroData;
  error?: string;
}
