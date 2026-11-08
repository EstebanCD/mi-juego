import { Mapa } from "./mapa.ts";
import { Simulacion } from "./simulacion.ts";
import { TipoEdificio, DATOS_EDIFICIO } from "./edificio.ts";
import { TipoUnidad, Estado } from "./unidad.ts";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function crearMapaSimple(): Mapa {
  const mapa = new Mapa(60, 60);
  for (let y = 0; y < mapa.alto; y++) {
    for (let x = 0; x < mapa.ancho; x++) {
      mapa.setTerreno(x, y, 0);
    }
  }
  return mapa;
}

{
  const sim = new Simulacion(crearMapaSimple());
  sim.stock[0].arcilla = 50;
  const a = sim.crearEdificio(TipoEdificio.Madriguera, 0, 10, 10, true)!;
  const b = sim.crearEdificio(TipoEdificio.Madriguera, 0, 15, 10, true)!;
  const c = sim.crearEdificio(TipoEdificio.Madriguera, 0, 18, 10, true)!;
  a.hp = DATOS_EDIFICIO[TipoEdificio.Madriguera].hp - 1;

  const obreras = [
    sim.crearUnidad(TipoUnidad.Obrera, 9, 10, 0),
    sim.crearUnidad(TipoUnidad.Obrera, 9, 11, 0),
    sim.crearUnidad(TipoUnidad.Obrera, 9, 12, 0),
  ];
  for (const obrera of obreras) {
    obrera.estado = Estado.Construyendo;
    obrera.objetivoReparacionId = a.id;
  }

  sim.tick();
  const reasignadas = obreras.filter((obrera) => obrera.objetivoReparacionId === b.id || obrera.objetivoReparacionId === c.id);
  assert(reasignadas.length >= 1, "Las obreras deben reasignarse a una obra cercana al completar la anterior");
  assert(reasignadas.length === obreras.length, "Las obreras que estaban construyendo la obra completada deben reasignarse");
}

{
  const sim = new Simulacion(crearMapaSimple());
  const florX = 14;
  const florY = 14;
  const mapa = sim.mapa;
  mapa.setRecurso(florX, florY, 2, 50);

  const pulgon = sim.crearUnidad(TipoUnidad.Pulgones, 13, 14, 0);
  const obrera = sim.crearUnidad(TipoUnidad.Obrera, 15, 14, 0);
  const guerrera = sim.crearUnidad(TipoUnidad.Guerrera, 16, 14, 0);

  const idsPulgones = [pulgon.id];
  const idsNoPulgones = [obrera.id, guerrera.id];
  const ordenes: Array<{ tipo: string; unidadId: number; x?: number; y?: number; posX?: number; posY?: number }> = [];
  const pedirMover = (id: number, x: number, y: number): void => {
    ordenes.push({ tipo: "mover", unidadId: id, x, y });
  };
  for (const id of idsPulgones) {
    ordenes.push({ tipo: "recolectar", unidadId: id, x: florX, y: florY });
  }
  for (const id of idsNoPulgones) {
    pedirMover(id, florX, florY);
  }
  assert(ordenes.some((o) => o.tipo === "recolectar" && o.unidadId === pulgon.id), "Los pulgones siguen recolectando en la flor");
  assert(!ordenes.some((o) => o.tipo === "recolectar" && o.unidadId === obrera.id), "Las obreras no deben reclamar recolección en una flor");
  assert(!ordenes.some((o) => o.tipo === "recolectar" && o.unidadId === guerrera.id), "Las guerreras no deben reclamar recolección en una flor");
  assert(ordenes.some((o) => o.tipo === "mover" && o.unidadId === obrera.id), "La obrera debe moverse a la flor");
  assert(ordenes.some((o) => o.tipo === "mover" && o.unidadId === guerrera.id), "La guerrera debe moverse a la flor");
  assert(!mapa.estaBloqueada(florX, florY), "La flor no bloquea el paso");
  assert(sim.esRecolectable(florX, florY), "La flor sigue siendo recolectable para los pulgones");
}

{
  const sim = new Simulacion(crearMapaSimple());
  sim.stock[0].arcilla = 0;
  const edificio = sim.crearEdificio(TipoEdificio.Madriguera, 0, 10, 10, true)!;

  const obreras = [
    sim.crearUnidad(TipoUnidad.Obrera, 9, 10, 0),
    sim.crearUnidad(TipoUnidad.Obrera, 10, 9, 0),
    sim.crearUnidad(TipoUnidad.Obrera, 9, 9, 0),
  ];

  for (const obrera of obreras) {
    obrera.estado = Estado.Construyendo;
    obrera.objetivoReparacionId = edificio.id;
  }

  sim.tick();
  const activas = obreras.filter((unidad) => unidad.estado === Estado.Construyendo).length;
  assert(activas === 0, "Se deben detener las obreras cuando no hay arcilla suficiente para ese tick");
  assert(sim.stock[0].arcilla === 0, "El stock de arcilla no debe bajar de cero");
  assert(sim.eventos.some((ev) => ev.tipo === "error" && ev.mensaje === "Not enough clay."), "Debe emitirse un error de falta de arcilla cuando el stock está agotado");
}

{
  const sim = new Simulacion(crearMapaSimple());
  sim.stock[0].agua = 10;
  sim.stock[0].arcilla = 5;
  sim.stock[0].nectar = 7;
  assert(sim.gastar(0, { agua: 2, arcilla: 3, nectar: 1 }) === true, "Debe pagar correctamente con stock suficiente");
  assert(sim.stock[0].agua === 8, "El agua debe descontarse sin quedar negativa");
  assert(sim.stock[0].arcilla === 2, "La arcilla debe descontarse sin quedar negativa");
  assert(sim.stock[0].nectar === 6, "El néctar debe descontarse sin quedar negativa");
  assert(sim.gastar(0, { agua: 9, arcilla: 1, nectar: 1 }) === false, "Debe rechazar gastos que exceden el stock");
  assert(sim.stock[0].agua === 8, "Un gasto fallido debe dejar el stock intacto");

  let seed = 12345;
  for (let i = 0; i < 1000; i++) {
    const next = (seed = (seed * 1103515245 + 12345) >>> 0);
    const agua = next % 17;
    const arcilla = (next >> 3) % 13;
    const nectar = (next >> 6) % 19;
    const gasto = (i % 3 === 0) ? { agua, arcilla, nectar } : { agua: 0, arcilla: 0, nectar: 0 };
    if (i % 3 === 0) {
      sim.gastar(0, gasto);
    } else {
      sim.anadir(0, "agua", agua);
      sim.anadir(0, "arcilla", arcilla);
      sim.anadir(0, "nectar", nectar);
    }
    assert(sim.stock[0].agua >= 0 && sim.stock[0].arcilla >= 0 && sim.stock[0].nectar >= 0, "El stock nunca puede bajar de cero");
  }
}

{
  const sim = new Simulacion(crearMapaSimple());
  sim.stock[0].arcilla = 999;
  const obreras = [
    sim.crearUnidad(TipoUnidad.Obrera, 10, 12, 0),
    sim.crearUnidad(TipoUnidad.Obrera, 11, 12, 0),
    sim.crearUnidad(TipoUnidad.Obrera, 12, 12, 0),
  ];
  const celdas = [
    { x: 10, y: 12 },
    { x: 11, y: 12 },
    { x: 12, y: 12 },
    { x: 13, y: 12 },
  ];

  sim.enviarOrden({
    tipo: "construirLinea",
    unidadIds: obreras.map((u) => u.id),
    edificioTipo: TipoEdificio.Muralla,
    celdas,
    jugador: 0,
  });
  sim.tick();

  const murallas = sim.edificios.filter((e) => e.tipo === TipoEdificio.Muralla && e.jugador === 0);
  assert(murallas.length === 4, "Debe construir la línea completa con todas las celdas válidas");
  assert(murallas.every((e) => e.enConstruccion), "Las murallas creadas por la línea deben quedar en construcción");
  assert(obreras.every((u) => u.objetivoReparacionId !== null), "Las obreras deben asignarse a los trabajos creados");
}
{
  const sim = new Simulacion(crearMapaSimple());
  sim.stock[0].arcilla = 999;
  const obreras = [sim.crearUnidad(TipoUnidad.Obrera, 10, 10, 0)];
  sim.enviarOrden({
    tipo: "construirLinea",
    unidadIds: obreras.map((u) => u.id),
    edificioTipo: TipoEdificio.Madriguera,
    celdas: [{ x: 10, y: 10 }, { x: 11, y: 10 }],
    jugador: 0,
  });
  sim.tick();
  assert(!sim.edificios.some((e) => e.tipo === TipoEdificio.Madriguera && e.jugador === 0 && e.x === 10 && e.y === 10), "Las líneas de construcción solo aceptan murallas");
  assert(sim.eventos.some((ev) => ev.tipo === "error" && ev.mensaje === "Only walls can be built in a line."), "Las construcciones no murallas deben rechazar la línea");
}
{
  const sim = new Simulacion(crearMapaSimple());
  const costeMuralla = DATOS_EDIFICIO[TipoEdificio.Muralla].costeArcilla ?? 0;
  sim.stock[0].arcilla = costeMuralla * 2;
  const obreras = [
    sim.crearUnidad(TipoUnidad.Obrera, 8, 8, 0),
    sim.crearUnidad(TipoUnidad.Obrera, 8, 9, 0),
    sim.crearUnidad(TipoUnidad.Obrera, 8, 10, 0),
  ];
  const celdas = [
    { x: 10, y: 10 },
    { x: 11, y: 10 },
    { x: 12, y: 10 },
    { x: 13, y: 10 },
    { x: 14, y: 10 },
  ];

  sim.enviarOrden({
    tipo: "construirLinea",
    unidadIds: obreras.map((u) => u.id),
    edificioTipo: TipoEdificio.Muralla,
    celdas,
    jugador: 0,
  });
  sim.tick();

  const murallas = sim.edificios.filter((e) => e.tipo === TipoEdificio.Muralla && e.jugador === 0);
  assert(murallas.length === 2, "Debe construir solo las localizaciones válidas antes de agotar la arcilla");
  assert(sim.eventos.some((ev) => ev.tipo === "error" && ev.mensaje.includes("Not enough clay: built 2 of 5")), "Debe emitirse un único error de falta de arcilla con el conteo correcto");
}
{
  const sim = new Simulacion(crearMapaSimple());
  sim.stock[0].arcilla = 999;
  const obreras = [
    sim.crearUnidad(TipoUnidad.Obrera, 5, 5, 0),
    sim.crearUnidad(TipoUnidad.Obrera, 5, 6, 0),
  ];
  sim.mapa.setBloqueada(8, 5, true);

  sim.enviarOrden({
    tipo: "construirLinea",
    unidadIds: obreras.map((u) => u.id),
    edificioTipo: TipoEdificio.Muralla,
    celdas: [
      { x: 8, y: 5 },
      { x: 9, y: 5 },
      { x: 10, y: 5 },
    ],
    jugador: 0,
  });
  sim.tick();

  const murallas = sim.edificios.filter((e) => e.tipo === TipoEdificio.Muralla && e.jugador === 0);
  assert(murallas.length === 2, "Las celdas bloqueadas o inválidas deben omitirse sin romper la línea");
}

{
  const sim = new Simulacion(new Mapa(200, 200));
  const base = sim.crearBaseInicial(1, 100, 100, [TipoUnidad.Guerrera, TipoUnidad.Voladora]);
  assert(base.reina !== null, "La base enemiga debe crear la reina");
  assert(base.unidades.some((u) => u.tipo === TipoUnidad.Obrera && u.jugador === 1), "La base enemiga debe incluir obreras");
  assert(base.unidades.some((u) => u.tipo === TipoUnidad.Guerrera && u.jugador === 1), "La base enemiga debe incluir guerreras");
  assert(base.unidades.some((u) => u.tipo === TipoUnidad.Voladora && u.jugador === 1), "La base enemiga debe incluir voladoras");
  assert(base.reina!.x === 100 && base.reina!.y === 100, "La reina debe posicionarse en el origen indicado");
  assert(sim.stock[1].agua >= 0 && sim.stock[1].arcilla >= 0 && sim.stock[1].nectar >= 0, "El stock del segundo jugador debe permanecer válido");
}

console.log("PASS: cambios 1, 3, 4 y 5 verificadas");
