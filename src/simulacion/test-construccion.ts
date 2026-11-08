import { DATOS_EDIFICIO, TipoEdificio, EDIFICIOS_CONSTRUIBLES_POR_OBRERA } from "./edificio";
import { crearMapaPrueba } from "./mapaPrueba";
import { Simulacion, TICKS_POR_SEGUNDO } from "./simulacion";
import { Estado, TipoUnidad } from "./unidad";

function logCheck(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` - ${detail}` : ""}`);
}

function crearSimConReina(): Simulacion {
  const sim = new Simulacion(crearMapaPrueba(), 7);
  sim.crearUnidad(TipoUnidad.Reina, 8, 17, 0);
  return sim;
}

function asignarConstruccion(sim: Simulacion, edificioId: number, x: number, y: number): void {
  const u = sim.crearUnidad(TipoUnidad.Obrera, x, y, 0);
  u.objetivoReparacionId = edificioId;
  u.estado = Estado.Construyendo;
  u.ruta = [];
}

{
  const sim = crearSimConReina();
  const obrera = sim.crearUnidad(TipoUnidad.Obrera, 9, 17, 0);
  sim.enviarOrden({
    tipo: "construir",
    unidadId: obrera.id,
    edificioTipo: TipoEdificio.Madriguera,
    x: 9,
    y: 18,
    jugador: 0,
  });
  sim.tick();
  const edificio = sim.edificios.find((e) => e.tipo === TipoEdificio.Madriguera);
  const ok = !!edificio && edificio.hp === 1 && edificio.enConstruccion === true;
  logCheck("Madriguera starts at 1 HP and enConstruccion", ok, `hp=${edificio?.hp ?? "n/a"}, enConstruccion=${String(edificio?.enConstruccion ?? false)}`);
}

function completarConstruccionConNTrabajadores(n: number): number {
  const sim = crearSimConReina();
  const edificio = sim.crearEdificio(TipoEdificio.Madriguera, 0, 40, 40, true)!;
  for (let i = 0; i < n; i++) {
    asignarConstruccion(sim, edificio.id, 39 - i, 40);
  }
  let ticks = 0;
  while (edificio.hp < DATOS_EDIFICIO[TipoEdificio.Madriguera].hp && ticks < 2000) {
    sim.tick();
    ticks++;
  }
  return ticks;
}

{
  const ticks = completarConstruccionConNTrabajadores(1);
  const ok = Math.abs(ticks - 400) <= 10;
  logCheck("1 worker completes Madriguera in ~400 ticks", ok, `ticks=${ticks}`);
}

{
  const ticks = completarConstruccionConNTrabajadores(2);
  const ok = Math.abs(ticks - 200) <= 10;
  logCheck("2 workers complete Madriguera in ~200 ticks", ok, `ticks=${ticks}`);
}

{
  const ticks = completarConstruccionConNTrabajadores(3);
  const ok = Math.abs(ticks - 134) <= 10;
  logCheck("3 workers complete Madriguera in ~134 ticks", ok, `ticks=${ticks}`);
}

function completarConUniones(uniones: number[]): number {
  const sim = crearSimConReina();
  const edificio = sim.crearEdificio(TipoEdificio.Madriguera, 0, 55, 55, true)!;
  const trabajadores: Array<{ x: number; y: number }> = [{ x: 54, y: 55 }];
  for (const t of trabajadores) {
    asignarConstruccion(sim, edificio.id, t.x, t.y);
  }
  let siguienteUnion = 0;
  let ticks = 0;
  while (edificio.hp < DATOS_EDIFICIO[TipoEdificio.Madriguera].hp && ticks < 2000) {
    if (siguienteUnion < uniones.length && edificio.hp >= uniones[siguienteUnion]) {
      trabajadores.push({ x: 53 - siguienteUnion, y: 56 });
      asignarConstruccion(sim, edificio.id, trabajadores[trabajadores.length - 1].x, trabajadores[trabajadores.length - 1].y);
      siguienteUnion++;
    }
    sim.tick();
    ticks++;
  }
  return ticks;
}

{
  const ticks = completarConUniones([100]);
  const ok = Math.abs(ticks - 300) <= 10;
  logCheck("Second builder joining at 100 HP completes in ~300 ticks total", ok, `ticks=${ticks}`);
}

{
  const ticks = completarConUniones([100, 100]);
  const ok = Math.abs(ticks - 267) <= 10;
  logCheck("Second and third builder join at half completion in ~267 ticks", ok, `ticks=${ticks}`);
}

{
  const sim = crearSimConReina();
  const edificio = sim.crearEdificio(TipoEdificio.Muralla, 0, 70, 70, true)!;
  asignarConstruccion(sim, edificio.id, 69, 70);
  let ticks = 0;
  while (edificio.hp < DATOS_EDIFICIO[TipoEdificio.Muralla].hp && ticks < 2000) {
    sim.tick();
    ticks++;
  }
  const ok = Math.abs(ticks - 600) <= 10;
  logCheck("Muralla with 1 worker completes in ~600 ticks", ok, `ticks=${ticks}, hp=${edificio.hp}`);
}

{
  const sim = crearSimConReina();
  const edificio = sim.crearEdificio(TipoEdificio.Madriguera, 0, 80, 80, true)!;
  const obrera = sim.crearUnidad(TipoUnidad.Obrera, 79, 80, 0);
  obrera.objetivoReparacionId = edificio.id;
  obrera.estado = Estado.Construyendo;
  sim.enviarOrden({ tipo: "producir", edificioId: edificio.id, tipoUnidad: TipoUnidad.Obrera, jugador: 0 });
  sim.tick();
  const error = sim.eventos.some((ev) => ev.tipo === "error" && ev.mensaje === "The building is under construction.");
  const depositos = (sim as any).depositosDe(0);
  const ok = error && !depositos.some((e: { id: number }) => e.id === edificio.id);
  logCheck("Under-construction building rejects production and deliveries", ok, `error=${String(error)} deposit=${String(!depositos.some((e: { id: number }) => e.id === edificio.id))}`);
}

{
  const sim = crearSimConReina();
  const obrera = sim.crearUnidad(TipoUnidad.Obrera, 9, 17, 0);
  sim.enviarOrden({
    tipo: "construir",
    unidadId: obrera.id,
    edificioTipo: TipoEdificio.Madriguera,
    x: 20,
    y: 20,
    jugador: 0,
  });
  sim.tick();
  const errores = sim.eventos.filter((ev) => ev.tipo === "error" && ev.mensaje === "Cannot build here.");
  const ok = errores.length > 0 && sim.edificios.filter((e) => e.tipo === TipoEdificio.Madriguera).length === 0;
  logCheck("Water placement is rejected without creating a building", ok, `errorCount=${errores.length}`);
}

{
  const sim = crearSimConReina();
  const edificio = sim.crearEdificio(TipoEdificio.Madriguera, 0, 90, 90, true)!;
  edificio.puntoRendezvousX = 90;
  edificio.puntoRendezvousY = 90;
  const obrera = sim.crearUnidad(TipoUnidad.Obrera, 88, 90, 0);
  (sim as any).aplicarOrdenRendezvous(obrera, edificio);
  const ok = obrera.objetivoReparacionId === edificio.id && obrera.estado === Estado.Construyendo;
  logCheck("Worker rally to under-construction building assigns construction", ok, `objetivo=${obrera.objetivoReparacionId ?? "n/a"}, estado=${obrera.estado}`);
}

{
  const sim = crearSimConReina();
  sim.stock[0].arcilla = 500;
  const edificio = sim.crearEdificio(TipoEdificio.Madriguera, 0, 100, 100, true)!;
  asignarConstruccion(sim, edificio.id, 98, 100);
  asignarConstruccion(sim, edificio.id, 99, 100);
  const antes = sim.stock[0].arcilla;
  for (let i = 0; i < TICKS_POR_SEGUNDO; i++) sim.tick();
  const delta = antes - sim.stock[0].arcilla;
  const ok = Number.isInteger(sim.stock[0].arcilla) && Math.abs(delta - 19) <= 0.01;
  logCheck("Two workers consume clay per worker while building", ok, `delta=${delta.toFixed(2)}, stock=${sim.stock[0].arcilla}`);
}

const construibles = EDIFICIOS_CONSTRUIBLES_POR_OBRERA;
logCheck("Construction whitelist contains Madriguera and Muralla", construibles.includes(TipoEdificio.Madriguera) && construibles.includes(TipoEdificio.Muralla), `whitelist=${JSON.stringify(construibles)}`);

