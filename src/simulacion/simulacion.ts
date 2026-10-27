import { Mapa } from "./mapa";

export const TICKS_POR_SEGUNDO = 10;
export const MS_POR_TICK = 1000 / TICKS_POR_SEGUNDO;

export class Simulacion {
  readonly mapa: Mapa;
  tickActual = 0;

  constructor(mapa: Mapa) {
    this.mapa = mapa;
  }

  // El único sitio donde cambia el estado del juego.
  tick(): void {
    this.tickActual++;
  }
}