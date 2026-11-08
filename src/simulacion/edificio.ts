export const TipoEdificio = {
  Palacio: 0,
  Madriguera: 1, // se muestra como "Depósito"
  Muralla: 2,
  Reina: 3,
  Torre: 4,
} as const;

export const EDIFICIOS_CONSTRUIBLES_POR_OBRERA = [
  TipoEdificio.Palacio,
  TipoEdificio.Madriguera,
  TipoEdificio.Muralla,
  TipoEdificio.Torre,
] as const;

// La imagen dice 3x3, pero el texto del pedido decía 9x9. Cambia este número si es 9.
export const LADO_PALACIO = 3;

export interface DatosEdificio {
  nombre: string;
  descripcion: string;
  etiqueta: string; // texto corto para los botones
  ancho: number;
  alto: number;
  hp: number;
  def?: number;
  esDeposito: boolean;
  atk?: number;
  rango?: number; // casillas (distancia máxima en X o Y)
  ataquesPorSegundo?: number;
  costeAgua?: number;
  costeNectar?: number; // "glucosa"
  costeArcilla?: number;
}

export const DATOS_EDIFICIO: Record<number, DatosEdificio> = {
  [TipoEdificio.Palacio]: {
    nombre: "Manojo de Arcilla (Palacio)",
    descripcion: "Main colony structure for unit production, storage, and economy.",
    etiqueta: "Palacio",
    ancho: LADO_PALACIO,
    alto: LADO_PALACIO,
    hp: 500,
    esDeposito: true,
    costeArcilla: 500,
    costeAgua: 500,
    costeNectar: 600,
  },
  [TipoEdificio.Madriguera]: {
    nombre: "Depósito",
    descripcion: "Stores resources and helps sustain the colony economy.",
    etiqueta: "Depósito",
    ancho: 2,
    alto: 2,
    hp: 200,
    esDeposito: true,
    costeArcilla: 100,
    costeAgua: 100,
    costeNectar: 20,
  },
  [TipoEdificio.Muralla]: {
    nombre: "Muralla",
    descripcion: "Defensive barrier that blocks enemy movement and protects your base.",
    etiqueta: "Muralla",
    ancho: 1,
    alto: 1,
    hp: 300,
    esDeposito: false,
    costeArcilla: 50,
    costeAgua: 50,
    costeNectar: 5,
  },
  [TipoEdificio.Reina]: {
    nombre: "Reina",
    descripcion: "Queen chamber that supports production and strategic control.",
    etiqueta: "Reina",
    ancho: 2,
    alto: 2,
    hp: 1000,
    esDeposito: true,
    costeArcilla: 0,
    costeAgua: 0,
    costeNectar: 0,
  },
  [TipoEdificio.Torre]: {
    nombre: "Torre",
    descripcion: "Defensive tower that attacks enemies in range.",
    etiqueta: "Torre",
    ancho: 1,
    alto: 1,
    hp: 500,
    def: 50,
    atk: 10,
    rango: 2,
    ataquesPorSegundo: 2,
    esDeposito: false,
    costeArcilla: 70,
    costeAgua: 100,
    costeNectar: 20,
  },
};

// Siluetas (solo visuales). Cada forma es una unión de rectángulos
// [x0, y0, x1, y1] en coordenadas normalizadas 0..1 dentro del rectángulo
// del edificio (ancho*TAM x alto*TAM). La colisión sigue siendo el rectángulo completo.
export type RectForma = readonly [number, number, number, number];

export const FORMAS_EDIFICIO: Record<number, ReadonlyArray<RectForma>> = {
  // Depósito (2x2): carrete, tapas anchas y cuerpo más estrecho
  [TipoEdificio.Madriguera]: [
    [0, 0, 1, 0.3],
    [0.08, 0.3, 0.92, 0.7],
    [0, 0.7, 1, 1],
  ],
  // Muralla (1x1): rombo escalonado
  [TipoEdificio.Muralla]: [
    [0.35, 0, 0.65, 0.2],
    [0.17, 0.2, 0.83, 0.4],
    [0, 0.4, 1, 0.6],
    [0.17, 0.6, 0.83, 0.8],
    [0.35, 0.8, 0.65, 1],
  ],
  // Torre (1x1): cuerpo central con cuatro torreones en las esquinas
  [TipoEdificio.Torre]: [
    [0.15, 0.15, 0.85, 0.85],
    [0, 0, 0.34, 0.32],
    [0.66, 0, 1, 0.32],
    [0, 0.68, 0.34, 1],
    [0.66, 0.68, 1, 1],
  ],
  // Palacio: marco exterior, cruz central y bloque central, con cuatro huecos en L
  [TipoEdificio.Palacio]: [
    [0, 0, 1, 0.19],         // banda superior
    [0, 0.81, 1, 1],         // banda inferior
    [0, 0.19, 0.16, 0.81],   // banda izquierda
    [0.84, 0.19, 1, 0.81],   // banda derecha
    [0.455, 0.19, 0.545, 0.81], // barra vertical
    [0.16, 0.455, 0.84, 0.545], // barra horizontal
    [0.26, 0.34, 0.74, 0.66],   // bloque central
  ],
  // Reina (2x2): bloque octagonal aproximado con rectángulos
  [TipoEdificio.Reina]: [
    [0.3, 0, 0.7, 1],
    [0.1, 0.1, 0.9, 0.9],
    [0, 0.3, 1, 0.7],
  ],
};

export interface ColaProduccion {
  id?: number; // id único del ítem (permite cancelar sin depender del índice)
  tipo: number; // tipo de unidad o edificio a crear
  esUnidad: boolean;
  costeAgua: number;
  costeNectar: number;
  costeArcilla: number;
  ticksTotales: number;
  ticksRestantes: number;
}

import type { ObjetivoCombate } from "./unidad";

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
  enConstruccion: boolean;
  temporizadorAtaque: number; // ticks hasta el próximo disparo (torres)
  objetivoCombate: ObjetivoCombate | null;
  puntoRendezvousX?: number;
  puntoRendezvousY?: number;
  cola: ColaProduccion[];
}