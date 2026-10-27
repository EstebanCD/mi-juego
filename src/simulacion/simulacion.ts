import { Mapa } from "./mapa";
import { TipoUnidad, type Unidad } from "./unidad";

export const TICKS_POR_SEGUNDO = 10;
export const MS_POR_TICK = 1000 / TICKS_POR_SEGUNDO;

export class Simulacion {
  readonly mapa: Mapa;
  readonly unidades: Unidad[] = [];
  tickActual = 0;
  private siguienteId = 1;

  constructor(mapa: Mapa) {
    this.mapa = mapa;
  }

  crearUnidad(tipo: number, x: number, y: number): Unidad {
    const u: Unidad = { id: this.siguienteId++, tipo, x, y, hp: 20 };
    this.unidades.push(u);
    return u;
  }

  // El único sitio donde cambia el estado del juego.
  tick(): void {
    this.tickActual++;
  }
}

export { TipoUnidad };