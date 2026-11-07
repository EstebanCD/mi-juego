export const TipoEdificio = {
  // deshabilitado por ahora
  Palacio: 0,
  Madriguera: 1,
  Muralla: 2,
  Reina: 3,
} as const;

export const DATOS_EDIFICIO: Record<
  number,
  {
    nombre: string;
    ancho: number;
    alto: number;
    hp: number;
    esDeposito: boolean;
    atk?: number;
  }
> = {
  [TipoEdificio.Palacio]: { nombre: "Manojo de Arcilla (Palacio)", ancho: 2, alto: 2, hp: 500, esDeposito: true },
  [TipoEdificio.Madriguera]: { nombre: "Madriguera", ancho: 1, alto: 1, hp: 200, esDeposito: true },
  [TipoEdificio.Muralla]: { nombre: "Muralla", ancho: 1, alto: 1, hp: 300, esDeposito: false },
  [TipoEdificio.Reina]: { nombre: "Reina", ancho: 2, alto: 2, hp: 1000, esDeposito: true },
};

export interface ColaProduccion {
  tipo: number; // tipo de unidad o edificio a crear
  esUnidad: boolean;
  costeAgua: number;
  costeNectar: number;
  costeArcilla: number;
  ticksTotales: number;
  ticksRestantes: number;
}

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
  puntoRendezvousX?: number;
  puntoRendezvousY?: number;
  cola: ColaProduccion[];
}


