import { Mapa } from "./mapa";
import { TipoUnidad, type Unidad } from "./unidad";
import { TipoEdificio, DATOS_EDIFICIO, type Edificio } from "./edificio";
import { buscarRuta, pasoValido } from "./rutas";

export const TICKS_POR_SEGUNDO = 10;
export const MS_POR_TICK = 1000 / TICKS_POR_SEGUNDO;
export const TICKS_POR_PASO = 3; // provisional: 1 celda cada 3 ticks
const TICKS_POR_PASO_DIAGONAL = 4; // la diagonal es ~1,4 veces más larga

export interface OrdenMover {
  tipo: "mover";
  unidadId: number;
  x: number;
  y: number;
}
export type Orden = OrdenMover;

export interface Stock {
  agua: number;
  arcilla: number;
  glucosa: number;
}

export class Simulacion {
  readonly mapa: Mapa;
  readonly unidades: Unidad[] = [];
  readonly edificios: Edificio[] = [];
  // Un stock por jugador (0 y 1)
  readonly stock: Stock[] = [
    { agua: 0, arcilla: 0, glucosa: 0 },
    { agua: 0, arcilla: 0, glucosa: 0 },
  ];
  tickActual = 0;
  private siguienteId = 1;
  private ordenes: Orden[] = [];

  constructor(mapa: Mapa) {
    this.mapa = mapa;
  }

  crearUnidad(tipo: number, x: number, y: number, jugador = 0): Unidad {
    const u: Unidad = {
      id: this.siguienteId++,
      tipo,
      jugador,
      x,
      y,
      hp: 20,
      ruta: [],
      espera: 0,
    };
    this.unidades.push(u);
    return u;
  }

  // Devuelve null si alguna celda está fuera del mapa, es agua o ya está ocupada.
  crearEdificio(
    tipo: number,
    jugador: number,
    x: number,
    y: number
  ): Edificio | null {
    const d = DATOS_EDIFICIO[tipo];
    for (let j = 0; j < d.alto; j++) {
      for (let i = 0; i < d.ancho; i++) {
        const cx = x + i;
        const cy = y + j;
        if (!this.mapa.dentro(cx, cy)) return null;
        if (this.mapa.esAgua(cx, cy) || this.mapa.estaBloqueada(cx, cy)) {
          return null;
        }
      }
    }
    for (let j = 0; j < d.alto; j++) {
      for (let i = 0; i < d.ancho; i++) {
        this.mapa.setBloqueada(x + i, y + j, true);
      }
    }
    const e: Edificio = {
      id: this.siguienteId++,
      tipo,
      jugador,
      x,
      y,
      ancho: d.ancho,
      alto: d.alto,
      hp: d.hp,
      esDeposito: d.esDeposito,
    };
    this.edificios.push(e);
    return e;
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
      if (!pasoValido(this.mapa, u.x, u.y, sig.x, sig.y)) {
        const destino = u.ruta[u.ruta.length - 1];
        u.ruta = buscarRuta(this.mapa, u.x, u.y, destino.x, destino.y) ?? [];
        continue;
      }
      const diagonal = sig.x !== u.x && sig.y !== u.y;
      u.x = sig.x;
      u.y = sig.y;
      u.ruta.shift();
      u.espera = (diagonal ? TICKS_POR_PASO_DIAGONAL : TICKS_POR_PASO) - 1;
    }
  }
}

export { TipoUnidad, TipoEdificio };