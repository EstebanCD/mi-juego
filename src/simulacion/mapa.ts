// Valores posibles de cada capa. Son números por dentro (rápido y ligero),
// pero con nombres para que el código se lea bien.
export const Terreno = {
  Normal: 0,
  Agua: 1,
  Arcilloso: 2,
  Arena: 3,
  Rocoso: 4,
} as const;

export const Recurso = {
  Ninguno: 0,
  Arcilla: 1,
  Flor: 2,
  Planta: 3,
  Hongo: 4,
  Cristal: 5,
} as const;

export class Mapa {
  readonly ancho: number;
  readonly alto: number;
  readonly celdasRecursoModificadas = new Set<number>();

  // Una lista por capa, un valor por celda.
  private terreno: Uint8Array;
  private altura: Uint8Array;
  private rampa: Uint8Array; // 0 = no, 1 = sí
  private recurso: Uint8Array;
  private cantidad: Uint16Array; // recurso restante en la celda
  private bloqueo: Uint8Array; // 1 = celda ocupada por un edificio

  constructor(ancho: number, alto: number) {
    this.ancho = ancho;
    this.alto = alto;
    const total = ancho * alto;
    this.terreno = new Uint8Array(total);
    this.altura = new Uint8Array(total);
    this.rampa = new Uint8Array(total);
    this.recurso = new Uint8Array(total);
    this.cantidad = new Uint16Array(total);
    this.bloqueo = new Uint8Array(total);
  }

  // ¿La celda (x, y) existe dentro del mapa?
  dentro(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.ancho && y < this.alto;
  }

  // Convierte (x, y) en la posición dentro de la lista.
  private indice(x: number, y: number): number {
    return y * this.ancho + x;
  }

  // ---- Consultas básicas ----

  getTerreno(x: number, y: number): number {
    return this.terreno[this.indice(x, y)];
  }

  getAltura(x: number, y: number): number {
    return this.altura[this.indice(x, y)];
  }

  esRampa(x: number, y: number): boolean {
    return this.rampa[this.indice(x, y)] === 1;
  }

  getRecurso(x: number, y: number): number {
    return this.recurso[this.indice(x, y)];
  }

  getCantidad(x: number, y: number): number {
    return this.cantidad[this.indice(x, y)];
  }

  esAgua(x: number, y: number): boolean {
    return this.getTerreno(x, y) === Terreno.Agua;
  }

  estaBloqueada(x: number, y: number): boolean {
    return this.bloqueo[this.indice(x, y)] === 1;
  }

  // ---- Regla de movimiento terrestre ----
  // ¿Puede una unidad terrestre pasar de la celda A a la celda B vecina?
  puedePasar(ax: number, ay: number, bx: number, by: number): boolean {
    if (!this.dentro(ax, ay) || !this.dentro(bx, by)) return false;
    if (this.esAgua(bx, by)) return false;
    if (this.estaBloqueada(bx, by)) return false;

    const diferencia = Math.abs(this.getAltura(ax, ay) - this.getAltura(bx, by));
    if (diferencia === 0) return true;
    if (diferencia === 1) return this.esRampa(ax, ay) || this.esRampa(bx, by);
    return false;
  }

  // ---- Escritura (para construir mapas) ----

  setTerreno(x: number, y: number, valor: number): void {
    if (this.dentro(x, y)) this.terreno[this.indice(x, y)] = valor;
  }

  setAltura(x: number, y: number, valor: number): void {
    if (this.dentro(x, y)) this.altura[this.indice(x, y)] = valor;
  }

  setRampa(x: number, y: number, valor: boolean): void {
    if (this.dentro(x, y)) this.rampa[this.indice(x, y)] = valor ? 1 : 0;
  }

  setRecurso(x: number, y: number, tipo: number, cantidad: number): void {
    if (!this.dentro(x, y)) return;
    const i = this.indice(x, y);
    const anteriorTipo = this.recurso[i];
    const anteriorCantidad = this.cantidad[i];
    const cambio = anteriorTipo !== tipo || anteriorCantidad !== cantidad;
    this.recurso[i] = tipo;
    this.cantidad[i] = cantidad;
    if (cambio) this.celdasRecursoModificadas.add(i);
  }

  setBloqueada(x: number, y: number, valor: boolean): void {
    if (this.dentro(x, y)) this.bloqueo[this.indice(x, y)] = valor ? 1 : 0;
  }
}