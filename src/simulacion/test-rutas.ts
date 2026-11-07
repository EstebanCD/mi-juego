import { buscarRuta, pasoValido } from "./rutas";
import { crearMapaPrueba } from "./mapaPrueba";
import type { Mapa } from "./mapa";

type Celda = { x: number; y: number };

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function caminoValido(mapa: Mapa, camino: Celda[], inicio: Celda, destino: Celda): boolean {
  if (camino.length === 0) {
    return inicio.x === destino.x && inicio.y === destino.y;
  }

  let x = inicio.x;
  let y = inicio.y;
  for (const paso of camino) {
    if (!pasoValido(mapa, x, y, paso.x, paso.y)) return false;
    x = paso.x;
    y = paso.y;
  }
  return x === destino.x && y === destino.y;
}

function bfsCrudo(mapa: Mapa, ox: number, oy: number, dx: number, dy: number): Celda[] | null {
  const ancho = mapa.ancho;
  const inicio = oy * ancho + ox;
  const previo = new Int32Array(ancho * mapa.alto).fill(-1);
  const visitado = new Uint8Array(ancho * mapa.alto);
  const cola: number[] = [inicio];
  visitado[inicio] = 1;

  const vecinos: ReadonlyArray<readonly [number, number]> = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ];

  for (let i = 0; i < cola.length; i++) {
    const actual = cola[i];
    const ax = actual % ancho;
    const ay = (actual - ax) / ancho;

    for (const [vx, vy] of vecinos) {
      const nx = ax + vx;
      const ny = ay + vy;
      if (!mapa.dentro(nx, ny)) continue;
      if (!pasoValido(mapa, ax, ay, nx, ny)) continue;
      const idx = ny * ancho + nx;
      if (visitado[idx]) continue;
      visitado[idx] = 1;
      previo[idx] = actual;

      if (nx === dx && ny === dy) {
        const ruta: Celda[] = [];
        let c = idx;
        while (c !== inicio) {
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

function main(): void {
  const mapa = crearMapaPrueba();
  const rand = mulberry32(20240522);
  let validBefore = 0;
  let validAfter = 0;
  let totalRawMs = 0;
  let totalSmoothMs = 0;

  for (let i = 0; i < 200; i++) {
    const inicio = { x: randomInt(rand, 0, mapa.ancho - 1), y: randomInt(rand, 0, mapa.alto - 1) };
    const destino = { x: randomInt(rand, 0, mapa.ancho - 1), y: randomInt(rand, 0, mapa.alto - 1) };

    const t0 = performance.now();
    const rutaBase = bfsCrudo(mapa, inicio.x, inicio.y, destino.x, destino.y);
    totalRawMs += performance.now() - t0;

    const t1 = performance.now();
    const rutaSuavizada = buscarRuta(mapa, inicio.x, inicio.y, destino.x, destino.y);
    totalSmoothMs += performance.now() - t1;

    const beforeOk = rutaBase === null || caminoValido(mapa, rutaBase, inicio, destino);
    const afterOk = rutaSuavizada === null || caminoValido(mapa, rutaSuavizada, inicio, destino);

    if (beforeOk) validBefore++;
    if (afterOk) validAfter++;
  }

  console.log(`Pares aleatorios: 200`);
  console.log(`BFS crudo: ${validBefore}/200 válidos, avg ${totalRawMs / 200} ms por llamada`);
  console.log(`Ruta suavizada: ${validAfter}/200 válidos, avg ${totalSmoothMs / 200} ms por llamada`);
}

main();
