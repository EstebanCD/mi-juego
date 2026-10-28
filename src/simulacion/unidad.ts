export const TipoUnidad = {
  Obrera: 0,
} as const;

export const Estado = {
  Libre: 0,
  IrARecurso: 1,
  Recogiendo: 2,
  IrADeposito: 3,
  Entregando: 4,
} as const;

export interface Unidad {
  id: number;
  tipo: number;
  jugador: number;
  x: number; // celda
  y: number; // celda
  hp: number;
  ruta: Array<{ x: number; y: number }>; // celdas pendientes
  espera: number; // ticks hasta el próximo paso
  estado: number; // Estado.*
  cargaAgua: number; // 0 o 1
  cargaArcilla: number; // 0 o 1
  recursoX: number; // celda del recurso asignado
  recursoY: number;
  temporizador: number; // ticks restantes de recogida
}