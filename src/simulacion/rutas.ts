import type { Mapa } from "./mapa";

const VECINOS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

// Devuelve la lista de celdas desde el origen (sin incluirlo) hasta el destino,
// o null si no hay camino. BFS: ruta más corta con coste uniforme.
export function buscarRuta(
  mapa: Mapa,
  ox: number,
  oy: number,
  dx: number,
  dy: number
): Array<{ x: number; y: number }> | null {
  if (!mapa.dentro(dx, dy)) return null;
  if (ox === dx && oy === dy) return [];

  const ancho = mapa.ancho;
  const previo = new Int32Array(ancho * mapa.alto).fill(-1);
  const visitado = new Uint8Array(ancho * mapa.alto);
  const cola: number[] = [oy * ancho + ox];
  visitado[oy * ancho + ox] = 1;

  for (let i = 0; i < cola.length; i++) {
    const actual = cola[i];
    const ax = actual % ancho;
    const ay = (actual - ax) / ancho;

    for (const [vx, vy] of VECINOS) {
      const nx = ax + vx;
      const ny = ay + vy;
      if (!mapa.puedePasar(ax, ay, nx, ny)) continue;
      const idx = ny * ancho + nx;
      if (visitado[idx]) continue;
      visitado[idx] = 1;
      previo[idx] = actual;

      if (nx === dx && ny === dy) {
        const ruta: Array<{ x: number; y: number }> = [];
        let c = idx;
        while (c !== oy * ancho + ox) {
          const cx = c % ancho;
          ruta.push({ x: cx, y: (c - cx) / ancho });
          c = previo[c];
        }
        return ruta.reverse();
      }
      cola.push(idx);
    }
  }
  return null;
}