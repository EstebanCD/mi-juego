import { Mapa, Terreno, Recurso } from "./mapa";

export function crearMapaPrueba(): Mapa {
  const mapa = new Mapa(32, 32);

  // Un río vertical en la columna 16 (con un hueco de 2 celdas: un vado
  // no existe todavía, así que lo dejamos como paso para probar rutas)
  for (let y = 0; y < 32; y++) {
    if (y !== 15 && y !== 16) mapa.setTerreno(16, y, Terreno.Agua);
  }

  // Un charco
  for (let y = 5; y < 8; y++) {
    for (let x = 6; x < 9; x++) mapa.setTerreno(x, y, Terreno.Agua);
  }

  // Una meseta de altura 1 en la esquina superior derecha
  for (let y = 2; y < 9; y++) {
    for (let x = 22; x < 29; x++) mapa.setAltura(x, y, 1);
  }
  // Rampa para subir a la meseta
  mapa.setRampa(21, 5, true);
  mapa.setAltura(21, 5, 0);

  // Terreno arcilloso con arcilla
  for (let y = 22; y < 27; y++) {
    for (let x = 4; x < 10; x++) {
      mapa.setTerreno(x, y, Terreno.Arcilloso);
      mapa.setRecurso(x, y, Recurso.Arcilla, 50);
    }
  }

  // Flores
  mapa.setRecurso(12, 10, Recurso.Flor, 20);
  mapa.setRecurso(20, 24, Recurso.Flor, 20);
  mapa.setRecurso(25, 14, Recurso.Flor, 20);

  return mapa;
}