export const TipoUnidad = {
  Obrera: 0,
  Guerrera: 1,
  Voladora: 2,
  GuerreraVoladora: 3,
  Pulgones: 4,
  Reina: 5,
  ReinaJoven: 6,
} as const;

export const DATOS_UNIDAD: Record<
  number,
  {
    nombre: string;
    descripcion: string;
    hp: number;
    atk: number;
    def: number;
    regeneracion: number;
    nivelCadaver: number;
    capacidadCarga: number;
    costeAgua: number;
    costeNectar: number;
  }
> = {
  [TipoUnidad.Obrera]: { nombre: "Ant Worker", descripcion: "Collects resources and constructs buildings for the colony.", hp: 20, atk: 3, def: 5, regeneracion: 0.2, nivelCadaver: 1, capacidadCarga: 2, costeAgua: 5, costeNectar: 0 },
  [TipoUnidad.Guerrera]: { nombre: "Guerrera", descripcion: "Frontline fighter that attacks enemies and protects the colony.", hp: 100, atk: 15, def: 50, regeneracion: 0.2, nivelCadaver: 2, capacidadCarga: 2, costeAgua: 5, costeNectar: 6 },
  [TipoUnidad.Voladora]: { nombre: "Voladora", descripcion: "Fast attacker that harasses enemies from the air.", hp: 50, atk: 10, def: 5, regeneracion: 0.2, nivelCadaver: 1, capacidadCarga: 1, costeAgua: 4, costeNectar: 4 },
  [TipoUnidad.GuerreraVoladora]: { nombre: "Guerrera Voladora", descripcion: "Heavy aerial unit that deals strong damage from above.", hp: 150, atk: 25, def: 50, regeneracion: 0.2, nivelCadaver: 2, capacidadCarga: 2, costeAgua: 8, costeNectar: 14 },
  [TipoUnidad.Pulgones]: { nombre: "Pulgones", descripcion: "Support unit that cures infections and boosts nearby allies.", hp: 5, atk: 0, def: 0, regeneracion: 0.2, nivelCadaver: 1, capacidadCarga: 1, costeAgua: 0, costeNectar: 1 },
  [TipoUnidad.Reina]: { nombre: "Reina", descripcion: "The colony core that produces units and controls the swarm.", hp: 1000, atk: 10, def: 90, regeneracion: 0.2, nivelCadaver: 3, capacidadCarga: 0, costeAgua: 200, costeNectar: 300 },
  [TipoUnidad.ReinaJoven]: { nombre: "Reina Joven", descripcion: "A growing queen that can spawn the next wave of units.", hp: 100, atk: 50, def: 0, regeneracion: 0.2, nivelCadaver: 2, capacidadCarga: 0, costeAgua: 50, costeNectar: 50 },
};
export const Estado = {
  Libre: 0,
  IrARecurso: 1,
  Recogiendo: 2,
  IrADeposito: 3,
  Entregando: 4,
  Atacando: 5,
  RecogiendoNectar: 6,
  ReparandoEdificio: 7,
  IrADomesticar: 8,
  Domesticando: 9,
  IrACadaver: 10,
  IrASoltarCadaver: 11,
  Construyendo: 12,
} as const;

export interface ObjetivoCombate {
  tipo: "unidad" | "edificio";
  id: number;
}

export interface CadaverCargado {
  id: number;
  nivel: number;
  jugador: number;
  ticksRestantes: number;
}

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
  cargaAgua: number;
  cargaArcilla: number;
  cargaNectar: number;
  recursoX: number; // celda del recurso asignado
  recursoY: number;
  recursoStandX: number; // celda donde la unidad debe quedarse para recoger
  recursoStandY: number;
  cadaverCargado: CadaverCargado | null;
  objetivoNectarId: number | null;
  temporizador: number; // ticks restantes de recogida
  objetivoCombate: ObjetivoCombate | null;
  temporizadorAtaque: number;
  enfermedadViral: boolean;
  nivelEnfermedad: number;
  temporizadorEnfermedad: number;
  temporizadorContagio: number;
  curandoUnidadId: number | null;
  temporizadorCuracion: number;
  objetivoReparacionId: number | null;
  objetivoDomesticacionId: number | null;
  temporizadorDomesticacion: number;
  reintentoRutaTick: number;
  bloqueadaPorRecurso: boolean;
}

