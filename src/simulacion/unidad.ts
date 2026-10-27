export const TipoUnidad = {
  Obrera: 0,
} as const;

export interface Unidad {
  id: number;
  tipo: number;
  x: number; // celda
  y: number; // celda
  hp: number;
  ruta: Array<{ x: number; y: number }>; // celdas pendientes
  espera: number; // ticks hasta el próximo paso
}