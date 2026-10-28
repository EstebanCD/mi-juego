export const TipoEdificio = {
  Palacio: 0,
  Madriguera: 1,
} as const;

export const DATOS_EDIFICIO: Record<
  number,
  { ancho: number; alto: number; hp: number; esDeposito: boolean }
> = {
  [TipoEdificio.Palacio]: { ancho: 2, alto: 2, hp: 500, esDeposito: true },
  [TipoEdificio.Madriguera]: { ancho: 1, alto: 1, hp: 200, esDeposito: true },
};

export interface Edificio {
  id: number;
  tipo: number;
  jugador: number;
  x: number; // esquina superior izquierda (celda)
  y: number;
  ancho: number;
  alto: number;
  hp: number;
  esDeposito: boolean;
}