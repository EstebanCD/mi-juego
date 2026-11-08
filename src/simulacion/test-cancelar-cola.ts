import { crearMapaPrueba } from "./mapaPrueba";
import { Simulacion } from "./simulacion";
import { TipoEdificio } from "./edificio";
import { TipoUnidad, DATOS_UNIDAD } from "./unidad";

const sim = new Simulacion(crearMapaPrueba(), 7);
const reina = sim.crearEdificio(TipoEdificio.Reina, 0, 8, 17)!;
sim.stock[0].agua = 100; sim.stock[0].nectar = 100;
const a0 = sim.stock[0].agua, n0 = sim.stock[0].nectar;
for (const t of [TipoUnidad.Guerrera, TipoUnidad.Voladora, TipoUnidad.Obrera])
  sim.enviarOrden({ tipo: "producir", edificioId: reina.id, tipoUnidad: t, jugador: 0 });
sim.tick();
const ids = reina.cola.map(c => c.id);
console.log("cola", reina.cola.length, "agua", sim.stock[0].agua, "nectar", sim.stock[0].nectar);
// cancelar el del medio por id
sim.enviarOrden({ tipo: "cancelarProduccion", edificioId: reina.id, indice: 1, itemId: ids[1], jugador: 0 });
sim.tick();
const g = DATOS_UNIDAD[TipoUnidad.Guerrera], o = DATOS_UNIDAD[TipoUnidad.Obrera];
console.log("tras cancelar:", reina.cola.map(c => c.tipo), "agua", sim.stock[0].agua, "nectar", sim.stock[0].nectar);
const ok1 = reina.cola.length === 2 && reina.cola.every(c => c.id !== ids[1]);
const ok2 = sim.stock[0].agua === a0 - g.costeAgua - o.costeAgua + 0 && sim.stock[0].nectar === n0 - g.costeNectar - o.costeNectar;
// cancelar un id que ya no existe no debe tocar nada
sim.enviarOrden({ tipo: "cancelarProduccion", edificioId: reina.id, indice: 0, itemId: ids[1], jugador: 0 });
sim.tick();
const ok3 = reina.cola.length === 2;
// jugador ajeno no puede cancelar
sim.enviarOrden({ tipo: "cancelarProduccion", edificioId: reina.id, indice: 0, itemId: ids[0], jugador: 1 });
sim.tick();
const ok4 = reina.cola.length === 2;
console.log(ok1 ? "PASS" : "FAIL", "elimina el ítem correcto");
console.log(ok2 ? "PASS" : "FAIL", "devuelve recursos");
console.log(ok3 ? "PASS" : "FAIL", "id obsoleto ignorado");
console.log(ok4 ? "PASS" : "FAIL", "otro jugador no puede cancelar");
