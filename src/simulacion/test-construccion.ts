import { DATOS_EDIFICIO, TipoEdificio } from "./edificio";
import { Mapa } from "./mapa";
import { Simulacion } from "./simulacion";
import { TipoUnidad } from "./unidad";

function ordenarConstruccion(sim: Simulacion, unidadId: number, edificioId: number): void {
  sim.enviarOrden({
    tipo: "repararEdificio",
    unidadId,
    edificioId,
    jugador: 0,
  });
}

function crearMadrigueraEnConstruccion(): { sim: Simulacion; edificio: ReturnType<Simulacion["crearEdificio"]> } {
  const sim = new Simulacion(new Mapa(40, 40), 1234);
  const edificio = sim.crearEdificio(TipoEdificio.Madriguera, 0, 5, 5);
  if (!edificio) throw new Error("No se pudo crear la madriguera de prueba.");
  if (edificio.hp !== 1) {
    throw new Error(`La madriguera debe empezar en 1 HP para construcción incremental; valor actual: ${edificio.hp}.`);
  }
  if (!edificio.enConstruccion) {
    throw new Error("La madriguera debe marcarse como en construcción al crearse.");
  }
  return { sim, edificio };
}

function completarConstruccionConAportes(aumentos: number[]): number {
  const { sim, edificio } = crearMadrigueraEnConstruccion();
  const muro = edificio!;
  const maximo = DATOS_EDIFICIO[TipoEdificio.Madriguera].hp;
  const trabajadores: Array<{ id: number; x: number; y: number }> = [];

  for (let i = 0; i < 3; i++) {
    const u = sim.crearUnidad(TipoUnidad.Obrera, 4 + i, 5, 0);
    trabajadores.push({ id: u.id, x: u.x, y: u.y });
  }

  ordenarConstruccion(sim, trabajadores[0].id, muro.id);

  let ticks = 0;
  let indiceSiguienteUnion = 0;
  while (muro.hp < maximo && ticks < 3000) {
    if (indiceSiguienteUnion < aumentos.length && muro.hp >= aumentos[indiceSiguienteUnion]) {
      const siguiente = trabajadores[indiceSiguienteUnion + 1];
      if (siguiente) ordenarConstruccion(sim, siguiente.id, muro.id);
      indiceSiguienteUnion++;
    }
    sim.tick();
    ticks++;
  }

  if (muro.hp < maximo) {
    throw new Error(`No terminó la construcción antes de 3000 ticks; hp final: ${muro.hp}.`);
  }

  return ticks;
}

{
  const valor = completarConstruccionConAportes([]);
  if (Math.abs(valor - 400) > 30) {
    throw new Error(`1 constructor: esperaba ~400 ticks, obtuvo ${valor}.`);
  }
  console.log(`1 constructor: ${valor} ticks`);
}

{
  const valor = completarConstruccionConAportes([100]);
  if (Math.abs(valor - 300) > 35) {
    throw new Error(`2 constructores: esperaba ~300 ticks, obtuvo ${valor}.`);
  }
  console.log(`2 constructores: ${valor} ticks`);
}

{
  const valor = completarConstruccionConAportes([100, 100]);
  if (Math.abs(valor - 267) > 35) {
    throw new Error(`3 constructores: esperaba ~267 ticks, obtuvo ${valor}.`);
  }
  console.log(`3 constructores: ${valor} ticks`);
}

const sim = new Simulacion(new Mapa(40, 40), 7);
const edificio = sim.crearEdificio(TipoEdificio.Muralla, 0, 5, 5)!;
if (edificio.hp !== 1) {
  throw new Error(`La muralla en prueba debe empezar en 1 HP; valor actual: ${edificio.hp}.`);
}
const primer = sim.crearUnidad(TipoUnidad.Obrera, 4, 5, 0);
ordenarConstruccion(sim, primer.id, edificio.id);
for (let i = 0; i < 300; i++) sim.tick();
const segundo = sim.crearUnidad(TipoUnidad.Obrera, 6, 5, 0);
ordenarConstruccion(sim, segundo.id, edificio.id);
for (let i = 0; i < 150; i++) sim.tick();
if (Math.abs(edificio.hp - 300) > 20) {
  throw new Error(`Arribo tardío: la muralla terminó en ${edificio.hp} HP, esperado cerca de 300.`);
}
console.log(`Arribo tardío: hp=${edificio.hp} al tick ${sim.tickActual}`);

const simEvento = new Simulacion(new Mapa(40, 40), 99);
const edificioEvento = simEvento.crearEdificio(TipoEdificio.Muralla, 0, 9, 9)!;
for (let i = 0; i < 2; i++) {
  const u = simEvento.crearUnidad(TipoUnidad.Obrera, 8 + i, 9, 0);
  ordenarConstruccion(simEvento, u.id, edificioEvento.id);
}
for (let i = 0; i < 10; i++) simEvento.tick();
const evento = simEvento.eventos.find((ev) => ev.tipo === "construccion");
if (!evento || Math.abs(evento.cantidad - 10) > 0.6) {
  throw new Error(`Evento de construcción inesperado: ${JSON.stringify(evento)} (se esperaba ~10 HP en 1 segundo con 2 obreras).`);
}
console.log(`Evento por segundo: ${JSON.stringify(evento)}`);
