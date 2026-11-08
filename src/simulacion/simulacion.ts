import { Mapa, Terreno, Recurso } from "./mapa";
import { DATOS_UNIDAD, TipoUnidad, Estado, type ObjetivoCombate, type Unidad } from "./unidad";
import { TipoEdificio, DATOS_EDIFICIO, EDIFICIOS_CONSTRUIBLES_POR_OBRERA, type Edificio } from "./edificio";
import type { Cadaver } from "./cadaver";
import { buscarRuta, buscarRutaA, pasoValido } from "./rutas";

export const TICKS_POR_SEGUNDO = 10;
export const MS_POR_TICK = 1000 / TICKS_POR_SEGUNDO;
export const TICKS_POR_PASO = 3; // provisional: 1 celda cada 3 ticks
const TICKS_POR_PASO_DIAGONAL = 4; // la diagonal es ~1,4 veces más larga
const TICKS_RECOGIDA = 10; // provisional: 1 segundo
const TICKS_ENTREGA = 5; // 0,5 segundos
const TICKS_RECOGIDA_NECTAR = 5; // 0,5 segundos
const TICKS_RECOGIDA_FLOR_PULGON = 20; // 2 segundos
const TICKS_ENTRE_ATAQUES = 10; // 1 ataque por segundo
export const ATAQUES_POR_SEGUNDO = TICKS_POR_SEGUNDO / TICKS_ENTRE_ATAQUES;
const TICKS_CADAVER = 600;
const DEBUG_SPAWN_UNIDADES = false;
const DEBUG_ATAQUE_ENEMIGO = false;
const RADIO_CADAVER = 1;
const RADIO_BUSQUEDA_OBRA = 8;
const TICKS_EXPOSICION_CADAVER = 30;
const TICKS_CURACION_ENFERMEDAD = 30;
const TICKS_ENTRE_CONTAGIOS = TICKS_POR_SEGUNDO;
const CONSTRUCCION_HP_POR_SEGUNDO = 5;
const REPARACION_EDIFICIO_HP_POR_SEGUNDO = 4;
const PROB_INFECCION_AL_CARGAR_CADAVER = 0.65;
export const TICKS_DOMESTICACION_PULGON = 100;
const MAX_CELDAS_ARRASTRE = 40;
const DATOS_CADAVER: Record<number, { intervalo: number; dano: number }> = {
  1: { intervalo: 20, dano: 2 },
  2: { intervalo: 20, dano: 3 },
  3: { intervalo: 30, dano: 8 },
};

export interface OrdenMover {
  tipo: "mover";
  unidadId: number;
  x: number;
  y: number;
  jugador?: number;
}
export interface OrdenRecolectar {
  tipo: "recolectar";
  unidadId: number;
  x: number; // celda del recurso (flor, agua, arcilla)
  y: number;
  posX?: number; // celda opcional donde la unidad debe quedarse a recoger
  posY?: number;
  jugador?: number;
}
export interface OrdenAtacar {
  tipo: "atacar";
  unidadId?: number;
  edificioId?: number;
  objetivo: ObjetivoCombate;
  jugador?: number;
}
export interface OrdenCurarEnfermedad {
  tipo: "curarEnfermedad";
  unidadId: number;
  objetivoId: number;
  jugador?: number;
}
export interface OrdenCargarNectar {
  tipo: "cargarNectar";
  unidadId: number;
  pulgonId: number;
  jugador?: number;
}
export interface OrdenRepararEdificio {
  tipo: "repararEdificio";
  unidadId: number;
  edificioId: number;
  jugador?: number;
}
export interface OrdenConstruir {
  tipo: "construir";
  unidadId: number;
  edificioTipo: number;
  x: number;
  y: number;
  jugador?: number;
}
export interface OrdenConstruirLinea {
  tipo: "construirLinea";
  unidadIds: number[];
  edificioTipo: number;
  celdas: Array<{ x: number; y: number }>;
  jugador?: number;
}
export interface OrdenDomesticar {
  tipo: "domesticar";
  unidadId: number;
  objetivoId: number;
  jugador?: number;
}
export interface OrdenCargarCadaver {
  tipo: "cargarCadaver";
  unidadId: number;
  cadaverId: number;
  jugador?: number;
}
export interface OrdenSoltarCadaver {
  tipo: "soltarCadaver";
  unidadId: number;
  x: number;
  y: number;
  jugador?: number;
}
export interface OrdenProducir {
  tipo: "producir";
  edificioId: number;
  tipoUnidad: number;
  jugador?: number;
}
export interface OrdenCancelarProduccion {
  tipo: "cancelarProduccion";
  edificioId: number;
  indice: number;
  itemId?: number; // si se indica, tiene prioridad sobre `indice`
  jugador?: number;
}
export type Orden = OrdenMover | OrdenRecolectar | OrdenAtacar | OrdenCurarEnfermedad | OrdenCargarNectar | OrdenRepararEdificio | OrdenConstruir | OrdenConstruirLinea | OrdenDomesticar | OrdenCargarCadaver | OrdenSoltarCadaver | OrdenProducir | OrdenCancelarProduccion;

// Avisos de la simulación para que el cliente los dibuje (no afectan al juego)
export interface EventoEntrega {
  tipo: "entrega";
  unidadId: number;
  edificioId: number;
  agua: number;
  arcilla: number;
  nectar?: number;
}

export interface EventoNotificacion {
  tipo: "notificacion";
  mensaje: string;
}

export interface EventoAtaque {
  tipo: "ataque";
  atacanteId: number;
  objetivo: ObjetivoCombate;
  dano: number;
}

export interface EventoCuracion {
  tipo: "curacion";
  unidadId: number;
  cantidad: number;
  origenId?: number;
}

export interface EventoConstruccion {
  tipo: "construccion";
  edificioId: number;
  cantidad: number;
}

export interface EventoError {
  tipo: "error";
  mensaje: string;
}

export interface EventoPodredumbre {
  tipo: "podredumbre";
  cadaverId?: number;
  unidadId: number;
  dano: number;
}

export interface EventoEnfermedadCurada {
  tipo: "enfermedadCurada";
  unidadId: number;
  origenId: number;
}


export interface Stock {
  agua: number;
  arcilla: number;
  nectar: number;
}

export class Simulacion {
  private siguienteIdCola = 1;
  readonly mapa: Mapa;
  readonly unidades: Unidad[] = [];
  readonly edificios: Edificio[] = [];
  readonly eventos: Array<EventoEntrega | EventoNotificacion | EventoAtaque | EventoCuracion | EventoConstruccion | EventoError | EventoPodredumbre | EventoEnfermedadCurada> = [];
  readonly cadaveres: Cadaver[] = [];
  // Un stock por jugador (0 y 1)
  readonly stock: Stock[] = [
    { agua: 0, arcilla: 0, nectar: 0 },
    { agua: 0, arcilla: 0, nectar: 0 },
  ];
  tickActual = 0;
  esDeNoche = false;
  private siguienteId = 1;
  private ordenes: Orden[] = [];
  private curacionesBloqueadasAvisadas = new Set<number>();
  private curacionesAphidAcumuladas = new Map<number, Map<number, number>>();
  private exposicionCadaveres = new Map<number, Map<number, number>>();
  private destinosCargaCadaver = new Map<number, { id: number; x: number; y: number }>();
  private destinosSoltarCadaver = new Map<number, { x: number; y: number }>();
  private fallosRuta = new Map<number, number>();
  private construccionAcumulada = new Map<number, number>();
  private asignacionConstruccionTick = new Map<number, number>();
  private ultimoErrorRecurso = new Map<string, number>();
  private estadoAleatorio: number;
  private ataqueInicialProgramado: {
    jugadorAtacante: number;
    jugadorObjetivo: number;
    objetivoId: number;
    unidadIds: number[];
  } | null = null;
  private ataqueInicialEmitido = false;

  constructor(mapa: Mapa, semilla = 0x6d2b79f5) {
    this.mapa = mapa;
    this.estadoAleatorio = semilla >>> 0;
    this.stock[0] = { agua: 999, arcilla: 999, nectar: 999 };
    this.stock[1] = { agua: 999, arcilla: 999, nectar: 999 };
    this.crearPulgonesGaia();
  }

  private esCeldaValidaParaUnidad(x: number, y: number, ignoraTerreno = false): boolean {
    if (!this.mapa.dentro(x, y)) return false;
    if (!ignoraTerreno && this.mapa.esAgua(x, y)) return false;
    if (this.mapa.estaBloqueada(x, y)) return false;
    if (this.edificios.some((edificio) => x >= edificio.x && x < edificio.x + edificio.ancho && y >= edificio.y && y < edificio.y + edificio.alto)) {
      return false;
    }
    if (this.unidades.some((unidad) => unidad.x === x && unidad.y === y)) {
      return false;
    }
    return true;
  }

  private obtenerCeldasSpawnBase(origenX: number, origenY: number, cantidad: number, ignoraTerreno = false): Array<{ x: number; y: number }> {
    const candidatos: Array<{ x: number; y: number }> = [];
    const vistos = new Set<string>();
    for (let radio = 1; radio <= 12; radio++) {
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          if (Math.abs(dx) !== radio && Math.abs(dy) !== radio) continue;
          const x = origenX + dx;
          const y = origenY + dy;
          if (x === origenX && y === origenY) continue;
          if (!this.esCeldaValidaParaUnidad(x, y, ignoraTerreno)) continue;
          const clave = `${x},${y}`;
          if (vistos.has(clave)) continue;
          vistos.add(clave);
          candidatos.push({ x, y });
          if (candidatos.length >= cantidad) return candidatos;
        }
      }
    }
    return candidatos;
  }

  crearBaseInicial(
    jugador: number,
    origenX: number,
    origenY: number,
    unidadesExtra: number[] = [],
    jugadorObjetivo?: number
  ): { reina: Edificio | null; unidades: Unidad[] } {
    const reina = this.crearEdificio(TipoEdificio.Reina, jugador, origenX, origenY);
    if (!reina) {
      return { reina: null, unidades: [] };
    }

    const unidades: Unidad[] = [
      this.crearUnidad(TipoUnidad.Obrera, origenX + 2, origenY - 5, jugador),
      this.crearUnidad(TipoUnidad.Obrera, origenX + 3, origenY - 5, jugador),
      this.crearUnidad(TipoUnidad.Obrera, origenX + 4, origenY - 5, jugador),
      this.crearUnidad(TipoUnidad.Pulgones, origenX + 6, origenY - 5, jugador),
    ];

    const posicionesExtra = this.obtenerCeldasSpawnBase(origenX, origenY, unidadesExtra.length, true);
    for (let index = 0; index < unidadesExtra.length; index++) {
      const tipo = unidadesExtra[index];
      if (!DATOS_UNIDAD[tipo]) continue;
      const pos = posicionesExtra[index] ?? { x: origenX + 8 + index * 2, y: origenY - 5 };
      unidades.push(this.crearUnidad(tipo, pos.x, pos.y, jugador));
    }

    this.stock[jugador].agua = Math.max(this.stock[jugador].agua, 999);
    this.stock[jugador].arcilla = Math.max(this.stock[jugador].arcilla, 999);
    this.stock[jugador].nectar = Math.max(this.stock[jugador].nectar, 999);

    if (jugadorObjetivo !== undefined && jugadorObjetivo !== jugador) {
      this.programarAtaqueInicial(jugador, jugadorObjetivo);
    }

    if (DEBUG_SPAWN_UNIDADES) {
      console.log(`[sim] base ${jugador} creada: reina=(${reina.x},${reina.y}) unidades=${unidades.length} extras=${unidadesExtra.length}`);
      for (const unidad of unidades) {
        console.log(`[sim] spawn ${unidad.id} tipo=${unidad.tipo} jugador=${unidad.jugador} pos=(${unidad.x},${unidad.y})`);
      }
    }
    return { reina, unidades };
  }

  private programarAtaqueInicial(jugadorAtacante: number, jugadorObjetivo: number): void {
    const objetivo = this.edificios.find((edificio) => edificio.jugador === jugadorObjetivo && edificio.tipo === TipoEdificio.Reina)
      ?? this.edificios.find((edificio) => edificio.jugador === jugadorObjetivo);
    if (!objetivo) return;
    const tiposAtaque = new Set<number>([TipoUnidad.Guerrera, TipoUnidad.Voladora, TipoUnidad.GuerreraVoladora]);
    const ids = this.unidades.filter(
      (unidad) => unidad.jugador === jugadorAtacante && tiposAtaque.has(unidad.tipo)
    ).map((unidad) => unidad.id);
    if (ids.length === 0) return;
    this.ataqueInicialProgramado = {
      jugadorAtacante,
      jugadorObjetivo,
      objetivoId: objetivo.id,
      unidadIds: ids,
    };
    if (DEBUG_ATAQUE_ENEMIGO) {
      console.log(`[sim] ataque programado: jugador=${jugadorAtacante} objetivo=${jugadorObjetivo} ids=${ids.join(",")}`);
    }
  }

  private emitirAtaqueInicialProgramado(): void {
    const plan = this.ataqueInicialProgramado;
    if (!plan || this.ataqueInicialEmitido) return;
    const objetivo = this.edificios.find((edificio) => edificio.id === plan.objetivoId && edificio.jugador === plan.jugadorObjetivo);
    if (!objetivo) {
      this.ataqueInicialProgramado = null;
      return;
    }
    const ids = plan.unidadIds.filter((id) => this.unidades.some((unidad) => unidad.id === id && unidad.hp > 0 && unidad.jugador === plan.jugadorAtacante));
    if (ids.length === 0) {
      this.ataqueInicialProgramado = null;
      return;
    }
    for (const id of ids) {
      this.ordenes.push({
        tipo: "atacar",
        unidadId: id,
        objetivo: { tipo: "edificio", id: objetivo.id },
        jugador: plan.jugadorAtacante,
      });
    }
    if (DEBUG_ATAQUE_ENEMIGO) {
      console.log(`[sim] ataque emitido: ids=${ids.join(",")} target=${objetivo.id} tipo=${objetivo.tipo}`);
    }
    this.ataqueInicialProgramado = null;
    this.ataqueInicialEmitido = true;
  }

  private siguienteAleatorio(): number {
    this.estadoAleatorio = (this.estadoAleatorio * 1664525 + 1013904223) >>> 0;
    return this.estadoAleatorio / 0x100000000;
  }

  private agotarCelda(x: number, y: number): void {
    if (!this.mapa.dentro(x, y)) return;
    this.mapa.setRecurso(x, y, Recurso.Ninguno, 0);
    this.mapa.setTerreno(x, y, Terreno.Normal);
  }

  private crearPulgonesGaia(): void {
    const visitadas = new Uint8Array(this.mapa.ancho * this.mapa.alto);
    const posicionesUsadas = new Set<number>();
    const vecinos: ReadonlyArray<readonly [number, number]> = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];

    for (let y = 0; y < this.mapa.alto; y++) {
      for (let x = 0; x < this.mapa.ancho; x++) {
        const indice = y * this.mapa.ancho + x;
        if (visitadas[indice] || this.mapa.getRecurso(x, y) !== Recurso.Flor) continue;

        const grupo: Array<{ x: number; y: number }> = [];
        const cola = [{ x, y }];
        visitadas[indice] = 1;
        for (let i = 0; i < cola.length; i++) {
          const celda = cola[i];
          grupo.push(celda);
          for (const [dx, dy] of vecinos) {
            const nx = celda.x + dx;
            const ny = celda.y + dy;
            if (!this.mapa.dentro(nx, ny) || this.mapa.getRecurso(nx, ny) !== Recurso.Flor) continue;
            const ni = ny * this.mapa.ancho + nx;
            if (visitadas[ni]) continue;
            visitadas[ni] = 1;
            cola.push({ x: nx, y: ny });
          }
        }

        const candidatos: Array<{ x: number; y: number; distancia: number }> = [];
        const vistosCandidato = new Set<number>();
        for (const flor of grupo) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = flor.x + dx;
              const ny = flor.y + dy;
              if (!this.mapa.dentro(nx, ny) || this.mapa.esAgua(nx, ny)) continue;
              if (this.mapa.getRecurso(nx, ny) === Recurso.Flor) continue;
              const ni = ny * this.mapa.ancho + nx;
              if (vistosCandidato.has(ni) || posicionesUsadas.has(ni)) continue;
              vistosCandidato.add(ni);
              candidatos.push({ x: nx, y: ny, distancia: Math.min(Math.abs(dx), Math.abs(dy)) });
            }
          }
        }
        candidatos.sort((a, b) => a.y - b.y || a.x - b.x);

        let creados = 0;
        for (const candidato of candidatos) {
          const pos = candidato.y * this.mapa.ancho + candidato.x;
          if (posicionesUsadas.has(pos)) continue;
          posicionesUsadas.add(pos);
          this.crearUnidad(TipoUnidad.Pulgones, candidato.x, candidato.y, -1);
          creados++;
          if (creados >= 5) break;
        }
      }
    }
  }

  crearUnidad(tipo: number, x: number, y: number, jugador = 0): Unidad {
    let posX = Math.round(x);
    let posY = Math.round(y);
    if (!this.mapa.dentro(posX, posY)) {
      const antiguaX = posX;
      const antiguaY = posY;
      posX = Math.min(Math.max(posX, 0), this.mapa.ancho - 1);
      posY = Math.min(Math.max(posY, 0), this.mapa.alto - 1);
      if (DEBUG_SPAWN_UNIDADES) {
        console.warn(`[sim] unidad creada fuera de mapa: tipo=${tipo} jugador=${jugador} (${antiguaX},${antiguaY}) -> (${posX},${posY})`);
      }
    }

    const u: Unidad = {
      id: this.siguienteId++,
      tipo,
      jugador,
      x: posX,
      y: posY,
      hp: DATOS_UNIDAD[tipo]?.hp ?? 20,
      ruta: [],
      espera: 0,
      estado: Estado.Libre,
      cargaAgua: 0,
      cargaArcilla: 0,
      cargaNectar: 0,
      recursoX: 0,
      recursoY: 0,
      recursoStandX: 0,
      recursoStandY: 0,
      cadaverCargado: null,
      objetivoNectarId: null,
      temporizador: 0,
      objetivoCombate: null,
      temporizadorAtaque: 0,
      enfermedadViral: false,
      nivelEnfermedad: 0,
      temporizadorEnfermedad: 0,
      temporizadorContagio: TICKS_ENTRE_CONTAGIOS,
      curandoUnidadId: null,
      temporizadorCuracion: 0,
      objetivoReparacionId: null,
      objetivoDomesticacionId: null,
      temporizadorDomesticacion: 0,
      reintentoRutaTick: 0,
      bloqueadaPorRecurso: false,
    };
    this.unidades.push(u);
    return u;
  }

  private puedeColocarEdificio(tipo: number, x: number, y: number): boolean {
    const d = DATOS_EDIFICIO[tipo];
    if (!d) return false;
    for (let j = 0; j < d.alto; j++) {
      for (let i = 0; i < d.ancho; i++) {
        const cx = x + i;
        const cy = y + j;
        if (!this.mapa.dentro(cx, cy)) return false;
        if (this.mapa.esAgua(cx, cy)) return false;
        if (this.mapa.estaBloqueada(cx, cy)) return false;
        const overlapsExisting = this.edificios.some((otro) => {
          return cx >= otro.x && cx < otro.x + otro.ancho && cy >= otro.y && cy < otro.y + otro.alto;
        });
        if (overlapsExisting) return false;
      }
    }
    return true;
  }

  // Devuelve null si alguna celda está fuera del mapa, es agua o ya está ocupada.
  crearEdificio(
    tipo: number,
    jugador: number,
    x: number,
    y: number,
    enConstruccion = false
  ): Edificio | null {
    const d = DATOS_EDIFICIO[tipo];
    if (!d || !this.puedeColocarEdificio(tipo, x, y)) return null;
    for (let j = 0; j < d.alto; j++) {
      for (let i = 0; i < d.ancho; i++) {
        // La reina permite que las unidades caminen sobre ella (es transitable),
        // pero sigue ocupando footprint para impedir solapamientos con otros edificios.
        if (tipo !== TipoEdificio.Reina) {
          this.mapa.setBloqueada(x + i, y + j, true);
        }
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
      hp: enConstruccion ? 1 : d.hp,
      esDeposito: d.esDeposito,
      enConstruccion,
      temporizadorAtaque: 0,
      objetivoCombate: null,
      cola: [],
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
    if (this.tickActual >= 10000) {
      this.esDeNoche = true;
    }
    if (!this.ataqueInicialEmitido) {
      this.emitirAtaqueInicialProgramado();
    }
    if (DEBUG_ATAQUE_ENEMIGO && this.tickActual === 60) {
      const tiposAtaque = new Set<number>([TipoUnidad.Guerrera, TipoUnidad.Voladora, TipoUnidad.GuerreraVoladora]);
      const unidadesEnemigas = this.unidades.filter((u) => u.jugador === 1 && tiposAtaque.has(u.tipo));
      if (unidadesEnemigas.length > 0) {
        const objetivo = this.edificios.find((e) => e.jugador === 0 && e.tipo === TipoEdificio.Reina) ?? this.edificios.find((e) => e.jugador === 0);
        if (objetivo) {
          const promedio = unidadesEnemigas.reduce((suma, u) => suma + Math.max(Math.abs(u.x - objetivo.x), Math.abs(u.y - objetivo.y)), 0) / unidadesEnemigas.length;
          console.log(`[sim] distancia promedio enemigo a objetivo en tick 60: ${promedio}`);
        }
      }
    }
    this.aplicarOrdenes();
    this.actualizarProduccionEdificios();
    this.actualizarRecoleccion();
    this.moverUnidades();
    this.actualizarCadaveresTransportados();
    this.actualizarDomesticacion();
    this.actualizarReparacionesEdificios();
    this.actualizarRegeneracion();
    this.actualizarCuracionEnfermedad();
    this.actualizarCombate();
    this.eliminarMuertos();
    this.actualizarEnfermedad();
    this.actualizarCadaveres();
    this.actualizarContagio();
    this.vaciarEventosConstruccion();
  }

  private vaciarEventosConstruccion(): void {
    if (this.tickActual % TICKS_POR_SEGUNDO !== 0) return;
    for (const [edificioId, cantidad] of this.construccionAcumulada) {
      if (cantidad <= 0) continue;
      this.eventos.push({ tipo: "construccion", edificioId, cantidad });
    }
    this.construccionAcumulada.clear();
  }

  private buscarCeldaLibreAlrededor(edificio: Edificio): { x: number; y: number } | null {
    const radioMax = 3;
    for (let radio = 0; radio <= radioMax; radio++) {
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          if (Math.abs(dx) !== radio && Math.abs(dy) !== radio) continue;
          const cx = edificio.x + dx;
          const cy = edificio.y + dy;
          if (!this.mapa.dentro(cx, cy)) continue;
          if (this.mapa.esAgua(cx, cy)) continue;
          if (this.mapa.estaBloqueada(cx, cy)) continue;
          if (cx >= edificio.x && cx < edificio.x + edificio.ancho && cy >= edificio.y && cy < edificio.y + edificio.alto) continue;
          if (this.edificios.some((otro) => {
            if (otro.id === edificio.id) return false;
            return cx >= otro.x && cx < otro.x + otro.ancho && cy >= otro.y && cy < otro.y + otro.alto;
          })) continue;
          return { x: cx, y: cy };
        }
      }
    }
    return null;
  }

  private actualizarProduccionEdificios(): void {
    for (const ed of this.edificios) {
      if (ed.enConstruccion || !ed.cola || ed.cola.length === 0) continue;
      const item = ed.cola[0];
      if (item.ticksRestantes > 0) {
        item.ticksRestantes--;
        if (item.ticksRestantes > 0) continue;
      }

      let spawn: { x: number; y: number } | null = null;
      if (item.esUnidad) {
        spawn = this.buscarCeldaLibreAlrededor(ed);
      } else {
        const base = DATOS_EDIFICIO[item.tipo];
        if (base) {
          for (let radio = 0; radio <= 3; radio++) {
            for (let dy = -radio; dy <= radio; dy++) {
              for (let dx = -radio; dx <= radio; dx++) {
                if (Math.abs(dx) !== radio && Math.abs(dy) !== radio) continue;
                const cx = ed.x + dx;
                const cy = ed.y + dy;
                const creado = this.crearEdificio(item.tipo, ed.jugador, cx, cy);
                if (creado) {
                  spawn = { x: cx, y: cy };
                  break;
                }
              }
              if (spawn) break;
            }
            if (spawn) break;
          }
        }
      }

      if (!spawn) {
        if (item.ticksRestantes !== -1) {
          item.ticksRestantes = -1;
          this.eventos.push({ tipo: "error", mensaje: "No free space to spawn" });
        }
        continue;
      }

      if (item.esUnidad) {
        const nuevaU = this.crearUnidad(item.tipo, spawn.x, spawn.y, ed.jugador);
        if (ed.puntoRendezvousX !== undefined && ed.puntoRendezvousY !== undefined) {
          this.aplicarOrdenRendezvous(nuevaU, ed);
        }
        const nombresUnidades = ["Ant Worker", "Guerrera", "Voladora", "Guerrera Voladora", "Pulgones", "Reina", "Reina Joven"];
        const nombreU = nombresUnidades[item.tipo] || "Unidad";
        this.eventos.push({
          tipo: "notificacion",
          mensaje: `A new unit, ${nombreU}, has been created.`,
        });
      } else {
        const nombreEd = DATOS_EDIFICIO[item.tipo]?.nombre || "Edificio";
        this.eventos.push({
          tipo: "notificacion",
          mensaje: `A new building, ${nombreEd}, has been created.`,
        });
      }
      ed.cola.shift();
    }
  }

  private normalizarCantidadRecurso(valor: number): number {
    if (!Number.isFinite(valor)) return 0;
    return Math.max(0, valor);
  }

  private emitirErrorRecurso(jugador: number, recurso: keyof Stock, mensaje = `Not enough ${recurso}.`): void {
    const tickUltimo = this.tickActual;
    const clave = `${jugador}:${recurso}`;
    if ((this.ultimoErrorRecurso.get(clave) ?? -Infinity) + 10 > tickUltimo) {
      return;
    }
    this.ultimoErrorRecurso.set(clave, tickUltimo);
    this.eventos.push({ tipo: "error", mensaje });
  }

  puedePagar(jugador: number, coste: Partial<Record<keyof Stock, number>>): boolean {
    const stock = this.stock[jugador];
    if (!stock) return false;
    return (
      this.normalizarCantidadRecurso(stock.agua) >= this.normalizarCantidadRecurso(coste.agua ?? 0) &&
      this.normalizarCantidadRecurso(stock.arcilla) >= this.normalizarCantidadRecurso(coste.arcilla ?? 0) &&
      this.normalizarCantidadRecurso(stock.nectar) >= this.normalizarCantidadRecurso(coste.nectar ?? 0)
    );
  }

  gastar(jugador: number, coste: Partial<Record<keyof Stock, number>>): boolean {
    if (!this.puedePagar(jugador, coste)) return false;
    const stock = this.stock[jugador];
    stock.agua = this.normalizarCantidadRecurso(stock.agua - this.normalizarCantidadRecurso(coste.agua ?? 0));
    stock.arcilla = this.normalizarCantidadRecurso(stock.arcilla - this.normalizarCantidadRecurso(coste.arcilla ?? 0));
    stock.nectar = this.normalizarCantidadRecurso(stock.nectar - this.normalizarCantidadRecurso(coste.nectar ?? 0));
    return true;
  }

  anadir(jugador: number, recurso: keyof Stock, cantidad: number): void {
    const valor = Number.isFinite(cantidad) ? cantidad : 0;
    if (valor <= 0) return;
    const stock = this.stock[jugador];
    if (!stock) return;
    stock[recurso] = this.normalizarCantidadRecurso(stock[recurso] + valor);
  }

  private reembolsarProduccion(edificio: Edificio, indice: number): void {
    const item = edificio.cola[indice];
    if (!item) return;
    this.anadir(edificio.jugador, "agua", item.costeAgua);
    this.anadir(edificio.jugador, "arcilla", item.costeArcilla);
    this.anadir(edificio.jugador, "nectar", item.costeNectar);
    edificio.cola.splice(indice, 1);
  }

  private aplicarOrdenRendezvous(u: Unidad, edificio: Edificio): void {
    const x = edificio.puntoRendezvousX;
    const y = edificio.puntoRendezvousY;
    if (x === undefined || y === undefined) return;
    const pulgonNeutral = this.unidades.find(
      (unidad) =>
        unidad.tipo === TipoUnidad.Pulgones &&
        unidad.jugador < 0 &&
        unidad.x === x &&
        unidad.y === y
    );
    if (u.tipo === TipoUnidad.Obrera && pulgonNeutral) {
      const objetivo = this.elegirObjetivoDomesticacion(pulgonNeutral, u.id);
      if (objetivo) {
        this.asignarDomesticacion(u, objetivo);
      }
      return;
    }

    const enemigo = this.objetivoEnCelda(x, y, u.jugador);
    if (enemigo && (DATOS_UNIDAD[u.tipo]?.atk ?? 0) > 0) {
      const entidad = this.obtenerObjetivo(enemigo);
      if (entidad) {
        u.objetivoCombate = enemigo;
        u.temporizadorAtaque = 0;
        u.estado = Estado.Atacando;
        this.prepararRutaAtaque(u, entidad);
        return;
      }
    }

    if (u.tipo === TipoUnidad.Obrera) {
      const edificioObjetivo = this.edificios.find(
        (edificio) =>
          edificio.enConstruccion &&
          edificio.jugador === u.jugador &&
          x >= edificio.x &&
          x < edificio.x + edificio.ancho &&
          y >= edificio.y &&
          y < edificio.y + edificio.alto
      );
      if (edificioObjetivo) {
        u.objetivoReparacionId = edificioObjetivo.id;
        u.estado = Estado.Construyendo;
        u.ruta = buscarRutaA(this.mapa, u.x, u.y, (cx, cy) => this.adyacenteAEdificio(cx, cy, edificioObjetivo)) ?? [];
        this.asignacionConstruccionTick.set(u.id, this.tickActual);
        return;
      }
    }

    const aliado = this.unidades.find(
      (unidad) => unidad.jugador === u.jugador && unidad.x === x && unidad.y === y && unidad.id !== u.id
    );
    if (u.tipo === TipoUnidad.Pulgones && aliado && this.unidadNecesitaCuracion(aliado)) {
      if (aliado.enfermedadViral) {
        u.curandoUnidadId = aliado.id;
      }
      const ruta = buscarRutaA(this.mapa, u.x, u.y, (cx, cy) =>
        this.esAdyacente(cx, cy, aliado.x, aliado.y)
      );
      u.ruta = ruta ?? [];
      u.estado = Estado.Libre;
      return;
    }

    if (
      u.tipo === TipoUnidad.Obrera &&
      aliado?.tipo === TipoUnidad.Pulgones &&
      this.capacidadRestante(u) > 0
    ) {
      u.objetivoNectarId = aliado.id;
      u.recursoX = -1;
      u.recursoY = -1;
      this.irARecogerNectar(u, aliado);
      return;
    }

    if (this.capacidadRestante(u) > 0 && this.puedeRecolectarRecurso(u, x, y)) {
      u.recursoX = x;
      u.recursoY = y;
      if (u.tipo === TipoUnidad.Pulgones && this.mapa.getRecurso(x, y) === Recurso.Flor) {
        const pos = this.elegirCeldaRecoleccionPulgon(x, y, undefined, undefined, u.id);
        u.recursoStandX = pos.x;
        u.recursoStandY = pos.y;
        this.irAStandPulgon(u);
        return;
      }
      this.irARecurso(u);
      return;
    }
    const ruta = buscarRuta(this.mapa, u.x, u.y, x, y);
    u.ruta = ruta ?? [];
    u.estado = Estado.Libre;
  }

  private objetivoEnCelda(x: number, y: number, jugador: number): ObjetivoCombate | null {
    const unidad = this.unidades.find((u) => u.jugador !== jugador && u.x === x && u.y === y);
    if (unidad) return { tipo: "unidad", id: unidad.id };
    const edificio = this.edificios.find(
      (e) => e.jugador !== jugador && x >= e.x && x < e.x + e.ancho && y >= e.y && y < e.y + e.alto
    );
    return edificio ? { tipo: "edificio", id: edificio.id } : null;
  }

  private unidadNecesitaCuracion(unidad: Unidad): boolean {
    const maximo = DATOS_UNIDAD[unidad.tipo]?.hp ?? unidad.hp;
    return unidad.enfermedadViral || unidad.hp < maximo;
  }

  private obtenerObjetivosDomesticacion(pulgon: Unidad): Unidad[] {
    const cercanos = this.unidades.filter(
      (u) =>
        u.tipo === TipoUnidad.Pulgones &&
        u.jugador !== pulgon.jugador &&
        Math.max(Math.abs(u.x - pulgon.x), Math.abs(u.y - pulgon.y)) <= 1 &&
        u.id !== pulgon.id
    );
    const ordenados = [pulgon, ...cercanos.sort((a, b) => {
      const da = Math.max(Math.abs(a.x - pulgon.x), Math.abs(a.y - pulgon.y));
      const db = Math.max(Math.abs(b.x - pulgon.x), Math.abs(b.y - pulgon.y));
      return da - db;
    })];
    return ordenados.filter((u, idx, arr) => arr.findIndex((v) => v.id === u.id) === idx);
  }

  private esAphidDomesticado(pulgon: Unidad, trabajadorId?: number): boolean {
    return this.unidades.some(
      (otra) =>
        otra.tipo === TipoUnidad.Obrera &&
        otra.id !== trabajadorId &&
        otra.objetivoDomesticacionId === pulgon.id &&
        (otra.estado === Estado.IrADomesticar || otra.estado === Estado.Domesticando)
    );
  }

  private elegirObjetivoDomesticacion(pulgon: Unidad, trabajadorId: number): Unidad | null {
    const candidatos = this.obtenerObjetivosDomesticacion(pulgon);
    const disponible = candidatos.filter((candidato) => !this.esAphidDomesticado(candidato, trabajadorId));
    return disponible[0] ?? null;
  }

  private asignarDomesticacion(trabajador: Unidad, pulgon: Unidad): void {
    trabajador.objetivoDomesticacionId = pulgon.id;
    trabajador.temporizadorDomesticacion = 0;
    trabajador.estado = Estado.IrADomesticar;
    trabajador.ruta = buscarRutaA(this.mapa, trabajador.x, trabajador.y, (x, y) =>
      this.esAdyacente(x, y, pulgon.x, pulgon.y)
    ) ?? [];
  }

  private cancelarAccionCadaver(u: Unidad): void {
    this.destinosCargaCadaver.delete(u.id);
    this.destinosSoltarCadaver.delete(u.id);
    u.ruta = [];
    u.temporizador = 0;
    if (u.cadaverCargado !== null && u.estado === Estado.IrASoltarCadaver) {
      u.estado = Estado.Libre;
      return;
    }
    if (u.cadaverCargado === null && u.estado === Estado.IrACadaver) {
      u.estado = Estado.Libre;
    }
  }

  private distanciaManhattan(ax: number, ay: number, bx: number, by: number): number {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  private puedeRecalcularRuta(u: Unidad): boolean {
    return this.tickActual >= u.reintentoRutaTick;
  }

  private registrarRutaExitosa(u: Unidad): void {
    u.reintentoRutaTick = 0;
    this.fallosRuta.delete(u.id);
  }

  private registrarFalloRuta(u: Unidad, limpiarOrden: () => void): void {
    const fallos = (this.fallosRuta.get(u.id) ?? 0) + 1;
    this.fallosRuta.set(u.id, fallos);
    u.reintentoRutaTick = this.tickActual + 20;
    if (fallos >= 3) {
      limpiarOrden();
      u.estado = Estado.Libre;
      u.ruta = [];
      this.fallosRuta.delete(u.id);
    }
  }

  private recogerCadaver(u: Unidad, cadaver: { id: number; jugador: number; x: number; y: number; nivel: number; ticksRestantes: number }): void {
    u.cadaverCargado = {
      id: cadaver.id,
      jugador: cadaver.jugador,
      nivel: cadaver.nivel,
      ticksRestantes: cadaver.ticksRestantes,
    };
    u.estado = Estado.Libre;
    u.ruta = [];
    const indice = this.cadaveres.findIndex((v) => v.id === cadaver.id);
    if (indice >= 0) {
      this.cadaveres.splice(indice, 1);
      this.exposicionCadaveres.delete(cadaver.id);
    }
    if (this.siguienteAleatorio() < PROB_INFECCION_AL_CARGAR_CADAVER) {
      const yaEstabaEnferma = u.enfermedadViral;
      u.enfermedadViral = true;
      u.nivelEnfermedad = Math.max(u.nivelEnfermedad, cadaver.nivel || 1);
      if (!yaEstabaEnferma) {
        u.temporizadorEnfermedad = (DATOS_CADAVER[u.nivelEnfermedad] ?? DATOS_CADAVER[1]).intervalo;
      }
      u.temporizadorContagio = Math.max(u.temporizadorContagio, TICKS_ENTRE_CONTAGIOS);
    }
  }

  private encontrarCeldaLibreCadaver(x: number, y: number): { x: number; y: number } | null {
    const radioMax = 3;
    for (let radio = 0; radio <= radioMax; radio++) {
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          if (Math.abs(dx) !== radio && Math.abs(dy) !== radio) continue;
          const cx = x + dx;
          const cy = y + dy;
          if (!this.mapa.dentro(cx, cy)) continue;
          if (this.mapa.esAgua(cx, cy)) continue;
          if (this.mapa.estaBloqueada(cx, cy)) continue;
          if (this.cadaveres.some((cadaver) => cadaver.x === cx && cadaver.y === cy)) continue;
          return { x: cx, y: cy };
        }
      }
    }
    return null;
  }

  private soltarCadaver(u: Unidad, x: number, y: number): void {
    if (u.cadaverCargado === null) return;
    const destino = this.encontrarCeldaLibreCadaver(x, y) ?? { x, y };
    const cadaver = {
      id: u.cadaverCargado.id,
      jugador: u.cadaverCargado.jugador,
      x: destino.x,
      y: destino.y,
      nivel: u.cadaverCargado.nivel,
      ticksRestantes: u.cadaverCargado.ticksRestantes,
    };
    this.cadaveres.push(cadaver);
    this.exposicionCadaveres.set(cadaver.id, new Map());
    u.cadaverCargado = null;
    u.estado = Estado.Libre;
    u.ruta = [];
  }

  private validarDestinoCadaver(x: number, y: number): boolean {
    if (!this.mapa.dentro(x, y)) return false;
    if (this.mapa.esAgua(x, y) || this.mapa.estaBloqueada(x, y)) return false;
    if (this.cadaveres.some((c) => c.x === x && c.y === y)) return false;
    return true;
  }

  // ---- Órdenes ----

  private aplicarOrdenes(): void {
    for (const o of this.ordenes) {
      if (o.tipo === "construir") {
        const u = this.unidades.find((v) => v.id === o.unidadId);
        if (!u) continue;
        if (o.jugador !== undefined && u.jugador !== o.jugador) {
          continue;
        }
        if (u.tipo !== TipoUnidad.Obrera || !EDIFICIOS_CONSTRUIBLES_POR_OBRERA.includes(o.edificioTipo as (typeof EDIFICIOS_CONSTRUIBLES_POR_OBRERA)[number])) {
          this.eventos.push({ tipo: "error", mensaje: "The worker cannot build that building." });
          continue;
        }
        const existente = this.edificios.find(
          (v) =>
            v.tipo === o.edificioTipo &&
            v.x === o.x &&
            v.y === o.y &&
            v.jugador === u.jugador &&
            v.enConstruccion
        );
        if (existente) {
          u.bloqueadaPorRecurso = false;
          u.objetivoReparacionId = existente.id;
          u.estado = Estado.Construyendo;
          this.asignacionConstruccionTick.set(u.id, this.tickActual);
          u.ruta = buscarRutaA(this.mapa, u.x, u.y, (x, y) => this.adyacenteAEdificio(x, y, existente)) ?? [];
          continue;
        }
        const datos = DATOS_EDIFICIO[o.edificioTipo];
        if (!datos || !this.puedeColocarEdificio(o.edificioTipo, o.x, o.y)) {
          this.eventos.push({ tipo: "error", mensaje: "Cannot build here." });
          continue;
        }
        const coste = { agua: datos.costeAgua ?? 0, nectar: datos.costeNectar ?? 0, arcilla: datos.costeArcilla ?? 0 };
        if (!this.gastar(u.jugador, coste)) {
          this.emitirErrorRecurso(u.jugador, "arcilla", "Not enough clay.");
          continue;
        }
        const edificio = this.crearEdificio(o.edificioTipo, u.jugador, o.x, o.y, true);
        if (!edificio) {
          this.eventos.push({ tipo: "error", mensaje: "Cannot build here." });
          continue;
        }
        u.bloqueadaPorRecurso = false;
        u.objetivoReparacionId = edificio.id;
        u.estado = Estado.Construyendo;
        this.asignacionConstruccionTick.set(u.id, this.tickActual);
        u.ruta = buscarRutaA(this.mapa, u.x, u.y, (x, y) => this.adyacenteAEdificio(x, y, edificio)) ?? [];
        continue;
      }
      if (o.tipo === "construirLinea") {
        const jugador = o.jugador ?? 0;
        const obreras = o.unidadIds
          .map((id) => this.unidades.find((v) => v.id === id))
          .filter((unidad): unidad is Unidad => !!unidad && unidad.tipo === TipoUnidad.Obrera && unidad.jugador === jugador)
          .sort((a, b) => a.id - b.id);
        if (obreras.length === 0) {
          this.eventos.push({ tipo: "error", mensaje: "Selecciona una obrera para construir" });
          continue;
        }
        if (!EDIFICIOS_CONSTRUIBLES_POR_OBRERA.includes(o.edificioTipo as (typeof EDIFICIOS_CONSTRUIBLES_POR_OBRERA)[number])) {
          this.eventos.push({ tipo: "error", mensaje: "The worker cannot build that building." });
          continue;
        }
        if (o.edificioTipo !== TipoEdificio.Muralla) {
          this.eventos.push({ tipo: "error", mensaje: "Only walls can be built in a line." });
          continue;
        }
        const datos = DATOS_EDIFICIO[o.edificioTipo];
        if (!datos || datos.ancho !== 1 || datos.alto !== 1) {
          this.eventos.push({ tipo: "error", mensaje: "This building cannot be placed in a line." });
          continue;
        }

        const celdas = o.celdas.slice(0, MAX_CELDAS_ARRASTRE);
        const obras: Edificio[] = [];
        let creadas = 0;
        let faltanRecursos = false;
        for (const celda of celdas) {
          const existente = this.edificios.find(
            (v) =>
              v.tipo === o.edificioTipo &&
              v.jugador === jugador &&
              v.x === celda.x &&
              v.y === celda.y &&
              v.enConstruccion
          );
          if (existente) {
            obras.push(existente);
            continue;
          }
          if (!this.mapa.dentro(celda.x, celda.y) || !this.puedeColocarEdificio(o.edificioTipo, celda.x, celda.y)) {
            continue;
          }
          const coste = { agua: datos.costeAgua ?? 0, arcilla: datos.costeArcilla ?? 0, nectar: datos.costeNectar ?? 0 };
          if (!this.gastar(jugador, coste)) {
            faltanRecursos = true;
            this.emitirErrorRecurso(jugador, "arcilla", `Not enough clay: built ${creadas} of ${celdas.length}`);
            break;
          }
          const edificio = this.crearEdificio(o.edificioTipo, jugador, celda.x, celda.y, true);
          if (!edificio) {
            continue;
          }
          obras.push(edificio);
          creadas++;
        }
        if (obras.length === 0 && faltanRecursos) {
          continue;
        }
        for (let i = 0; i < obreras.length; i++) {
          const obra = obras[i % Math.max(1, obras.length)];
          if (!obra) continue;
          const obrera = obreras[i];
          obrera.bloqueadaPorRecurso = false;
          obrera.objetivoReparacionId = obra.id;
          obrera.estado = Estado.Construyendo;
          obrera.ruta = buscarRutaA(this.mapa, obrera.x, obrera.y, (x, y) => this.adyacenteAEdificio(x, y, obra)) ?? [];
          this.asignacionConstruccionTick.set(obrera.id, this.tickActual);
        }
        continue;
      }
      if (o.tipo === "producir") {
        const edificio = this.edificios.find((v) => v.id === o.edificioId);
        if (!edificio) {
          this.eventos.push({ tipo: "error", mensaje: "The building cannot produce units." });
          continue;
        }
        if (edificio.enConstruccion) {
          this.eventos.push({ tipo: "error", mensaje: "The building is under construction." });
          continue;
        }
        if (edificio.tipo !== TipoEdificio.Reina) {
          this.eventos.push({ tipo: "error", mensaje: "The building cannot produce units." });
          continue;
        }
        const tiposPermitidos = new Set<number>([
          TipoUnidad.Obrera,
          TipoUnidad.Guerrera,
          TipoUnidad.Voladora,
          TipoUnidad.GuerreraVoladora,
        ]);
        if (!tiposPermitidos.has(o.tipoUnidad)) {
          this.eventos.push({ tipo: "error", mensaje: "This unit type cannot be produced by the Queen." });
          continue;
        }
        if (edificio.cola.length >= 8) {
          this.eventos.push({ tipo: "error", mensaje: "Production queue full (max 8)." });
          continue;
        }
        const datos = DATOS_UNIDAD[o.tipoUnidad];
        if (!datos) {
          this.eventos.push({ tipo: "error", mensaje: "Unknown unit type." });
          continue;
        }
        if (!this.gastar(edificio.jugador, { agua: datos.costeAgua, nectar: datos.costeNectar, arcilla: 0 })) {
          this.emitirErrorRecurso(edificio.jugador, "agua", "Not enough resources.");
          continue;
        }
        edificio.cola.push({
          id: this.siguienteIdCola++,
          tipo: o.tipoUnidad,
          esUnidad: true,
          costeAgua: datos.costeAgua,
          costeNectar: datos.costeNectar,
          costeArcilla: 0,
          ticksTotales: 20,
          ticksRestantes: 20,
        });
        continue;
      }
      if (o.tipo === "cancelarProduccion") {
        const edificio = this.edificios.find((v) => v.id === o.edificioId);
        if (!edificio) continue;
        if (o.jugador !== undefined && edificio.jugador !== o.jugador) continue;
        // Si llega itemId se busca por id: el índice pudo cambiar entre el clic y el tick.
        const indice = o.itemId !== undefined
          ? edificio.cola.findIndex((it) => it.id === o.itemId)
          : o.indice;
        if (indice < 0 || indice >= edificio.cola.length) {
          // El ítem ya terminó o fue cancelado: no hay nada que devolver.
          if (o.itemId === undefined) this.eventos.push({ tipo: "error", mensaje: "Production item not found." });
          continue;
        }
        this.reembolsarProduccion(edificio, indice);
        continue;
      }

      const u = this.unidades.find((v) => v.id === o.unidadId);
      if (!u) continue;
      if (o.jugador !== undefined && u.jugador !== o.jugador) {
        continue;
      }
      if (u.cadaverCargado !== null && u.estado === Estado.IrASoltarCadaver && o.tipo !== "soltarCadaver") {
        this.cancelarAccionCadaver(u);
      }
      if (u.cadaverCargado === null && u.estado === Estado.IrACadaver && o.tipo !== "cargarCadaver") {
        this.cancelarAccionCadaver(u);
      }
      if (o.tipo !== "cargarNectar") u.objetivoNectarId = null;
      if (o.tipo !== "repararEdificio") u.objetivoReparacionId = null;
      if (o.tipo !== "domesticar") {
        u.objetivoDomesticacionId = null;
        u.temporizadorDomesticacion = 0;
      }
      if (o.tipo === "mover") {
        u.recursoX = -1;
        u.recursoY = -1;
        const ruta = buscarRuta(this.mapa, u.x, u.y, o.x, o.y);
        u.ruta = ruta ?? [];
        u.espera = 0;
        u.estado = Estado.Libre;
      } else if (o.tipo === "recolectar") {
        if (!this.puedeRecolectarRecurso(u, o.x, o.y)) continue;
        u.recursoX = o.x;
        u.recursoY = o.y;
        if (u.tipo === TipoUnidad.Pulgones && this.mapa.getRecurso(o.x, o.y) === Recurso.Flor) {
          const pos = this.elegirCeldaRecoleccionPulgon(o.x, o.y, o.posX, o.posY, u.id);
          u.recursoStandX = pos.x;
          u.recursoStandY = pos.y;
          this.irAStandPulgon(u);
          continue;
        }
        u.recursoStandX = o.x;
        u.recursoStandY = o.y;
        const llevaEste = this.mapa.esAgua(o.x, o.y)
          ? u.cargaAgua > 0
          : u.cargaArcilla > 0;
        if (llevaEste) this.irADeposito(u);
        else this.irARecurso(u);
      } else if (o.tipo === "atacar") {
        if (o.edificioId !== undefined) {
          const edificio = this.edificios.find((v) => v.id === o.edificioId);
          if (!edificio || (DATOS_EDIFICIO[edificio.tipo]?.atk ?? 0) <= 0) continue;
          edificio.objetivoCombate = o.objetivo;
          edificio.temporizadorAtaque = 0;
          continue;
        }
        u.recursoX = -1;
        u.recursoY = -1;
        const objetivo = this.obtenerObjetivo(o.objetivo);
        if (!objetivo || objetivo === u || (DATOS_UNIDAD[u.tipo]?.atk ?? 0) <= 0) continue;
        u.objetivoCombate = o.objetivo;
        u.temporizadorAtaque = 0;
        u.estado = Estado.Atacando;
        this.prepararRutaAtaque(u, objetivo);
      } else if (o.tipo === "curarEnfermedad") {
        const objetivo = this.unidades.find((v) => v.id === o.objetivoId);
        if (
          u.tipo !== TipoUnidad.Pulgones ||
          !objetivo ||
          objetivo.jugador !== u.jugador ||
          !objetivo.enfermedadViral
        ) {
          continue;
        }
        u.curandoUnidadId = objetivo.id;
        u.temporizadorCuracion = 0;
        u.ruta = buscarRutaA(this.mapa, u.x, u.y, (x, y) =>
          this.esAdyacente(x, y, objetivo.x, objetivo.y)
        ) ?? [];
      } else if (o.tipo === "repararEdificio") {
        u.recursoX = -1;
        u.recursoY = -1;
        const edificio = this.edificios.find((v) => v.id === o.edificioId);
        const maximo = edificio ? DATOS_EDIFICIO[edificio.tipo]?.hp ?? edificio.hp : 0;
        if (
          u.tipo !== TipoUnidad.Obrera ||
          !edificio ||
          edificio.jugador !== u.jugador ||
          edificio.hp >= maximo
        ) {
          continue;
        }
        u.bloqueadaPorRecurso = false;
        u.bloqueadaPorRecurso = false;
        u.objetivoReparacionId = edificio.id;
        u.ruta = buscarRutaA(this.mapa, u.x, u.y, (x, y) =>
          this.adyacenteAEdificio(x, y, edificio)
        ) ?? [];
        u.estado = edificio.enConstruccion ? Estado.Construyendo : Estado.ReparandoEdificio;
        this.asignacionConstruccionTick.set(u.id, this.tickActual);
      } else if (o.tipo === "domesticar") {
        u.recursoX = -1;
        u.recursoY = -1;
        const pulgon = this.unidades.find((v) => v.id === o.objetivoId);
        if (
          u.tipo !== TipoUnidad.Obrera ||
          !pulgon ||
          pulgon.tipo !== TipoUnidad.Pulgones ||
          pulgon.jugador === u.jugador
        ) {
          continue;
        }

        const objetivoAsignado = this.elegirObjetivoDomesticacion(pulgon, u.id);
        if (objetivoAsignado) this.asignarDomesticacion(u, objetivoAsignado);
      } else if (o.tipo === "cargarCadaver") {
        u.recursoX = -1;
        u.recursoY = -1;
        const cadaver = this.cadaveres.find((v) => v.id === o.cadaverId);
        if (
          u.tipo !== TipoUnidad.Guerrera ||
          !cadaver ||
          u.cadaverCargado !== null
        ) {
          continue;
        }
        this.destinosCargaCadaver.set(u.id, { id: cadaver.id, x: cadaver.x, y: cadaver.y });
        u.temporizador = 0;
        if (u.x === cadaver.x && u.y === cadaver.y) {
          u.ruta = [];
          u.espera = 0;
          u.estado = Estado.IrACadaver;
          u.temporizador = TICKS_POR_SEGUNDO;
          continue;
        }
        const ruta = buscarRuta(this.mapa, u.x, u.y, cadaver.x, cadaver.y);
        if (ruta === null) {
          this.eventos.push({ tipo: "error", mensaje: `The corpse at (${cadaver.x}, ${cadaver.y}) is unreachable.` });
          continue;
        }
        u.ruta = ruta;
        u.espera = 0;
        u.estado = Estado.IrACadaver;
      } else if (o.tipo === "soltarCadaver") {
        u.recursoX = -1;
        u.recursoY = -1;
        if (
          u.tipo !== TipoUnidad.Guerrera ||
          u.cadaverCargado === null ||
          !this.validarDestinoCadaver(o.x, o.y)
        ) {
          this.eventos.push({ tipo: "error", mensaje: "Cannot drop the corpse on that tile." });
          continue;
        }
        this.destinosSoltarCadaver.set(u.id, { x: o.x, y: o.y });
        u.temporizador = 0;
        if (u.x === o.x && u.y === o.y) {
          u.ruta = [];
          u.espera = 0;
          u.estado = Estado.IrASoltarCadaver;
          u.temporizador = TICKS_POR_SEGUNDO;
          continue;
        }
        const ruta = buscarRuta(this.mapa, u.x, u.y, o.x, o.y);
        if (ruta === null) {
          this.eventos.push({ tipo: "error", mensaje: `The drop tile (${o.x}, ${o.y}) is unreachable.` });
          continue;
        }
        u.ruta = ruta;
        u.espera = 0;
        u.estado = Estado.IrASoltarCadaver;
      } else if (o.tipo === "cargarNectar") {
        const pulgon = this.unidades.find((v) => v.id === o.pulgonId);
        if (
          u.tipo !== TipoUnidad.Obrera ||
          !pulgon ||
          pulgon.tipo !== TipoUnidad.Pulgones ||
          pulgon.jugador !== u.jugador ||
          pulgon.cargaNectar <= 0 ||
          this.capacidadRestante(u) < 1
        ) {
          continue;
        }
        u.objetivoNectarId = pulgon.id;
        u.recursoX = -1;
        u.recursoY = -1;
        this.irARecogerNectar(u, pulgon);
      }
    }
    this.ordenes = [];
  }

  esRecolectable(x: number, y: number): boolean {
    if (!this.mapa.dentro(x, y)) return false;
    if (this.mapa.esAgua(x, y)) return true;
    return (
      (this.mapa.getRecurso(x, y) === Recurso.Arcilla ||
        this.mapa.getRecurso(x, y) === Recurso.Flor) &&
      this.mapa.getCantidad(x, y) > 0
    );
  }

  private puedeRecolectarRecurso(u: Unidad, x: number, y: number): boolean {
    if (!this.esRecolectable(x, y)) return false;
    if (this.mapa.getRecurso(x, y) === Recurso.Flor) {
      return u.tipo === TipoUnidad.Pulgones;
    }
    return true;
  }

  private pulgonEnRangoDeFlor(u: Unidad): boolean {
    return Math.max(Math.abs(u.x - u.recursoX), Math.abs(u.y - u.recursoY)) <= 1;
  }

  private esCeldaValidaPulgonFlor(x: number, y: number, florX: number, florY: number): boolean {
    if (!this.mapa.dentro(x, y)) return false;
    if (this.mapa.esAgua(x, y) || this.mapa.estaBloqueada(x, y)) return false;
    if (this.edificios.some((e) => x >= e.x && x < e.x + e.ancho && y >= e.y && y < e.y + e.alto)) return false;
    return Math.max(Math.abs(x - florX), Math.abs(y - florY)) <= 1;
  }

  private elegirCeldaRecoleccionPulgon(
    florX: number,
    florY: number,
    posX?: number,
    posY?: number,
    unidadId?: number
  ): { x: number; y: number } {
    if (posX !== undefined && posY !== undefined && this.esCeldaValidaPulgonFlor(posX, posY, florX, florY)) {
      return { x: posX, y: posY };
    }

    const opciones: Array<{ x: number; y: number }> = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = florX + dx;
        const y = florY + dy;
        if (this.esCeldaValidaPulgonFlor(x, y, florX, florY)) {
          opciones.push({ x, y });
        }
      }
    }
    if (opciones.length === 0) return { x: florX, y: florY };

    const pulgonActual = unidadId === undefined ? null : this.unidades.find((u) => u.id === unidadId && u.tipo === TipoUnidad.Pulgones);
    if (pulgonActual) {
      const actualEnRango = this.esCeldaValidaPulgonFlor(pulgonActual.x, pulgonActual.y, florX, florY);
      if (actualEnRango) {
        return { x: pulgonActual.x, y: pulgonActual.y };
      }
      opciones.sort((a, b) => {
        const da = Math.max(Math.abs(a.x - pulgonActual.x), Math.abs(a.y - pulgonActual.y));
        const db = Math.max(Math.abs(b.x - pulgonActual.x), Math.abs(b.y - pulgonActual.y));
        return da - db || a.y - b.y || a.x - b.x;
      });
      return opciones[0];
    }

    const conteos = new Map<string, number>();
    for (const otra of this.unidades) {
      if (
        otra.tipo !== TipoUnidad.Pulgones ||
        otra.id === unidadId ||
        otra.recursoX !== florX ||
        otra.recursoY !== florY ||
        otra.recursoStandX === undefined ||
        otra.recursoStandY === undefined ||
        (otra.estado !== Estado.IrARecurso && otra.estado !== Estado.Recogiendo)
      ) {
        continue;
      }
      const clave = `${otra.recursoStandX},${otra.recursoStandY}`;
      conteos.set(clave, (conteos.get(clave) ?? 0) + 1);
    }

    opciones.sort((a, b) => {
      const pa = conteos.get(`${a.x},${a.y}`) ?? 0;
      const pb = conteos.get(`${b.x},${b.y}`) ?? 0;
      const da = Math.max(Math.abs(a.x - florX), Math.abs(a.y - florY));
      const db = Math.max(Math.abs(b.x - florX), Math.abs(b.y - florY));
      return pa - pb || da - db || a.y - b.y || a.x - b.x;
    });
    return opciones[0];
  }

  // ---- Ciclo de recolección ----

  private esAdyacente(x: number, y: number, rx: number, ry: number): boolean {
    return Math.max(Math.abs(x - rx), Math.abs(y - ry)) === 1;
  }

  private irAStandPulgon(u: Unidad): void {
    if (u.x === u.recursoStandX && u.y === u.recursoStandY) {
      u.ruta = [];
      u.espera = 0;
      u.estado = Estado.Recogiendo;
      u.temporizador = TICKS_RECOGIDA_FLOR_PULGON;
      return;
    }

    const ruta = buscarRuta(this.mapa, u.x, u.y, u.recursoStandX, u.recursoStandY);
    if (ruta !== null) {
      u.ruta = ruta;
      u.espera = 0;
      u.estado = Estado.IrARecurso;
      return;
    }

    if (this.irARecursoCercano(u, Recurso.Flor)) return;
    u.estado = Estado.Libre;
    u.ruta = [];
  }

  private irARecurso(u: Unidad): void {
    if (u.tipo === TipoUnidad.Pulgones && this.mapa.getRecurso(u.recursoX, u.recursoY) === Recurso.Flor) {
      this.irAStandPulgon(u);
      return;
    }

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

  private irARecursoCercano(u: Unidad, tipo: number, origenX: number = u.x, origenY: number = u.y): boolean {
    const candidatos: Array<{ x: number; y: number }> = [];
    for (let y = origenY - 2; y <= origenY + 2; y++) {
      for (let x = origenX - 2; x <= origenX + 2; x++) {
        if (!this.mapa.dentro(x, y)) continue;
        if (this.mapa.getRecurso(x, y) !== tipo || this.mapa.getCantidad(x, y) <= 0) continue;
        candidatos.push({ x, y });
      }
    }
    if (candidatos.length === 0) return false;

    const ruta = buscarRutaA(this.mapa, u.x, u.y, (x, y) =>
      candidatos.some((c) => this.esAdyacente(x, y, c.x, c.y) && !this.mapa.esAgua(x, y))
    );
    if (ruta === null) return false;

    const destino = ruta[ruta.length - 1] ?? { x: u.x, y: u.y };
    const mejor = candidatos
      .filter((c) => this.esAdyacente(destino.x, destino.y, c.x, c.y))
      .sort((a, b) => this.distanciaManhattan(a.x, a.y, u.x, u.y) - this.distanciaManhattan(b.x, b.y, u.x, u.y) || a.y - b.y || a.x - b.x)[0] ?? candidatos[0];

    u.recursoX = mejor.x;
    u.recursoY = mejor.y;
    if (u.tipo === TipoUnidad.Pulgones && tipo === Recurso.Flor) {
      const stand = this.elegirCeldaRecoleccionPulgon(mejor.x, mejor.y, undefined, undefined, u.id);
      u.recursoStandX = stand.x;
      u.recursoStandY = stand.y;
      this.irAStandPulgon(u);
      return true;
    }
    u.ruta = ruta;
    u.espera = 0;
    u.estado = Estado.IrARecurso;
    this.registrarRutaExitosa(u);
    return true;
  }

  private reasignarRecolectoresRecursoAgotado(x: number, y: number, tipo: number): void {
    for (const u of this.unidades) {
      const estadoValido =
        u.estado === Estado.IrARecurso ||
        u.estado === Estado.Recogiendo ||
        u.estado === Estado.IrADeposito ||
        u.estado === Estado.Entregando;
      if (
        !estadoValido ||
        u.objetivoNectarId !== null ||
        u.objetivoCombate !== null ||
        u.recursoX !== x ||
        u.recursoY !== y ||
        (tipo === Recurso.Flor && u.tipo !== TipoUnidad.Pulgones) ||
        (tipo === Recurso.Arcilla && u.tipo !== TipoUnidad.Obrera)
      ) {
        continue;
      }
      const estadoAnterior = u.estado;
      const rutaAnterior = u.ruta;
      const esperaAnterior = u.espera;
      const conservarRuta =
        estadoAnterior === Estado.IrADeposito ||
        estadoAnterior === Estado.Entregando ||
        this.capacidadRestante(u) === 0;
      const centroBusqueda = { x, y };
      if (!this.irARecursoCercano(u, tipo, centroBusqueda.x, centroBusqueda.y)) {
        if (!conservarRuta) {
          u.estado = Estado.Libre;
          u.ruta = [];
        }
        continue;
      }
      if (conservarRuta) {
        u.estado = estadoAnterior;
        u.ruta = rutaAnterior;
        u.espera = esperaAnterior;
      }
    }
  }

  private depositosDe(jugador: number): Edificio[] {
    return this.edificios.filter((e) => e.esDeposito && !e.enConstruccion && e.jugador === jugador);
  }

  private irADeposito(u: Unidad): void {
    if (u.tipo === TipoUnidad.Pulgones && u.cargaNectar > 0) {
      this.reanudarRecoleccionFlorPulgon(u);
      return;
    }
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
        if (u.tipo === TipoUnidad.Pulgones && this.mapa.getRecurso(u.recursoX, u.recursoY) === Recurso.Flor) {
          if (u.x === u.recursoStandX && u.y === u.recursoStandY && this.pulgonEnRangoDeFlor(u)) {
            u.estado = Estado.Recogiendo;
            u.temporizador = TICKS_RECOGIDA_FLOR_PULGON;
          } else {
            this.irAStandPulgon(u);
          }
          continue;
        }
        if (u.objetivoNectarId !== null) {
          const pulgon = this.unidades.find((v) => v.id === u.objetivoNectarId);
          if (!pulgon || !this.esAdyacente(u.x, u.y, pulgon.x, pulgon.y)) {
            u.objetivoNectarId = null;
            u.estado = Estado.Libre;
          } else {
            u.estado = Estado.RecogiendoNectar;
            u.temporizador = pulgon.cargaNectar > 0 ? TICKS_RECOGIDA_NECTAR : 1;
          }
        } else if (!this.puedeRecolectarRecurso(u, u.recursoX, u.recursoY)) {
          const tipoRecurso = u.tipo === TipoUnidad.Pulgones
            ? Recurso.Flor
            : u.tipo === TipoUnidad.Obrera
              ? Recurso.Arcilla
              : Recurso.Ninguno;
          if (tipoRecurso === Recurso.Ninguno || !this.irARecursoCercano(u, tipoRecurso)) {
            u.estado = Estado.Libre;
            u.ruta = [];
          }
        } else {
          const adyacente = this.esAdyacente(u.x, u.y, u.recursoX, u.recursoY);
          if (u.tipo !== TipoUnidad.Pulgones && !adyacente) {
            this.irARecurso(u);
            if (u.estado === Estado.IrARecurso && u.ruta.length === 0) {
              u.estado = Estado.Libre;
            }
            continue;
          }
          u.estado = Estado.Recogiendo;
          u.temporizador =
            u.tipo === TipoUnidad.Pulgones && this.mapa.getRecurso(u.recursoX, u.recursoY) === Recurso.Flor
              ? TICKS_RECOGIDA_FLOR_PULGON
              : TICKS_RECOGIDA;
        }
      } else if (u.estado === Estado.RecogiendoNectar) {
        u.temporizador--;
        if (u.temporizador <= 0) this.recogerNectar(u);
      } else if (u.estado === Estado.Recogiendo) {
        if (u.tipo === TipoUnidad.Pulgones && this.mapa.getRecurso(u.recursoX, u.recursoY) === Recurso.Flor) {
          if (!this.pulgonEnRangoDeFlor(u)) {
            u.estado = Estado.IrARecurso;
            this.irAStandPulgon(u);
            continue;
          }
        }
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

  private reasignarObrerasAObrasCercanas(idsTrabajando: number[] = []): void {
    const idsPermitidos = new Set(idsTrabajando);
    for (const obrera of this.unidades) {
      if (
        obrera.tipo !== TipoUnidad.Obrera ||
        obrera.estado !== Estado.Libre ||
        obrera.bloqueadaPorRecurso ||
        obrera.objetivoReparacionId !== null ||
        obrera.objetivoNectarId !== null ||
        (idsTrabajando.length > 0 && !idsPermitidos.has(obrera.id))
      ) {
        continue;
      }

      const candidatos = this.edificios
        .filter((edificio) => edificio.jugador === obrera.jugador && edificio.enConstruccion)
        .map((edificio) => {
          const centroX = edificio.x + edificio.ancho / 2;
          const centroY = edificio.y + edificio.alto / 2;
          const distancia = Math.max(Math.abs(obrera.x - centroX), Math.abs(obrera.y - centroY));
          const obrerasAsignadas = this.unidades.filter(
            (otra) =>
              otra.id !== obrera.id &&
              otra.tipo === TipoUnidad.Obrera &&
              otra.objetivoReparacionId === edificio.id &&
              (otra.estado === Estado.Construyendo || otra.estado === Estado.ReparandoEdificio)
          ).length;
          return { edificio, distancia, obrerasAsignadas };
        })
        .filter(({ edificio, distancia }) => distancia <= RADIO_BUSQUEDA_OBRA && this.stock[edificio.jugador].arcilla > 0)
        .sort((a, b) => a.distancia - b.distancia || a.obrerasAsignadas - b.obrerasAsignadas || a.edificio.id - b.edificio.id);

      let objetivo: Edificio | null = null;
      for (const candidato of candidatos) {
        const ruta = buscarRutaA(this.mapa, obrera.x, obrera.y, (x, y) =>
          this.adyacenteAEdificio(x, y, candidato.edificio)
        );
        if (ruta === null) continue;
        objetivo = candidato.edificio;
        break;
      }

      if (!objetivo) continue;
      obrera.bloqueadaPorRecurso = false;
      obrera.objetivoReparacionId = objetivo.id;
      obrera.estado = Estado.Construyendo;
      obrera.ruta = buscarRutaA(this.mapa, obrera.x, obrera.y, (x, y) => this.adyacenteAEdificio(x, y, objetivo)) ?? [];
      this.asignacionConstruccionTick.set(obrera.id, this.tickActual);
    }
  }

  private actualizarReparacionesEdificios(): void {
    const trabajadoresPorEdificio = new Map<number, Unidad[]>();

    for (const unidad of this.unidades) {
      const asignadoTick = this.asignacionConstruccionTick.get(unidad.id);
      if (asignadoTick === this.tickActual) {
        this.asignacionConstruccionTick.delete(unidad.id);
        continue;
      }
      const trabajandoEnEdificio =
        unidad.estado === Estado.ReparandoEdificio || unidad.estado === Estado.Construyendo;
      if (!trabajandoEnEdificio || unidad.objetivoReparacionId === null) continue;
      const edificio = this.edificios.find((v) => v.id === unidad.objetivoReparacionId);
      if (!edificio || edificio.jugador !== unidad.jugador) {
        unidad.objetivoReparacionId = null;
        unidad.estado = Estado.Libre;
        unidad.bloqueadaPorRecurso = false;
        unidad.ruta = [];
        continue;
      }

      const maximo = DATOS_EDIFICIO[edificio.tipo]?.hp ?? edificio.hp;
      if (edificio.hp >= maximo) {
        unidad.objetivoReparacionId = null;
        unidad.estado = Estado.Libre;
        unidad.bloqueadaPorRecurso = false;
        unidad.ruta = [];
        continue;
      }

      if (!this.adyacenteAEdificio(unidad.x, unidad.y, edificio)) {
        if (unidad.ruta.length === 0 && this.puedeRecalcularRuta(unidad)) {
          const ruta = buscarRutaA(this.mapa, unidad.x, unidad.y, (x, y) =>
            this.adyacenteAEdificio(x, y, edificio)
          );
          if (ruta === null) {
            this.registrarFalloRuta(unidad, () => {
              unidad.objetivoReparacionId = null;
              unidad.estado = Estado.Libre;
              unidad.bloqueadaPorRecurso = false;
              unidad.ruta = [];
            });
            continue;
          }
          unidad.ruta = ruta;
          this.registrarRutaExitosa(unidad);
        }
        continue;
      }

      const lista = trabajadoresPorEdificio.get(edificio.id) ?? [];
      lista.push(unidad);
      trabajadoresPorEdificio.set(edificio.id, lista);
    }

    const arcillaDisponiblePorJugador = new Map<number, number>();
    for (const [edificioId, unidades] of [...trabajadoresPorEdificio.entries()].sort(([a], [b]) => a - b)) {
      const edificio = this.edificios.find((v) => v.id === edificioId);
      if (!edificio) continue;

      const maximo = DATOS_EDIFICIO[edificio.tipo]?.hp ?? edificio.hp;
      if (edificio.hp >= maximo) continue;

      const jornada = [...unidades].sort((a, b) => a.id - b.id);
      let arcillaDisponible = arcillaDisponiblePorJugador.get(edificio.jugador) ?? this.stock[edificio.jugador].arcilla;
      const activos: Unidad[] = [];
      let emitidoFaltaArcilla = false;
      for (const unidad of jornada) {
        if (edificio.enConstruccion && arcillaDisponible <= 0) {
          if (!emitidoFaltaArcilla) {
            this.emitirErrorRecurso(edificio.jugador, "arcilla", "Not enough clay.");
            emitidoFaltaArcilla = true;
          }
          unidad.objetivoReparacionId = null;
          unidad.estado = Estado.Libre;
          unidad.ruta = [];
          unidad.bloqueadaPorRecurso = true;
          continue;
        }
        if (edificio.enConstruccion && arcillaDisponible > 0) {
          const antes = this.stock[edificio.jugador].arcilla;
          if (!this.gastar(edificio.jugador, { agua: 0, arcilla: 1, nectar: 0 })) {
            if (!emitidoFaltaArcilla) {
              this.emitirErrorRecurso(edificio.jugador, "arcilla", "Not enough clay.");
              emitidoFaltaArcilla = true;
            }
            unidad.objetivoReparacionId = null;
            unidad.estado = Estado.Libre;
            unidad.ruta = [];
            unidad.bloqueadaPorRecurso = true;
            continue;
          }
          arcillaDisponible = Math.max(0, antes - 1);
          arcillaDisponiblePorJugador.set(edificio.jugador, arcillaDisponible);
        }
        activos.push(unidad);
      }

      if (!edificio.enConstruccion && activos.length === 0) continue;

      const tasaBase = edificio.enConstruccion
        ? CONSTRUCCION_HP_POR_SEGUNDO
        : REPARACION_EDIFICIO_HP_POR_SEGUNDO;
      const aumento = Math.min(
        maximo - edificio.hp,
        (tasaBase / TICKS_POR_SEGUNDO) * activos.length
      );
      if (aumento <= 0) continue;

      edificio.hp = Math.min(maximo, edificio.hp + aumento);
      const actual = this.construccionAcumulada.get(edificio.id) ?? 0;
      this.construccionAcumulada.set(edificio.id, actual + aumento);

      if (edificio.hp >= maximo && edificio.enConstruccion) {
        edificio.enConstruccion = false;
        this.construccionAcumulada.delete(edificio.id);
        this.eventos.push({
          tipo: "notificacion",
          mensaje: `${DATOS_EDIFICIO[edificio.tipo]?.nombre ?? "Edificio"} completed.`,
        });
        const idsTrabajando = this.unidades
          .filter((unidad) => unidad.objetivoReparacionId === edificio.id && (unidad.estado === Estado.Construyendo || unidad.estado === Estado.ReparandoEdificio))
          .map((unidad) => unidad.id);
        for (const unidad of this.unidades) {
          if (unidad.objetivoReparacionId === edificio.id) {
            unidad.objetivoReparacionId = null;
            unidad.estado = Estado.Libre;
            unidad.ruta = [];
            unidad.bloqueadaPorRecurso = false;
          }
        }
        this.reasignarObrerasAObrasCercanas(idsTrabajando);
      }
    }
  }

  private actualizarDomesticacion(): void {
    for (const trabajador of this.unidades) {
      if (trabajador.objetivoDomesticacionId === null) continue;
      const pulgon = this.unidades.find((u) => u.id === trabajador.objetivoDomesticacionId);
      if (
        trabajador.tipo !== TipoUnidad.Obrera ||
        !pulgon ||
        pulgon.tipo !== TipoUnidad.Pulgones ||
        pulgon.jugador === trabajador.jugador
      ) {
        trabajador.objetivoDomesticacionId = null;
        trabajador.temporizadorDomesticacion = 0;
        trabajador.estado = Estado.Libre;
        trabajador.ruta = [];
        continue;
      }

      if (trabajador.objetivoDomesticacionId !== pulgon.id && this.esAphidDomesticado(pulgon, trabajador.id)) {
        const objetivoAlternativo = this.elegirObjetivoDomesticacion(pulgon, trabajador.id);
        if (objetivoAlternativo) {
          this.asignarDomesticacion(trabajador, objetivoAlternativo);
          continue;
        }
      }

      if (this.esAphidDomesticado(pulgon, trabajador.id)) {
        const objetivoAlternativo = this.elegirObjetivoDomesticacion(pulgon, trabajador.id);
        if (objetivoAlternativo) {
          this.asignarDomesticacion(trabajador, objetivoAlternativo);
          continue;
        }
      }

      if (!this.esAdyacente(trabajador.x, trabajador.y, pulgon.x, pulgon.y)) {
        trabajador.estado = Estado.IrADomesticar;
        if (trabajador.ruta.length === 0 && this.puedeRecalcularRuta(trabajador)) {
          const ruta = buscarRutaA(this.mapa, trabajador.x, trabajador.y, (x, y) =>
            this.esAdyacente(x, y, pulgon.x, pulgon.y)
          );
          if (ruta === null) {
            this.registrarFalloRuta(trabajador, () => {
              trabajador.objetivoDomesticacionId = null;
              trabajador.estado = Estado.Libre;
              trabajador.ruta = [];
            });
            continue;
          }
          trabajador.ruta = ruta;
          this.registrarRutaExitosa(trabajador);
        }
        continue;
      }

      trabajador.estado = Estado.Domesticando;
      if (trabajador.temporizadorDomesticacion <= 0) {
        trabajador.temporizadorDomesticacion = TICKS_DOMESTICACION_PULGON;
      }
      trabajador.temporizadorDomesticacion--;
      if (trabajador.temporizadorDomesticacion === 0) {
        pulgon.jugador = trabajador.jugador;
        trabajador.objetivoDomesticacionId = null;
        trabajador.estado = Estado.Libre;
        trabajador.ruta = [];
      }
    }
  }

  private recogerRecurso(u: Unidad): void {
    const { recursoX: rx, recursoY: ry } = u;
    if (u.tipo === TipoUnidad.Pulgones && this.mapa.getRecurso(rx, ry) === Recurso.Flor) {
      if (!this.pulgonEnRangoDeFlor(u)) {
        u.estado = Estado.IrARecurso;
        this.irAStandPulgon(u);
        return;
      }
    } else if (u.tipo !== TipoUnidad.Pulgones && !this.esAdyacente(u.x, u.y, rx, ry)) {
      u.estado = Estado.IrARecurso;
      this.irARecurso(u);
      if (u.estado === Estado.IrARecurso && u.ruta.length === 0) {
        u.estado = Estado.Libre;
      }
      return;
    }
    const capacidad = this.capacidadRestante(u);
    if (capacidad <= 0) {
      u.estado = Estado.Libre;
      return;
    }
    if (this.mapa.esAgua(rx, ry)) {
      u.cargaAgua += capacidad;
    } else if (this.mapa.getRecurso(rx, ry) === Recurso.Flor) {
      if (u.tipo !== TipoUnidad.Pulgones || u.cargaNectar >= 1) {
        u.estado = Estado.Libre;
        return;
      }
      u.cargaNectar = 1;
      const restante = this.mapa.getCantidad(rx, ry) - 1;
      if (restante <= 0) {
        this.agotarCelda(rx, ry);
        this.reasignarRecolectoresRecursoAgotado(rx, ry, Recurso.Flor);
      } else this.mapa.setRecurso(rx, ry, Recurso.Flor, restante);
      u.estado = Estado.Libre;
      u.ruta = [];
      return;
    } else if (this.puedeRecolectarRecurso(u, rx, ry)) {
      const cantidad = Math.min(capacidad, this.mapa.getCantidad(rx, ry));
      u.cargaArcilla += cantidad;
      const restante = this.mapa.getCantidad(rx, ry) - cantidad;
      if (restante <= 0) {
        this.agotarCelda(rx, ry);
        this.reasignarRecolectoresRecursoAgotado(rx, ry, Recurso.Arcilla);
      } else this.mapa.setRecurso(rx, ry, Recurso.Arcilla, restante);
    } else {
      const tipoRecurso = u.tipo === TipoUnidad.Pulgones
        ? Recurso.Flor
        : u.tipo === TipoUnidad.Obrera
          ? Recurso.Arcilla
          : Recurso.Ninguno;
      if (tipoRecurso !== Recurso.Ninguno && this.irARecursoCercano(u, tipoRecurso)) return;
      u.estado = Estado.Libre; // se agotó mientras recogía
      return;
    }
    this.irADeposito(u);
  }

  private capacidadRestante(u: Unidad): number {
    const capacidad = DATOS_UNIDAD[u.tipo]?.capacidadCarga ?? 1;
    return Math.max(0, capacidad - u.cargaAgua - u.cargaArcilla - u.cargaNectar);
  }

  private recogerNectar(u: Unidad): void {
    const pulgon = u.objetivoNectarId === null
      ? null
      : this.unidades.find((v) => v.id === u.objetivoNectarId);
    if (!pulgon || pulgon.jugador !== u.jugador || !this.esAdyacente(u.x, u.y, pulgon.x, pulgon.y)) {
      u.objetivoNectarId = null;
      u.estado = Estado.Libre;
      return;
    }
    if (pulgon.cargaNectar <= 0) {
      u.temporizador = 1;
      return;
    }
    if (this.capacidadRestante(u) < 1) {
      u.objetivoNectarId = null;
      u.estado = Estado.Libre;
      return;
    }
    u.cargaNectar = 1;
    pulgon.cargaNectar = 0;
    this.reanudarRecoleccionFlorPulgon(pulgon);
    u.recursoX = -1;
    u.recursoY = -1;
    this.irADeposito(u);
  }

  private reanudarRecoleccionFlorPulgon(pulgon: Unidad): void {
    pulgon.ruta = [];
    pulgon.espera = 0;
    pulgon.estado = Estado.Libre;
    if (
      pulgon.tipo === TipoUnidad.Pulgones &&
      this.mapa.getRecurso(pulgon.recursoX, pulgon.recursoY) === Recurso.Flor &&
      this.puedeRecolectarRecurso(pulgon, pulgon.recursoX, pulgon.recursoY)
    ) {
      const pos = this.elegirCeldaRecoleccionPulgon(pulgon.recursoX, pulgon.recursoY, undefined, undefined, pulgon.id);
      pulgon.recursoStandX = pos.x;
      pulgon.recursoStandY = pos.y;
      this.irAStandPulgon(pulgon);
    } else if (pulgon.tipo === TipoUnidad.Pulgones) {
      this.irARecursoCercano(pulgon, Recurso.Flor);
    }
  }

  private irARecogerNectar(u: Unidad, pulgon: Unidad): void {
    const ruta = buscarRutaA(this.mapa, u.x, u.y, (x, y) =>
      this.esAdyacente(x, y, pulgon.x, pulgon.y)
    );
    u.ruta = ruta ?? [];
    u.estado = Estado.IrARecurso;
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
    s.nectar += u.cargaNectar;
    this.eventos.push({
      tipo: "entrega",
      unidadId: u.id,
      edificioId: deposito.id,
      agua: u.cargaAgua,
      arcilla: u.cargaArcilla,
      nectar: u.cargaNectar,
    });
    u.cargaAgua = 0;
    u.cargaArcilla = 0;
    u.cargaNectar = 0;
    const pulgon = u.objetivoNectarId === null
      ? null
      : this.unidades.find((v) => v.id === u.objetivoNectarId);
    if (pulgon) {
      if (pulgon.jugador !== u.jugador) {
        u.objetivoNectarId = null;
        u.estado = Estado.Libre;
        return;
      }
      this.irARecogerNectar(u, pulgon);
      return;
    }
    // Vuelve al mismo recurso si sigue disponible; si no, busca otro cercano.
    if (this.esRecolectable(u.recursoX, u.recursoY)) this.irARecurso(u);
    else if (u.tipo !== TipoUnidad.Obrera || !this.irARecursoCercano(u, Recurso.Arcilla)) {
      u.estado = Estado.Libre;
    }
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

  private obtenerObjetivo(objetivo: ObjetivoCombate): Unidad | Edificio | null {
    if (objetivo.tipo === "unidad") {
      return this.unidades.find((u) => u.id === objetivo.id) ?? null;
    }
    return this.edificios.find((e) => e.id === objetivo.id) ?? null;
  }

  private objetivoEstaAdyacente(u: Unidad, objetivo: ObjetivoCombate): boolean {
    if (objetivo.tipo === "unidad") {
      const unidad = this.unidades.find((v) => v.id === objetivo.id);
      return unidad ? this.esAdyacente(u.x, u.y, unidad.x, unidad.y) : false;
    }
    const edificio = this.edificios.find((v) => v.id === objetivo.id);
    return edificio ? this.adyacenteAEdificio(u.x, u.y, edificio) : false;
  }

  private objetivoEnRango(entidad: Unidad | Edificio, objetivo: Unidad | Edificio, rango: number): boolean {
    return this.distanciaAtaqueObjetivo(entidad.x, entidad.y, objetivo) <= rango;
  }

  private prepararRutaAtaque(u: Unidad, objetivo: Unidad | Edificio): void {
    const ruta = buscarRutaA(this.mapa, u.x, u.y, (x, y) =>
      "ancho" in objetivo
        ? this.adyacenteAEdificio(x, y, objetivo)
        : this.esAdyacente(x, y, objetivo.x, objetivo.y)
    );
    u.ruta = ruta ?? [];
  }

  private limpiarCuracionAphid(pulgonId: number, unidadId: number): void {
    const objetivo = this.curacionesAphidAcumuladas.get(pulgonId);
    if (!objetivo) return;
    objetivo.delete(unidadId);
    if (objetivo.size === 0) {
      this.curacionesAphidAcumuladas.delete(pulgonId);
    }
  }

  private limpiarCuracionesAphidObjetivo(unidadId: number): void {
    for (const [pulgonId, objetivos] of this.curacionesAphidAcumuladas) {
      if (!objetivos.has(unidadId)) continue;
      objetivos.delete(unidadId);
      if (objetivos.size === 0) {
        this.curacionesAphidAcumuladas.delete(pulgonId);
      }
    }
  }

  private acumularCuracionAphid(pulgon: Unidad, objetivo: Unidad): void {
    if (pulgon.hp <= 0 || objetivo.hp <= 0 || pulgon.jugador !== objetivo.jugador) {
      this.limpiarCuracionAphid(pulgon.id, objetivo.id);
      return;
    }

    const maximo = DATOS_UNIDAD[objetivo.tipo]?.hp ?? objetivo.hp;
    if (objetivo.hp >= maximo) {
      this.limpiarCuracionAphid(pulgon.id, objetivo.id);
      return;
    }

    if (Math.max(Math.abs(pulgon.x - objetivo.x), Math.abs(pulgon.y - objetivo.y)) > 1) {
      this.limpiarCuracionAphid(pulgon.id, objetivo.id);
      return;
    }

    const intervalos = TICKS_POR_SEGUNDO / 2;
    const acumulado = (this.curacionesAphidAcumuladas.get(pulgon.id)?.get(objetivo.id) ?? 0) + 1;
    const objetivos = this.curacionesAphidAcumuladas.get(pulgon.id) ?? new Map<number, number>();
    objetivos.set(objetivo.id, acumulado);
    this.curacionesAphidAcumuladas.set(pulgon.id, objetivos);

    if (acumulado < intervalos) return;

    const cantidad = Math.min(0.5, maximo - objetivo.hp);
    if (cantidad <= 0) {
      this.limpiarCuracionAphid(pulgon.id, objetivo.id);
      return;
    }

    this.curar(objetivo, cantidad, pulgon.id);
    this.limpiarCuracionAphid(pulgon.id, objetivo.id);
  }

  private actualizarRegeneracion(): void {
    const pulgones = this.unidades.filter((u) => u.tipo === TipoUnidad.Pulgones && u.hp > 0);
    for (const u of this.unidades) {
      if (u.hp <= 0) continue;
      const datos = DATOS_UNIDAD[u.tipo];
      const maximo = datos?.hp ?? u.hp;
      this.curar(u, (datos?.regeneracion ?? 0) / TICKS_POR_SEGUNDO);
      if (u.hp >= maximo) {
        this.curacionesBloqueadasAvisadas.delete(u.id);
        this.limpiarCuracionesAphidObjetivo(u.id);
        continue;
      }
      const pulgonesCercanos = pulgones.filter(
        (pulgon) =>
          pulgon.id !== u.id &&
          pulgon.jugador === u.jugador &&
          Math.max(Math.abs(pulgon.x - u.x), Math.abs(pulgon.y - u.y)) <= 1
      );
      if (pulgonesCercanos.length > 8) {
        if (!this.curacionesBloqueadasAvisadas.has(u.id)) {
          this.eventos.push({
            tipo: "error",
            mensaje: "Healing blocked: a unit cannot be healed by more than 8 Pulgones",
          });
          this.curacionesBloqueadasAvisadas.add(u.id);
        }
        this.limpiarCuracionesAphidObjetivo(u.id);
        continue;
      }
      this.curacionesBloqueadasAvisadas.delete(u.id);
      for (const pulgon of pulgonesCercanos) {
        this.acumularCuracionAphid(pulgon, u);
      }
    }
  }

  private actualizarCuracionEnfermedad(): void {
    const objetivosEnCurso = new Set<number>();
    const pulgones = this.unidades.filter((u) => u.tipo === TipoUnidad.Pulgones && u.hp > 0);

    for (const pulgon of pulgones) {
      let objetivo = pulgon.curandoUnidadId === null
        ? null
        : this.unidades.find((u) => u.id === pulgon.curandoUnidadId) ?? null;
      const puedeCurar = (unidad: Unidad): boolean =>
        unidad.jugador === pulgon.jugador && unidad.enfermedadViral;

      if (!objetivo || !puedeCurar(objetivo) || objetivosEnCurso.has(objetivo.id)) {
        pulgon.curandoUnidadId = null;
        pulgon.temporizadorCuracion = 0;
        objetivo = this.unidades.find(
          (unidad) =>
            puedeCurar(unidad) &&
            !objetivosEnCurso.has(unidad.id) &&
            Math.max(Math.abs(unidad.x - pulgon.x), Math.abs(unidad.y - pulgon.y)) <= 1
        ) ?? null;
      }
      if (!objetivo) continue;

      if (Math.max(Math.abs(objetivo.x - pulgon.x), Math.abs(objetivo.y - pulgon.y)) > 1) {
        if (pulgon.ruta.length === 0 && this.puedeRecalcularRuta(pulgon)) {
          const ruta = buscarRutaA(this.mapa, pulgon.x, pulgon.y, (x, y) =>
            this.esAdyacente(x, y, objetivo!.x, objetivo!.y)
          );
          if (ruta === null) {
            this.registrarFalloRuta(pulgon, () => {
              pulgon.curandoUnidadId = null;
              pulgon.estado = Estado.Libre;
              pulgon.ruta = [];
            });
            continue;
          }
          pulgon.ruta = ruta;
          this.registrarRutaExitosa(pulgon);
        }
        continue;
      }

      objetivosEnCurso.add(objetivo.id);
      pulgon.curandoUnidadId = objetivo.id;
      if (pulgon.temporizadorCuracion <= 0) {
        pulgon.temporizadorCuracion = TICKS_CURACION_ENFERMEDAD;
      }
      pulgon.temporizadorCuracion--;
      if (pulgon.temporizadorCuracion === 0) {
        objetivo.enfermedadViral = false;
        objetivo.nivelEnfermedad = 0;
        objetivo.temporizadorEnfermedad = 0;
        objetivo.temporizadorContagio = 0;
        pulgon.curandoUnidadId = null;
        this.eventos.push({
          tipo: "enfermedadCurada",
          unidadId: objetivo.id,
          origenId: pulgon.id,
        });
      }
    }
  }

  private curar(u: Unidad, cantidad: number, origenId?: number): void {
    const maximo = DATOS_UNIDAD[u.tipo]?.hp ?? u.hp;
    const hpAnterior = u.hp;
    u.hp = Math.min(maximo, u.hp + cantidad);
    const cantidadReal = u.hp - hpAnterior;
    if (cantidadReal > 0 && origenId !== undefined) {
      this.eventos.push({
        tipo: "curacion",
        unidadId: u.id,
        cantidad: cantidadReal,
        origenId,
      });
    }
  }

  private distanciaAtaqueObjetivo(x: number, y: number, objetivo: Unidad | Edificio): number {
    if ("ancho" in objetivo) {
      let mejor = Number.POSITIVE_INFINITY;
      for (let dy = 0; dy < objetivo.alto; dy++) {
        for (let dx = 0; dx < objetivo.ancho; dx++) {
          const cx = objetivo.x + dx;
          const cy = objetivo.y + dy;
          mejor = Math.min(mejor, Math.max(Math.abs(x - cx), Math.abs(y - cy)));
        }
      }
      return mejor;
    }
    return Math.max(Math.abs(x - objetivo.x), Math.abs(y - objetivo.y));
  }

  private rangoAtaqueEntidad(entidad: Unidad | Edificio): number {
    if ("ancho" in entidad) {
      return DATOS_EDIFICIO[entidad.tipo]?.rango ?? 1;
    }
    return 1;
  }

  private elegirObjetivoAtaque(entidad: Unidad | Edificio): ObjetivoCombate | null {
    const rango = this.rangoAtaqueEntidad(entidad);
    let mejor: { distancia: number; objetivo: ObjetivoCombate } | null = null;

    for (const unidad of this.unidades) {
      if (unidad.hp <= 0 || unidad.jugador === entidad.jugador || unidad.jugador < 0) continue;
      const distancia = this.distanciaAtaqueObjetivo(entidad.x, entidad.y, unidad);
      if (distancia > rango) continue;
      const objetivo = { tipo: "unidad" as const, id: unidad.id };
      if (!mejor || distancia < mejor.distancia || (distancia === mejor.distancia && objetivo.id < mejor.objetivo.id)) {
        mejor = { distancia, objetivo };
      }
    }

    for (const edificio of this.edificios) {
      if (edificio.hp <= 0 || edificio.jugador === entidad.jugador || edificio.jugador < 0) continue;
      const distancia = this.distanciaAtaqueObjetivo(entidad.x, entidad.y, edificio);
      if (distancia > rango) continue;
      const objetivo = { tipo: "edificio" as const, id: edificio.id };
      if (!mejor || distancia < mejor.distancia || (distancia === mejor.distancia && objetivo.id < mejor.objetivo.id)) {
        mejor = { distancia, objetivo };
      }
    }

    return mejor?.objetivo ?? null;
  }

  private danoAtaque(atacante: Unidad | Edificio, objetivo: Unidad | Edificio): number {
    const ataque = "ancho" in atacante ? DATOS_EDIFICIO[atacante.tipo]?.atk ?? 0 : DATOS_UNIDAD[atacante.tipo]?.atk ?? 0;
    const defensa = "ancho" in objetivo ? DATOS_EDIFICIO[objetivo.tipo]?.def ?? 0 : DATOS_UNIDAD[objetivo.tipo]?.def ?? 0;
    const defensaEfectiva = Math.min(defensa, 90);
    return Math.max(1, ataque * (1 - defensaEfectiva / 100));
  }

  private ticksEntreAtaques(atacante: Unidad | Edificio): number {
    if ("ancho" in atacante) {
      const datos = DATOS_EDIFICIO[atacante.tipo];
      const ataquesPorSegundo = datos?.ataquesPorSegundo ?? 1;
      return Math.max(1, Math.round(TICKS_POR_SEGUNDO / ataquesPorSegundo));
    }
    return TICKS_ENTRE_ATAQUES;
  }

  private actualizarCombate(): void {
    for (const u of this.unidades) {
      if (u.hp <= 0 || u.objetivoCombate !== null || (DATOS_UNIDAD[u.tipo]?.atk ?? 0) <= 0) continue;
      if (u.estado !== Estado.Libre && u.estado !== Estado.Atacando) continue;
      const objetivo = this.elegirObjetivoAtaque(u);
      if (!objetivo) continue;
      u.objetivoCombate = objetivo;
      u.estado = Estado.Atacando;
    }

    for (const u of this.unidades) {
      if (u.estado !== Estado.Atacando || !u.objetivoCombate || u.hp <= 0) continue;
      const objetivo = this.obtenerObjetivo(u.objetivoCombate);
      if (!objetivo || objetivo.hp <= 0) {
        u.objetivoCombate = null;
        u.estado = Estado.Libre;
        u.ruta = [];
        continue;
      }
      if (!this.objetivoEstaAdyacente(u, u.objetivoCombate)) {
        if (u.ruta.length === 0 && this.puedeRecalcularRuta(u)) {
          const ruta = buscarRutaA(this.mapa, u.x, u.y, (x, y) =>
            "ancho" in objetivo
              ? this.adyacenteAEdificio(x, y, objetivo)
              : this.esAdyacente(x, y, objetivo.x, objetivo.y)
          );
          if (ruta === null) {
            this.registrarFalloRuta(u, () => {
              u.objetivoCombate = null;
              u.estado = Estado.Libre;
              u.ruta = [];
            });
            continue;
          }
          u.ruta = ruta;
          this.registrarRutaExitosa(u);
        }
        continue;
      }
      u.ruta = [];
      if (u.temporizadorAtaque > 0) {
        u.temporizadorAtaque--;
        continue;
      }
      const dano = this.danoAtaque(u, objetivo);
      objetivo.hp = Math.max(0, objetivo.hp - dano);
      this.eventos.push({
        tipo: "ataque",
        atacanteId: u.id,
        objetivo: u.objetivoCombate,
        dano,
      });
      u.temporizadorAtaque = TICKS_ENTRE_ATAQUES;
    }

    for (const edificio of this.edificios) {
      if (edificio.hp <= 0 || edificio.enConstruccion) continue;
      const datos = DATOS_EDIFICIO[edificio.tipo];
      if ((datos?.atk ?? 0) <= 0) continue;

      let objetivoCombate = edificio.objetivoCombate;
      let objetivo = objetivoCombate ? this.obtenerObjetivo(objetivoCombate) : null;
      if (!objetivo || objetivo.hp <= 0 || !this.objetivoEnRango(edificio, objetivo, datos.rango ?? 1)) {
        objetivoCombate = this.elegirObjetivoAtaque(edificio);
        edificio.objetivoCombate = objetivoCombate;
        objetivo = objetivoCombate ? this.obtenerObjetivo(objetivoCombate) : null;
      }
      if (!edificio.objetivoCombate || !objetivo) continue;
      if (edificio.temporizadorAtaque > 0) {
        edificio.temporizadorAtaque--;
        continue;
      }
      const dano = this.danoAtaque(edificio, objetivo);
      objetivo.hp = Math.max(0, objetivo.hp - dano);
      this.eventos.push({
        tipo: "ataque",
        atacanteId: edificio.id,
        objetivo: edificio.objetivoCombate,
        dano,
      });
      edificio.temporizadorAtaque = this.ticksEntreAtaques(edificio);
    }
  }

  private eliminarMuertos(): void {
    for (let i = this.unidades.length - 1; i >= 0; i--) {
      const unidad = this.unidades[i];
      if (unidad.hp <= 0) {
        if (unidad.cadaverCargado !== null) {
          this.cadaveres.push({
            id: unidad.cadaverCargado.id,
            jugador: unidad.cadaverCargado.jugador,
            x: unidad.x,
            y: unidad.y,
            nivel: unidad.cadaverCargado.nivel,
            ticksRestantes: unidad.cadaverCargado.ticksRestantes,
          });
          this.exposicionCadaveres.set(unidad.cadaverCargado.id, new Map());
          unidad.cadaverCargado = null;
        }
        this.crearCadaver(unidad);
        this.unidades.splice(i, 1);
      }
    }
    for (let i = this.edificios.length - 1; i >= 0; i--) {
      const edificio = this.edificios[i];
      if (edificio.hp > 0) continue;
      this.construccionAcumulada.delete(edificio.id);
      const stock = this.stock[edificio.jugador];
      for (const item of edificio.cola) {
        stock.agua += item.costeAgua;
        stock.arcilla += item.costeArcilla;
        stock.nectar += item.costeNectar;
      }
      edificio.cola.length = 0;
      if (edificio.tipo !== TipoEdificio.Reina) {
        for (let y = edificio.y; y < edificio.y + edificio.alto; y++) {
          for (let x = edificio.x; x < edificio.x + edificio.ancho; x++) {
            this.mapa.setBloqueada(x, y, false);
          }
        }
      }
      this.edificios.splice(i, 1);
    }
  }

  private crearCadaver(unidad: Unidad): void {
    const nivel = DATOS_UNIDAD[unidad.tipo]?.nivelCadaver ?? 1;
    const id = this.siguienteId++;
    const destino = this.encontrarCeldaLibreCadaver(unidad.x, unidad.y) ?? { x: unidad.x, y: unidad.y };
    this.cadaveres.push({
      id,
      jugador: unidad.jugador,
      x: destino.x,
      y: destino.y,
      nivel,
      ticksRestantes: TICKS_CADAVER,
    });
    this.exposicionCadaveres.set(id, new Map());
  }

  private actualizarCadaveresTransportados(): void {
    for (const u of this.unidades) {
      if (u.cadaverCargado === null) continue;
      u.cadaverCargado.ticksRestantes--;
      if (u.cadaverCargado.ticksRestantes <= 0) {
        u.cadaverCargado = null;
        u.estado = Estado.Libre;
        u.ruta = [];
        this.destinosCargaCadaver.delete(u.id);
        this.destinosSoltarCadaver.delete(u.id);
      }
    }

    for (const u of this.unidades) {
      if (u.estado === Estado.IrACadaver) {
        const destino = this.destinosCargaCadaver.get(u.id);
        if (!destino) {
          u.estado = Estado.Libre;
          u.ruta = [];
          u.temporizador = 0;
          continue;
        }
        const cadaver = this.cadaveres.find((v) => v.id === destino.id);
        if (!cadaver) {
          this.destinosCargaCadaver.delete(u.id);
          u.estado = Estado.Libre;
          u.ruta = [];
          u.temporizador = 0;
          continue;
        }
        if (u.x === destino.x && u.y === destino.y) {
          if (u.temporizador > 0) {
            u.temporizador--;
            if (u.temporizador <= 0) {
              this.recogerCadaver(u, cadaver);
              this.destinosCargaCadaver.delete(u.id);
            }
            continue;
          }
          u.temporizador = TICKS_POR_SEGUNDO;
          continue;
        }
      } else if (u.estado === Estado.IrASoltarCadaver) {
        const destino = this.destinosSoltarCadaver.get(u.id);
        if (!destino || u.cadaverCargado === null) {
          this.destinosSoltarCadaver.delete(u.id);
          u.estado = Estado.Libre;
          u.ruta = [];
          u.temporizador = 0;
          continue;
        }
        if (u.x === destino.x && u.y === destino.y) {
          if (u.temporizador > 0) {
            u.temporizador--;
            if (u.temporizador <= 0) {
              this.soltarCadaver(u, destino.x, destino.y);
              this.destinosSoltarCadaver.delete(u.id);
            }
            continue;
          }
          u.temporizador = TICKS_POR_SEGUNDO;
          continue;
        }
        if (u.ruta.length === 0 && this.puedeRecalcularRuta(u)) {
          const ruta = buscarRuta(this.mapa, u.x, u.y, destino.x, destino.y);
          if (ruta === null) {
            this.registrarFalloRuta(u, () => {
              this.destinosSoltarCadaver.delete(u.id);
              u.estado = Estado.Libre;
              u.ruta = [];
              u.temporizador = 0;
            });
            this.eventos.push({ tipo: "error", mensaje: "The corpse carrier can no longer reach the drop tile." });
            continue;
          }
          u.ruta = ruta;
          this.registrarRutaExitosa(u);
        }
      }
    }
  }

  private actualizarCadaveres(): void {
    const unidadesVivas = new Set(this.unidades.map((unidad) => unidad.id));
    for (let i = this.cadaveres.length - 1; i >= 0; i--) {
      const cadaver = this.cadaveres[i];
      const datos = DATOS_CADAVER[cadaver.nivel] ?? DATOS_CADAVER[1];
      const exposicion = this.exposicionCadaveres.get(cadaver.id) ?? new Map<number, number>();
      cadaver.ticksRestantes--;
      if (cadaver.ticksRestantes <= 0) {
        this.cadaveres.splice(i, 1);
        this.exposicionCadaveres.delete(cadaver.id);
        continue;
      }

      for (const unidad of this.unidades) {
        if (unidad.hp <= 0 || unidad.tipo === TipoUnidad.Pulgones) {
          exposicion.delete(unidad.id);
          continue;
        }
        if (
          Math.max(Math.abs(cadaver.x - unidad.x), Math.abs(cadaver.y - unidad.y)) >
          RADIO_CADAVER
        ) {
          exposicion.delete(unidad.id);
          continue;
        }
        const ticksExpuestos = (exposicion.get(unidad.id) ?? 0) + 1;
        exposicion.set(unidad.id, ticksExpuestos);
        if (ticksExpuestos > TICKS_EXPOSICION_CADAVER) {
          unidad.enfermedadViral = true;
          if (cadaver.nivel > unidad.nivelEnfermedad) {
            unidad.nivelEnfermedad = cadaver.nivel;
            unidad.temporizadorEnfermedad = datos.intervalo;
          }
          unidad.temporizadorContagio = TICKS_ENTRE_CONTAGIOS;
        }
      }
      for (const unidadId of exposicion.keys()) {
        if (!unidadesVivas.has(unidadId)) exposicion.delete(unidadId);
      }
      this.exposicionCadaveres.set(cadaver.id, exposicion);
    }
  }

  private actualizarEnfermedad(): void {
    for (const unidad of this.unidades) {
      if (!unidad.enfermedadViral || unidad.hp <= 0) continue;
      const datos = DATOS_CADAVER[unidad.nivelEnfermedad] ?? DATOS_CADAVER[1];
      if (unidad.temporizadorEnfermedad > 0) {
        unidad.temporizadorEnfermedad--;
        continue;
      }
      unidad.hp = Math.max(0, unidad.hp - datos.dano);
      unidad.temporizadorEnfermedad = datos.intervalo;
      this.eventos.push({
        tipo: "podredumbre",
        unidadId: unidad.id,
        dano: datos.dano,
      });
    }
  }

  private actualizarContagio(): void {
    const infectadas = this.unidades.filter(
      (unidad) => unidad.enfermedadViral && unidad.hp > 0 && unidad.tipo !== TipoUnidad.Pulgones
    );
    for (const origen of infectadas) {
      if (origen.temporizadorContagio > 0) {
        origen.temporizadorContagio--;
        continue;
      }
      origen.temporizadorContagio = TICKS_ENTRE_CONTAGIOS;

      for (const objetivo of this.unidades) {
        if (
          objetivo === origen ||
          objetivo.hp <= 0 ||
          objetivo.enfermedadViral ||
          objetivo.tipo === TipoUnidad.Pulgones ||
          Math.max(Math.abs(origen.x - objetivo.x), Math.abs(origen.y - objetivo.y)) > 1
        ) {
          continue;
        }
        if (this.siguienteAleatorio() >= 2 / 3) continue;

        objetivo.enfermedadViral = true;
        objetivo.nivelEnfermedad = origen.nivelEnfermedad || 1;
        objetivo.temporizadorEnfermedad =
          (DATOS_CADAVER[objetivo.nivelEnfermedad] ?? DATOS_CADAVER[1]).intervalo;
        objetivo.temporizadorContagio = TICKS_ENTRE_CONTAGIOS;
      }
    }
  }
}

export { TipoUnidad, TipoEdificio, Terreno };