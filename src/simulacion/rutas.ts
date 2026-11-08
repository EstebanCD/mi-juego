import type { Mapa } from "./mapa";

type Celda = { x: number; y: number };

const VECINOS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

// Un paso entre celdas vecinas (incluye diagonales). En diagonal, las dos
// celdas laterales también deben ser transitables: así no se cortan esquinas.
export function pasoValido(
  mapa: Mapa,
  ax: number,
  ay: number,
  bx: number,
  by: number
): boolean {
  if (!mapa.puedePasar(ax, ay, bx, by)) return false;
  if (ax !== bx && ay !== by) {
    return mapa.puedePasar(ax, ay, bx, ay) && mapa.puedePasar(ax, ay, ax, by);
  }
  return true;
}

// Celdas de la línea recta (Bresenham), sin incluir el origen.
function linea(x0: number, y0: number, x1: number, y1: number): Celda[] {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  const salida: Celda[] = [];
  while (x !== x1 || y !== y1) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    salida.push({ x, y });
  }
  return salida;
}

function lineaLibre(
  mapa: Mapa,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  let px = x0;
  let py = y0;
  for (const c of linea(x0, y0, x1, y1)) {
    if (!pasoValido(mapa, px, py, c.x, c.y)) return false;
    px = c.x;
    py = c.y;
  }
  return true;
}

// BFS en 8 direcciones. Devuelve celdas desde el origen (sin incluirlo)
// hasta el destino, o null si no hay camino.
function bfs(
  mapa: Mapa,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxNodos = 6000
): Celda[] | null {
  const ancho = mapa.ancho;
  const inicio = oy * ancho + ox;
  const previo = new Int32Array(ancho * mapa.alto).fill(-1);
  const visitado = new Uint8Array(ancho * mapa.alto);
  const cola: number[] = [inicio];
  visitado[inicio] = 1;

  for (let i = 0; i < cola.length; i++) {
    if (cola.length >= maxNodos) return null;
    const actual = cola[i];
    const ax = actual % ancho;
    const ay = (actual - ax) / ancho;

    for (const [vx, vy] of VECINOS) {
      const nx = ax + vx;
      const ny = ay + vy;
      if (!mapa.dentro(nx, ny)) continue;
      if (!pasoValido(mapa, ax, ay, nx, ny)) continue;
      const idx = ny * ancho + nx;
      if (visitado[idx]) continue;
      if (cola.length >= maxNodos) return null;
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

// Ruta final: BFS + suavizado. Desde cada punto salta al más lejano al que
// se llega en línea recta, y rellena el tramo con las celdas de esa línea.
export function buscarRuta(
  mapa: Mapa,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxNodos = Math.max(6000, mapa.ancho * mapa.alto)
): Celda[] | null {
  if (!mapa.dentro(dx, dy)) return null;
  if (ox === dx && oy === dy) return [];

  const base = bfs(mapa, ox, oy, dx, dy, maxNodos);
  if (!base) return null;

  const puntos: Celda[] = [{ x: ox, y: oy }, ...base];
  const ruta: Celda[] = [];
  const lookahead = 24;
  let i = 0;
  while (i < puntos.length - 1) {
    let j = i;
    let siguiente = i + 1;
    while (siguiente < puntos.length && siguiente - i <= lookahead && lineaLibre(mapa, puntos[i].x, puntos[i].y, puntos[siguiente].x, puntos[siguiente].y)) {
      j = siguiente;
      siguiente++;
    }
    if (j === i) {
      j = i + 1;
    }
    ruta.push(...linea(puntos[i].x, puntos[i].y, puntos[j].x, puntos[j].y));
    i = j;
  }
  return ruta;
}

// BFS hacia la celda más cercana que cumpla `esMeta`. Devuelve la ruta
// (sin incluir el origen) o null. Si el origen ya es meta, devuelve [].
export function buscarRutaA(
  mapa: Mapa,
  ox: number,
  oy: number,
  esMeta: (x: number, y: number) => boolean,
  maxNodos = Math.max(6000, mapa.ancho * mapa.alto)
): Celda[] | null {
  if (esMeta(ox, oy)) return [];
  const ancho = mapa.ancho;
  const inicio = oy * ancho + ox;
  const previo = new Int32Array(ancho * mapa.alto).fill(-1);
  const visitado = new Uint8Array(ancho * mapa.alto);
  const cola: number[] = [inicio];
  visitado[inicio] = 1;

  for (let i = 0; i < cola.length; i++) {
    if (cola.length >= maxNodos) return null;
    const actual = cola[i];
    const ax = actual % ancho;
    const ay = (actual - ax) / ancho;

    for (const [vx, vy] of VECINOS) {
      const nx = ax + vx;
      const ny = ay + vy;
      if (!mapa.dentro(nx, ny)) continue;
      if (!pasoValido(mapa, ax, ay, nx, ny)) continue;
      const idx = ny * ancho + nx;
      if (visitado[idx]) continue;
      if (cola.length >= maxNodos) return null;
      visitado[idx] = 1;
      previo[idx] = actual;

      if (esMeta(nx, ny)) {
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