import { Mapa } from "./mapa";
import { TipoUnidad, type Unidad } from "./unidad";
import { buscarRuta } from "./rutas";

export const TICKS_POR_SEGUNDO = 10;
export const MS_POR_TICK = 1000 / TICKS_POR_SEGUNDO;
const TICKS_POR_PASO = 3; // provisional: 1 celda cada 3 ticks

export interface OrdenMover {
  tipo: "mover";
  unidadId: number;
  x: number;
  y: number;
}
export type Orden = OrdenMover;

export class Simulacion {
  readonly mapa: Mapa;
  readonly unidades: Unidad[] = [];
  tickActual = 0;
  private siguienteId = 1;
  private ordenes: Orden[] = [];

  constructor(mapa: Mapa) {
    this.mapa = mapa;
  }

  crearUnidad(tipo: number, x: number, y: number): Unidad {
    const u: Unidad = {
      id: this.siguienteId++,
      tipo,
      x,
      y,
      hp: 20,
      ruta: [],
      espera: 0,
    };
    this.unidades.push(u);
    return u;
  }

  // El cliente llama a esto; la orden se aplica al inicio del siguiente tick.
  enviarOrden(orden: Orden): void {
    this.ordenes.push(orden);
  }

  // El único sitio donde cambia el estado del juego.
  tick(): void {
    this.tickActual++;
    this.aplicarOrdenes();
    this.moverUnidades();
  }

  private aplicarOrdenes(): void {
    for (const o of this.ordenes) {
      const u = this.unidades.find((v) => v.id === o.unidadId);
      if (!u) continue;
      const ruta = buscarRuta(this.mapa, u.x, u.y, o.x, o.y);
      u.ruta = ruta ?? [];
      u.espera = 0;
    }
    this.ordenes = [];
  }

  private moverUnidades(): void {
    for (const u of this.unidades) {
      if (u.ruta.length === 0) continue;
      if (u.espera > 0) {
        u.espera--;
        continue;
      }
      const sig = u.ruta[0];
      // El terreno puede haber cambiado: si ya no se puede pasar, recalcula.
      if (!this.mapa.puedePasar(u.x, u.y, sig.x, sig.y)) {
        const destino = u.ruta[u.ruta.length - 1];
        u.ruta = buscarRuta(this.mapa, u.x, u.y, destino.x, destino.y) ?? [];
        continue;
      }
      u.x = sig.x;
      u.y = sig.y;
      u.ruta.shift();
      u.espera = TICKS_POR_PASO - 1;
    }
  }
}

export { TipoUnidad };