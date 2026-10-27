export const TipoUnidad = {
  Obrera: 0,
} as const;

export interface Unidad {
  id: number;
  tipo: number;
  x: number; // celda
  y: number; // celda
  hp: number;
}