import { Mapa, Terreno, Recurso } from "./mapa";
import { buscarRuta } from "./rutas";

export function crearMapaPrueba(): Mapa {
  const mapa = new Mapa(160, 160);

  // Un río vertical serpenteante en las columnas centrales
  for (let y = 0; y < 160; y++) {
    const col = 80 + Math.floor(Math.sin(y * 0.05) * 15);
    for (let c = 0; c < 3; c++) {
      if (y !== 78 && y !== 79 && y !== 80) {
        mapa.setTerreno(col + c, y, Terreno.Agua);
      }
    }
  }

  // Charcos dispersos
  for (let cy = 20; cy < 140; cy += 40) {
    for (let y = cy; y < cy + 5; y++) {
      for (let x = 20; x < 26; x++) mapa.setTerreno(x, y, Terreno.Agua);
      for (let x = 130; x < 136; x++) mapa.setTerreno(x, y, Terreno.Agua);
    }
  }

  // Mesetas y elevaciones montañosas con rampas
  for (let y = 10; y < 40; y++) {
    for (let x = 110; x < 145; x++) {
      mapa.setAltura(x, y, 1);
      if (x === 110 && y === 25) {
        mapa.setRampa(x, y, true);
        mapa.setAltura(x, y, 0);
      }
    }
  }

  for (let y = 120; y < 150; y++) {
    for (let x = 15; x < 50; x++) {
      mapa.setAltura(x, y, 2);
    }
  }

  // Escalón intermedio de altura 1 para llegar al segundo plateau desde tierra.
  for (let y = 133; y <= 137; y++) {
    for (let x = 50; x <= 51; x++) {
      mapa.setAltura(x, y, 1);
      mapa.setRampa(x, y, true);
    }
  }
  mapa.setRampa(50, 135, true);
  mapa.setRampa(49, 135, true);

  // Terrenos arcillosos, arenosos y rocosos con recursos ricos
  for (let y = 0; y < 160; y += 15) {
    for (let x = 0; x < 160; x += 20) {
      const tipoT = (x + y) % 4;
      for (let dy = 0; dy < 6; dy++) {
        for (let dx = 0; dx < 6; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (mapa.dentro(nx, ny) && !mapa.esAgua(nx, ny)) {
            if (tipoT === 0) {
              mapa.setTerreno(nx, ny, Terreno.Arcilloso);
              mapa.setRecurso(nx, ny, Recurso.Arcilla, 80);
            } else if (tipoT === 1) {
              mapa.setTerreno(nx, ny, Terreno.Arena);
              mapa.setRecurso(nx, ny, Recurso.Hongo, 50);
            } else if (tipoT === 2) {
              mapa.setTerreno(nx, ny, Terreno.Rocoso);
              mapa.setRecurso(nx, ny, Recurso.Cristal, 40);
            } else {
              mapa.setRecurso(nx, ny, Recurso.Flor, 50);
            }
          }
        }
      }
    }
  }

  const ruta = buscarRuta(mapa, 60, 135, 30, 135);
  console.log(
    `[mapaPrueba] ruta (60,135) -> (30,135): ${ruta ? "existe" : "no existe"}`
  );

  return mapa;
}
