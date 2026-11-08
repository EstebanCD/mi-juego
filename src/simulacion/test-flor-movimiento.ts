Object.defineProperty(import.meta, "env", { value: { DEV: false }, configurable: true });
(globalThis as any).window ??= {
  addEventListener() {},
  removeEventListener() {},
  navigator: { userAgent: "node", maxTouchPoints: 0 },
  document: undefined,
};
const createCanvasContext = () => ({
  fillRect() {},
  clearRect() {},
  getImageData() { return { data: new Uint8ClampedArray(4) }; },
  putImageData() {},
  createImageData() { return { data: new Uint8ClampedArray(4) }; },
  setTransform() {},
  drawImage() {},
  save() {},
  restore() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  closePath() {},
  stroke() {},
  translate() {},
  scale() {},
  rotate() {},
  arc() {},
  fill() {},
  measureText() { return { width: 0 }; },
  fillText() {},
  strokeText() {},
  canvas: {},
});
(globalThis as any).document ??= {
  documentElement: {},
  createElement: () => ({ style: {}, getContext: createCanvasContext }),
  body: { appendChild() {} },
};
(globalThis as any).Image ??= class {
  width = 0;
  height = 0;
  setAttribute() {}
  getContext() { return {}; }
};
(globalThis as any).HTMLCanvasElement ??= class {
  getContext() { return {}; }
};
(globalThis as any).navigator ??= { userAgent: "node", maxTouchPoints: 0 };
(globalThis as any).window.document = (globalThis as any).document;

const { Mapa, Recurso } = await import("./mapa.ts");
const { Simulacion } = await import("./simulacion.ts");
const { TipoUnidad } = await import("./unidad.ts");
const { EscenaJuego } = await import("../cliente/EscenaJuego.ts");

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const mapa = new Mapa(20, 20);
mapa.setRecurso(8, 8, Recurso.Flor, 50);
const sim = new Simulacion(mapa);
const pulgon = sim.crearUnidad(TipoUnidad.Pulgones, 7, 8, 0);
const obrera = sim.crearUnidad(TipoUnidad.Obrera, 9, 8, 0);
const guerrera = sim.crearUnidad(TipoUnidad.Guerrera, 10, 8, 0);

const escena = Object.create(EscenaJuego.prototype) as any;
escena.sim = sim;
escena.seleccionadas = new Set([pulgon.id, obrera.id, guerrera.id]);
escena.jugadorLocal = 0;
escena.resetModosAccion = () => {};
escena.mostrarMarcador = () => {};
escena.mostrarMensajeError = () => {};
escena.asignarDomesticacion = () => {};
escena.guerrerasSeleccionadas = () => [guerrera];
escena.celdasDestino = (cx: number, cy: number, n: number) => {
  const result: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    result.push({ x: cx + i, y: cy });
  }
  return result;
};

escena.darOrdenAUnidades(8, 8);

const ordenes = sim["ordenes"];
assert(ordenes.some((o: any) => o.tipo === "recolectar" && o.unidadId === pulgon.id), "Los pulgones deben seguir usando recolectar sobre la flor");
assert(!ordenes.some((o: any) => o.tipo === "recolectar" && o.unidadId === obrera.id), "Las obreras no deben enviar orden de recolección a una flor");
assert(!ordenes.some((o: any) => o.tipo === "recolectar" && o.unidadId === guerrera.id), "Las guerreras no deben enviar orden de recolección a una flor");
assert(ordenes.some((o: any) => o.tipo === "mover" && o.unidadId === obrera.id), "Las obreras deben recibir mover hacia la flor");
assert(ordenes.some((o: any) => o.tipo === "mover" && o.unidadId === guerrera.id), "Las guerreras deben recibir mover hacia la flor");
assert(!mapa.estaBloqueada(8, 8), "La flor no debe bloquear el paso de las unidades");
assert(sim.esRecolectable(8, 8), "La flor debe seguir siendo recolectable para los pulgones");

console.log("PASS: flor movible para no pulgones");
