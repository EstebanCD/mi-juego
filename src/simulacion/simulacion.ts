import { Mapa, Terreno, Recurso } from "./mapa";
import { TipoUnidad, Estado, type Unidad } from "./unidad";
import { TipoEdificio, DATOS_EDIFICIO, type Edificio } from "./edificio";
import { buscarRuta, buscarRutaA, pasoValido } from "./rutas";

export const TICKS_POR_SEGUNDO = 10;
export const MS_POR_TICK = 1000 / TICKS_POR_SEGUNDO;
export const TICKS_POR_PASO = 3; // provisional: 1 celda cada 3 ticks
const TICKS_POR_PASO_DIAGONAL = 4; // la diagonal es ~1,4 veces más larga
const TICKS_RECOGIDA = 10; // provisional: 1 segundo
const TICKS_ENTREGA = 5; // 0,5 segundos

export interface OrdenMover {
  tipo: "mover";
  unidadId: number;
  x: number;
  y: number;
}
export interface OrdenRecolectar {
  tipo: "recolectar";
  unidadId: number;
  x: number; // celda de agua o arcilla
  y: number;
}
export type Orden = OrdenMover | OrdenRecolectar;

// Avisos de la simulación para que el cliente los dibuje (no afectan al juego)
export interface EventoEntrega {
  tipo: "entrega";
  unidadId: number;
  edificioId: number;
  agua: number;
  arcilla: number;
}

export interface Stock {
  agua: number;
  arcilla: number;
  glucosa: number;
}

export class Simulacion {
  readonly mapa: Mapa;
  readonly unidades: Unidad[] = [];
  readonly edificios: Edificio[] = [];
  readonly eventos: EventoEntrega[] = [];
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
      estado: Estado.Libre,
      cargaAgua: 0,
      cargaArcilla: 0,
      recursoX: 0,
      recursoY: 0,
      temporizador: 0,
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
    this.actualizarRecoleccion();
    this.moverUnidades();
  }

  // ---- Órdenes ----

  private aplicarOrdenes(): void {
    for (const o of this.ordenes) {
      const u = this.unidades.find((v) => v.id === o.unidadId);
      if (!u) continue;
      if (o.tipo === "mover") {
        const ruta = buscarRuta(this.mapa, u.x, u.y, o.x, o.y);
        u.ruta = ruta ?? [];
        u.espera = 0;
        u.estado = Estado.Libre;
      } else if (o.tipo === "recolectar") {
        if (!this.esRecolectable(o.x, o.y)) continue;
        u.recursoX = o.x;
        u.recursoY = o.y;
        // Si ya lleva ese recurso, va a entregar. Si lleva el otro, va a por
        // este sin soltarlo y entrega los dos juntos.
        const llevaEste = this.mapa.esAgua(o.x, o.y)
          ? u.cargaAgua > 0
          : u.cargaArcilla > 0;
        if (llevaEste) this.irADeposito(u);
        else this.irARecurso(u);
      }
    }
    this.ordenes = [];
  }

  esRecolectable(x: number, y: number): boolean {
    if (!this.mapa.dentro(x, y)) return false;
    if (this.mapa.esAgua(x, y)) return true;
    return (
      this.mapa.getRecurso(x, y) === Recurso.Arcilla &&
      this.mapa.getCantidad(x, y) > 0
    );
  }

  // ---- Ciclo de recolección ----

  private esAdyacente(x: number, y: number, rx: number, ry: number): boolean {
    return Math.max(Math.abs(x - rx), Math.abs(y - ry)) === 1;
  }

  private irARecurso(u: Unidad): void {
    // Celda transitable al lado del recurso (el agua o la arcilla no se pisan)
    const ruta = buscarRutaA(
      this.mapa,
      u.x,
      u.y,
      (x, y) =>
        this.esAdyacente(x, y, u.recursoX, u.recursoY) &&
        !this.mapa.esAgua(x, y)
    );
    if (ruta === null) {
      u.estado = Estado.Libre;
      u.ruta = [];
      return;
    }
    u.ruta = ruta;
    u.espera = 0;
    u.estado = Estado.IrARecurso;
  }

  private depositosDe(jugador: number): Edificio[] {
    return this.edificios.filter((e) => e.esDeposito && e.jugador === jugador);
  }

  private irADeposito(u: Unidad): void {
    const depositos = this.depositosDe(u.jugador);
    if (depositos.length === 0) {
      u.estado = Estado.Libre;
      u.ruta = [];
      return;
    }
    const ruta = buscarRutaA(this.mapa, u.x, u.y, (x, y) =>
      depositos.some((e) => this.adyacenteAEdificio(x, y, e))
    );
    if (ruta === null) {
      u.estado = Estado.Libre;
      u.ruta = [];
      return;
    }
    u.ruta = ruta;
    u.espera = 0;
    u.estado = Estado.IrADeposito;
  }

  private adyacenteAEdificio(x: number, y: number, e: Edificio): boolean {
    return (
      x >= e.x - 1 &&
      x <= e.x + e.ancho &&
      y >= e.y - 1 &&
      y <= e.y + e.alto &&
      !(x >= e.x && x < e.x + e.ancho && y >= e.y && y < e.y + e.alto)
    );
  }

    private actualizarRecoleccion(): void {
    for (const u of this.unidades) {
      if (u.estado === Estado.IrARecurso && u.ruta.length === 0) {
        if (!this.esRecolectable(u.recursoX, u.recursoY)) {
          u.estado = Estado.Libre; // la arcilla se agotó
        } else {
          u.estado = Estado.Recogiendo;
          u.temporizador = TICKS_RECOGIDA;
        }
      } else if (u.estado === Estado.Recogiendo) {
        u.temporizador--;
        if (u.temporizador > 0) continue;
        this.recogerRecurso(u);
      } else if (u.estado === Estado.IrADeposito && u.ruta.length === 0) {
        u.estado = Estado.Entregando;
        u.temporizador = TICKS_ENTREGA;
      } else if (u.estado === Estado.Entregando) {
        u.temporizador--;
        if (u.temporizador > 0) continue;
        this.entregar(u);
      }
    }
  }

  private recogerRecurso(u: Unidad): void {
    const { recursoX: rx, recursoY: ry } = u;
    if (this.mapa.esAgua(rx, ry)) {
      u.cargaAgua = 1;
    } else if (this.esRecolectable(rx, ry)) {
      u.cargaArcilla = 1;
      const restante = this.mapa.getCantidad(rx, ry) - 1;
      if (restante <= 0) this.mapa.setRecurso(rx, ry, Recurso.Ninguno, 0);
      else this.mapa.setRecurso(rx, ry, Recurso.Arcilla, restante);
    } else {
      u.estado = Estado.Libre; // se agotó mientras recogía
      return;
    }
    this.irADeposito(u);
  }

  private entregar(u: Unidad): void {
    // Debe estar pegada a un depósito; si no, busca otra ruta
    const deposito = this.depositosDe(u.jugador).find((e) =>
      this.adyacenteAEdificio(u.x, u.y, e)
    );
    if (!deposito) {
      this.irADeposito(u);
      return;
    }
    const s = this.stock[u.jugador];
    s.agua += u.cargaAgua;
    s.arcilla += u.cargaArcilla;
    this.eventos.push({
      tipo: "entrega",
      unidadId: u.id,
      edificioId: deposito.id,
      agua: u.cargaAgua,
      arcilla: u.cargaArcilla,
    });
    u.cargaAgua = 0;
    u.cargaArcilla = 0;
    // Vuelve al mismo recurso si sigue disponible
    if (this.esRecolectable(u.recursoX, u.recursoY)) this.irARecurso(u);
    else u.estado = Estado.Libre;
  }

  // ---- Movimiento ----

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

export { TipoUnidad, TipoEdificio, Terreno };