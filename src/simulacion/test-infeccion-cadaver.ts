import { Mapa } from "./mapa";
import { Simulacion } from "./simulacion";
import { TipoUnidad } from "./unidad";

const total = 1000;
let infectadas = 0;

for (let i = 0; i < total; i++) {
  const seed = ((i * 0x9e3779b9) >>> 0) ^ 0x12345678;
  const mapa = new Mapa(20, 20);
  const sim = new Simulacion(mapa, seed);
  const guerrera = sim.crearUnidad(TipoUnidad.Guerrera, 5, 5, 0);
  const cadaver = {
    id: 1,
    jugador: 0,
    x: 5,
    y: 5,
    nivel: 2,
    ticksRestantes: 100,
  };

  sim.cadaveres.push(cadaver);
  (sim as any).recogerCadaver(guerrera, cadaver);

  if (guerrera.enfermedadViral) {
    infectadas++;
  }
}

const fraccion = infectadas / total;
console.log(JSON.stringify({ total, infectadas, fraccion }, null, 2));

if (fraccion < 0.60 || fraccion > 0.70) {
  throw new Error(`La fracción infectada está fuera del rango esperado [0.60, 0.70]: ${fraccion}`);
}
