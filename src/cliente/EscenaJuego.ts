import Phaser from "phaser";
import { Terreno, Recurso } from "../simulacion/mapa";
import { crearMapaPrueba } from "../simulacion/mapaPrueba";
import { DATOS_EDIFICIO, EDIFICIOS_CONSTRUIBLES_POR_OBRERA, FORMAS_EDIFICIO, type Edificio } from "../simulacion/edificio";
import { type Cadaver } from "../simulacion/cadaver";
import { DATOS_UNIDAD, Estado, type Unidad } from "../simulacion/unidad";
import {
  Simulacion,
  ATAQUES_POR_SEGUNDO,
  TICKS_POR_SEGUNDO,
  TICKS_DOMESTICACION_PULGON,
  MS_POR_TICK,
  TICKS_POR_PASO,
  TipoUnidad,
  TipoEdificio,
  type EventoEntrega,
  type EventoAtaque,
  type EventoCuracion,
  type EventoError,
  type EventoPodredumbre,
  type EventoEnfermedadCurada,
} from "../simulacion/simulacion";
import type { ObjetivoCombate } from "../simulacion/unidad";

const DEBUG = typeof import.meta !== "undefined" && import.meta.env ? !!import.meta.env.DEV : false;

const TAM = 32; // tamaño de celda en pantalla (px)
const ALTO_HUD_INFERIOR = 176;
const MAX_CELDAS_ARRASTRE = 40;
const BTN_W = 78;
const BTN_H = 72;
const BTN_GAP = 6;
const ACCION_BTN_W = 104;
const ACCION_BTN_H = 34;
const ACCION_BTN_GAP = 8;
const COLA_BTN_W = 230; // ancho de los botones de la lista de producción (antes 72)
const COLA_BTN_H = 17;
const COLA_BTN_PASO = 19; // separación vertical entre botones
// Hotkeys de los botones. La letra de la tecla se subraya en el texto del botón
// (primera aparición de esa letra en la etiqueta).
const HOTKEY_ACCION: Record<string, string> = {
  Attack: "A",
  Build: "B",
  Tame: "T",
  "Repair Building": "R",
  "Carry Corpse": "C",
  "Leave Corpse": "C",
  "Cure Disease": "C",
  "Delete building": "D",
};
const HOTKEY_EDIFICIO: Record<number, string> = {
  [TipoEdificio.Palacio]: "P",
  [TipoEdificio.Torre]: "T",
  [TipoEdificio.Madriguera]: "D", // se muestra como "Depósito"
  [TipoEdificio.Muralla]: "M",
};
const COLA_GAP_A_ACCIONES = 14; // separación mínima entre la lista y la columna de botones de unidades
const COLA_BTN_W_MIN = 150; // ancho mínimo si la ventana es muy estrecha
const HUD_PADDING = 12;
// Velocidad visual constante (px/s), ligada a la velocidad real de la simulación.
// El 1.1 evita que el círculo se quede cada vez más rezagado.
const VELOCIDAD_VISUAL = (TAM / (TICKS_POR_PASO * MS_POR_TICK)) * 1000 * 1.1;

// Nombres para mostrar en el panel (el índice es el valor numérico de la simulación)
const NOMBRES_TERRENO = ["Normal", "Agua", "Arcilloso", "Arena", "Rocoso"];
const NOMBRES_RECURSO = ["Ninguno", "Arcilla", "Flor", "Planta", "Hongo", "Cristal"];
const NOMBRES_ESTADO = [
  "Libre",
  "Yendo al recurso",
  "Recogiendo",
  "Yendo al depósito",
  "Entregando",
  "Atacando",
  "Recogiendo néctar",
  "Reparando edificio",
  "Yendo a domesticar",
  "Domesticando",
  "Yendo al cadáver",
  "Yendo a dejar el cadáver",
  "Construyendo",
];
const COLOR_CARGA_AGUA = 0x4aa8ff;
const COLOR_CARGA_ARCILLA = 0xffd23f;
const COLOR_CARGA_NECTAR = 0xff69b4;
const PALETA_JUGADORES = [
  { unidad: 0x3478f6, edificio: 0x2858b8, borde: 0xa9c8ff },
  { unidad: 0xd94a4a, edificio: 0xa83232, borde: 0xffb0b0 },
  { unidad: 0x35a56b, edificio: 0x267d4f, borde: 0xa9f0c5 },
  { unidad: 0xc36a20, edificio: 0x8c4a16, borde: 0xffd19a },
];
const PALETA_GAIA = { unidad: 0x8c9a83, edificio: 0x69745f, borde: 0xd1dac8 };

interface BarraSalud {
  bg: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  maximo: number;
}

interface BarraDomesticacion {
  bg: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
}

interface AnimacionPulgonCurando {
  halo: Phaser.GameObjects.Arc;
}

interface AnimacionPulgonRecolectandoFlor {
  shape: Phaser.GameObjects.Shape;
}

export class EscenaJuego extends Phaser.Scene {
  private readonly jugadorLocal = 0;
  private teclas!: Phaser.Types.Input.Keyboard.CursorKeys;
  private teclaAtaque!: Phaser.Input.Keyboard.Key;
  private teclaEscape!: Phaser.Input.Keyboard.Key;
  private teclaF3!: Phaser.Input.Keyboard.Key;
  private debugText!: Phaser.GameObjects.Text;
  private debugVisible = true;
  private debugTickMs: number[] = [];
  private debugFrameDeltas: number[] = [];
  private debugLastOverlayMs = 0;
  private modoAtaque = false;
  private modoCuracion = false;
  private modoReparacionEdificio = false;
  private modoDomesticar = false;
  private modoLlevarCadaver = false;
  private readonly cursorPuntoRojo = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Ccircle cx='6' cy='6' r='4' fill='%23ff3030' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E\") 6 6, crosshair";
  private readonly cursorPuntoAzul = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Ccircle cx='6' cy='6' r='4' fill='%233478f6' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E\") 6 6, crosshair";
  private readonly cursorPuntoVerde = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Ccircle cx='6' cy='6' r='4' fill='%232ecc71' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E\") 6 6, crosshair";
  private readonly cursorPuntoAmarillo = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Ccircle cx='6' cy='6' r='4' fill='%23f4c542' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E\") 6 6, crosshair";
  private sim!: Simulacion;
  private acumulador = 0;
  private textoMensajeError = "";
  private temporizadorError = 0;
  private textoErrorHUD!: Phaser.GameObjects.Text;
  private textoTick!: Phaser.GameObjects.Text;
  private grupoInfoHUD!: Phaser.GameObjects.Container;
  private textoInfo!: Phaser.GameObjects.Text;
  private textoColaProduccion!: Phaser.GameObjects.Text;
  private filasColaProduccion: Array<{
    bg: Phaser.GameObjects.Rectangle;
    progreso: Phaser.GameObjects.Rectangle;
    texto: Phaser.GameObjects.Text;
    cruz: Phaser.GameObjects.Text;
    nombre: string;
    itemId: number | undefined;
  }> = [];
  private botonesColaProduccion: Phaser.GameObjects.Rectangle[] = [];
  private claveColaProduccion = "";
  private anchoColaActual = COLA_BTN_W;
  private textoEnfermedadHUD!: Phaser.GameObjects.Text;
  private textoRegenHUD!: Phaser.GameObjects.Text;
  private ultimoTextoRegenHUD = "";
  private overlayNoche!: Phaser.GameObjects.Rectangle;
  private hudTopBg!: Phaser.GameObjects.Rectangle;
  private hudBottomBg!: Phaser.GameObjects.Graphics;
  private graficoCeldasAgotadas!: Phaser.GameObjects.Graphics;
  private floresBlitter?: Phaser.GameObjects.Blitter;
  private readonly floresBobs = new Map<number, {
    setFrame: (frame: number | string) => void;
    setVisible: (value: boolean) => void;
    visible: boolean;
  }>();
  private floresCantidadInicial = new Uint16Array();
  private terrenoMapas: Phaser.GameObjects.Image[] = [];
  private readonly terrenoTextureKeys: string[] = [];
  private minimapaTerrenoImage?: Phaser.GameObjects.Image;
  private botonSaludBg!: Phaser.GameObjects.Rectangle;
  private textoBotonSalud!: Phaser.GameObjects.Text;
  private graficoMinimapa!: Phaser.GameObjects.Graphics;
  private graficoBarrasUnidades!: Phaser.GameObjects.Graphics;
  private readonly MINIMAPA_INTERVALO_MS = 100;
  private ultimoMinimapaDinamico = 0;
  private rectMM = { x: 15, y: 0, w: 80, h: 74 };
  private minimapaTerrenoSucio = true;
  private rectSeleccionCelda!: Phaser.GameObjects.Rectangle;
  private graficoSeleccionEdificio!: Phaser.GameObjects.Graphics;
  private brilloSeleccionEdificio!: Phaser.GameObjects.Image;
  private marcadorRendezvous!: Phaser.GameObjects.Rectangle;
  private camUI!: Phaser.Cameras.Scene2D.Camera;
  private circulos = new Map<number, Phaser.GameObjects.Shape>();
  private edificiosVisuales = new Map<number, Phaser.GameObjects.Image>();
  private cadaveresVisuales = new Map<number, Phaser.GameObjects.Rectangle>();
  // Posición visual "base" de cada unidad (sigue a su celda) y un desvío
  // temporal encima (por ejemplo, el acercamiento al entregar).
  private bases = new Map<number, { x: number; y: number }>();
  private angulos = new Map<number, number>();
  private angulosDeseados = new Map<number, number>();
  private giroForzadoHasta = new Map<number, number>();
  private unidadVisible = new Map<number, boolean>();
  private barrasSalud = new Map<number, BarraSalud>();
  private coloresOriginalesFlash = new WeakMap<
    Phaser.GameObjects.Shape | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image,
    { color: number; temporizador: Phaser.Time.TimerEvent }
  >();
  private animacionesPulgonesCurando = new Map<number, AnimacionPulgonCurando>();
  private animacionesPulgonesRecolectandoFlor = new Map<number, AnimacionPulgonRecolectandoFlor>();
  private animacionesFlorCosechada = new Map<string, Phaser.GameObjects.Arc>();
  private animacionesReparacion = new Set<number>();
  private animacionesDomesticacion = new Set<number>();
  private barrasDomesticacion = new Map<number, BarraDomesticacion>();
  private readonly celdasConRecurso = new Set<number>();
  private animacionesCadaveres = new Map<number, { cargado: boolean; animInicio: number; animTipo: "carga" | "descarga" | null }>();
  private liveUnitIds = new Set<number>();
  private liveBuildingIds = new Set<number>();
  private liveCorpseIds = new Set<number>();
  private unitById = new Map<number, Unidad>();
  private buildingById = new Map<number, Edificio>();
  private corpseById = new Map<number, Cadaver>();
  private mostrarBarrasSalud = true;
  private seleccionadas = new Set<number>();
  private unidadInspeccionadaEnemiga: number | null = null;
  private cadaverInspeccionadoId: number | null = null;
  private alternarColorRendezvous = false;
  private esArrastrandoMarquesina = false;
  private huboArrastre = false;
  private panArrastrando = false;
  private ultimoDobleClick = { x: 0, y: 0, t: 0 };
  private arrastrandoMinimapa = false;
  private inicioArrastre = { x: 0, y: 0 };
  private graficoMarquesina!: Phaser.GameObjects.Graphics;
  private graficoAtaques!: Phaser.GameObjects.Graphics;
  private ataquesActivos: Array<{ x1: number; y1: number; x2: number; y2: number; hasta: number }> = [];
  private marcadoresPool: Phaser.GameObjects.Rectangle[] = [];
  private marcadoresOcupados = new Set<number>();
  private textosFlotantesPool: Phaser.GameObjects.Text[] = [];
  private textosFlotantesOcupados = new Set<number>();
  private textosFlotantesTokens = new Map<Phaser.GameObjects.Text, number>();
  private desplazamientoTextoCuracion = new Map<number, number>();
  private ataquesTweenPorUnidad = new Map<number, Phaser.Tweens.Tween>();
  private notifTimer?: Phaser.Time.TimerEvent;
  private seleccionadaEdificio: number | null = null;
  private celdaInfo: { x: number; y: number } | null = null;
  private barrasProgresoPorEdificio = new Map<number, {
    bg: Phaser.GameObjects.Rectangle;
    bar: Phaser.GameObjects.Rectangle;
    txt: Phaser.GameObjects.Text;
  }>();
  private colasEdificiosDirty = true;
  private panelDirty = true;
  private ultimoRefrescoBarrasProgreso = 0;
  private ultimoPanelRefreshMs = 0;
  private ultimoTextoPanel: string | null = null;
  private ultimoTextoTick = "";
  private ultimoTextoEnfermedadHUD = "";
  private textoNotifCreacion?: Phaser.GameObjects.Text;
  private botonesAccion: Phaser.GameObjects.Rectangle[] = [];
  private textosBotonAccion: Phaser.GameObjects.Text[] = [];
  private accionesBotonesActuales: Array<{ label: string; accion: string }> = [];
  private textosCostoAccion: Array<{ texto: Phaser.GameObjects.Text; recurso: "agua" | "arcilla" | "nectar"; valor: number }> = [];
  private textosCostoConstruccion: Array<{ texto: Phaser.GameObjects.Text; recurso: "agua" | "arcilla" | "nectar"; valor: number }> = [];
  private botonesConstruccion: Phaser.GameObjects.Rectangle[] = [];
  private textosBotonConstruccion: Phaser.GameObjects.Text[] = [];
  private tiposBotonesConstruccion: number[] = [];
  private subrayadosBotonAccion: Phaser.GameObjects.Rectangle[] = [];
  private subrayadosBotonConstruccion: Phaser.GameObjects.Rectangle[] = [];
  private tooltipHUD?: Phaser.GameObjects.Text;
  private tooltipTimer?: Phaser.Time.TimerEvent;
  private ctxMedicionTexto: CanvasRenderingContext2D | null = null;
  private ultimoRefrescoCostos = 0;
  private modoConstruccion: number | null = null;
  private menuConstruccionAbierto = false;
  private clicConsumidoPorHUD = false;
  private pointerDownEnHUD = false;
  private arrastreConstruccion: { inicio: { x: number; y: number }; fin: { x: number; y: number } } | null = null;
  private previewLinea: Phaser.GameObjects.Image[] = [];
  private textoCosteLinea?: Phaser.GameObjects.Text;
  private previewTipo: number | null = null;
  private previewConstruccion?: Phaser.GameObjects.Image;

  constructor() {
    super("EscenaJuego");
  }

  private esConstruccionArrastrable(tipo: number | null): boolean {
    return tipo === TipoEdificio.Muralla;
  }

  private resetModosAccion(): void {
    this.modoAtaque = false;
    this.modoCuracion = false;
    this.modoReparacionEdificio = false;
    this.modoDomesticar = false;
    this.modoLlevarCadaver = false;
    this.modoConstruccion = null;
    this.arrastreConstruccion = null;
    this.previewTipo = null;
    this.menuConstruccionAbierto = false;
    this.pointerDownEnHUD = false;
    this.clicConsumidoPorHUD = false;
    this.limpiarBotonesConstruccion();
    this.limpiarBotonesAccion();
    if (this.previewConstruccion) this.previewConstruccion.setVisible(false);
    this.previewLinea.forEach((item) => item.destroy());
    this.previewLinea = [];
    if (this.textoCosteLinea) this.textoCosteLinea.destroy();
    this.textoCosteLinea = undefined;
    this.actualizarCursorModoSeleccion();
  }

  private coloresJugador(jugador: number): (typeof PALETA_JUGADORES)[number] {
    return jugador < 0 ? PALETA_GAIA : PALETA_JUGADORES[jugador % PALETA_JUGADORES.length];
  }

  private obtenerColorHudSeleccionado(): number | null {
    if (this.seleccionadaEdificio !== null) {
      const edificio = this.buildingById.get(this.seleccionadaEdificio);
      if (edificio) return edificio.jugador;
    }

    const unidadInspeccionada = this.unidadInspeccionadaEnemiga !== null ? this.unitById.get(this.unidadInspeccionadaEnemiga) : undefined;
    if (unidadInspeccionada) return unidadInspeccionada.jugador;

    const unidades = this.sim.unidades.filter((u) => this.seleccionadas.has(u.id));
    if (unidades.length === 0) return null;

    const jugadores = [...new Set(unidades.map((u) => u.jugador))];
    if (jugadores.length !== 1) return null;
    return jugadores[0];
  }

  private actualizarFondoHudPorSeleccion(): void {
    const sw = this.scale.width;
    const sh = this.scale.height;
    const colorJugador = this.obtenerColorHudSeleccionado();
    const lineaAltura = 4;

    this.hudBottomBg.clear();
    this.hudBottomBg.fillGradientStyle(0x0b0b12, 0x0b0b12, 0x0b0b12, 0x0b0b12, 0, 0, 0.93, 0.93);
    this.hudBottomBg.fillRect(0, sh - ALTO_HUD_INFERIOR, sw, ALTO_HUD_INFERIOR);

    if (colorJugador === null || colorJugador === undefined) return;

    const paleta = this.coloresJugador(colorJugador);
    const alphaBase = 0.36;
    const y = sh - ALTO_HUD_INFERIOR + ALTO_HUD_INFERIOR - lineaAltura;
    this.hudBottomBg.fillGradientStyle(paleta.edificio, paleta.edificio, paleta.unidad, paleta.unidad, 0, 0, alphaBase, alphaBase);
    this.hudBottomBg.fillRect(0, y, sw, lineaAltura);
  }

  private radioUnidad(tipo: number): number {
    if (tipo === TipoUnidad.Pulgones) return 4.5;
    if (tipo === TipoUnidad.Voladora) return 10;
    if (tipo === TipoUnidad.GuerreraVoladora) return 12;
    if (tipo === TipoUnidad.Reina || tipo === TipoUnidad.ReinaJoven) return 14;
    return 9;
  }

  private crearFormaUnidad(
    x: number,
    y: number,
    unidad: { tipo: number; jugador: number }
  ): Phaser.GameObjects.Shape {
    const color = this.coloresJugador(unidad.jugador).unidad;
    const radio = this.radioUnidad(unidad.tipo);
    let forma: Phaser.GameObjects.Shape;
    if (unidad.tipo === TipoUnidad.Guerrera) {
      forma = this.add.polygon(x, y, this.verticesPoligono(6, radio), color).setOrigin(0.5, 0.5);
    } else if (unidad.tipo === TipoUnidad.Reina || unidad.tipo === TipoUnidad.ReinaJoven) {
      forma = this.add.polygon(x, y, this.verticesEstrella(7, radio, radio * 0.52), color).setOrigin(0.5, 0.5);
      forma.setRotation(Math.PI / 2);
    } else if (unidad.tipo === TipoUnidad.Voladora) {
      forma = this.add.polygon(x, y, [9, 0, 18, 22, 0, 22], color).setOrigin(0.5, 2 / 3);
    } else if (unidad.tipo === TipoUnidad.GuerreraVoladora) {
      forma = this.add.polygon(x, y, [11, 0, 22, 26, 0, 26], color).setOrigin(0.5, 2 / 3);
    } else {
      forma = this.add.circle(x, y, radio, color);
    }
    return forma.setDepth(4);
  }

  private verticesPoligono(lados: number, radio: number): number[] {
    const vertices: number[] = [];
    for (let i = 0; i < lados; i++) {
      const angulo = -Math.PI / 2 + (i * Math.PI * 2) / lados;
      vertices.push(radio + Math.cos(angulo) * radio, radio + Math.sin(angulo) * radio);
    }
    return vertices;
  }

  private verticesEstrella(puntas: number, radioExterior: number, radioInterior: number): number[] {
    const puntos: number[] = [];
    const total = puntas * 2;
    for (let i = 0; i < total; i++) {
      const angulo = -Math.PI / 2 + (i * Math.PI) / puntas;
      const radio = i % 2 === 0 ? radioExterior : radioInterior;
      puntos.push(
        radio * Math.cos(angulo),
        radio * Math.sin(angulo)
      );
    }
    return puntos;
  }

  private verticesTrianguloRotado(cx: number, cy: number, ancho: number, alto: number, rot: number): number[] {
    const puntos = [
      { x: 0, y: (-2 * alto) / 3 },
      { x: ancho / 2, y: alto / 3 },
      { x: -ancho / 2, y: alto / 3 },
    ];
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const salida: number[] = [];
    for (const punto of puntos) {
      const xr = punto.x * cos - punto.y * sin;
      const yr = punto.x * sin + punto.y * cos;
      salida.push(cx + xr, cy + yr);
    }
    return salida;
  }

  private hayUnidadSeleccionadaQuePuedeAtacar(): boolean {
    return this.sim.unidades.some(
      (unidad) => this.seleccionadas.has(unidad.id) && (DATOS_UNIDAD[unidad.tipo]?.atk ?? 0) > 0
    );
  }

  private hayEdificioSeleccionadoQuePuedeAtacar(): boolean {
    if (this.seleccionadaEdificio === null) return false;
    const edificio = this.sim.edificios.find((e) => e.id === this.seleccionadaEdificio);
    return !!edificio && !edificio.enConstruccion && (DATOS_EDIFICIO[edificio.tipo]?.atk ?? 0) > 0;
  }

  private guerrerasSeleccionadas(): Unidad[] {
    return [...this.seleccionadas]
      .map((id) => this.sim.unidades.find((u) => u.id === id))
      .filter((u): u is Unidad => !!u && u.tipo === TipoUnidad.Guerrera && u.jugador === this.jugadorLocal);
  }

  private actualizarCursorModoSeleccion(): void {
    this.game.canvas.style.cursor = this.modoAtaque
      ? this.cursorPuntoRojo
      : this.modoDomesticar
        ? this.cursorPuntoAzul
        : this.modoCuracion || this.modoLlevarCadaver
          ? this.cursorPuntoVerde
          : this.modoReparacionEdificio
            ? this.cursorPuntoAmarillo
            : "";
  }

  private actualizarOverlayDebug(): void {
    if (!DEBUG) return;
    const countText = this.children.list.filter((child) => child instanceof Phaser.GameObjects.Text).length;
    const fps = this.game.loop.actualFps;
    const avgTick = this.debugTickMs.length
      ? this.debugTickMs.reduce((sum, value) => sum + value, 0) / this.debugTickMs.length
      : 0;
    const maxTick = this.debugTickMs.length ? Math.max(...this.debugTickMs) : 0;
    const avgDelta = this.debugFrameDeltas.length
      ? this.debugFrameDeltas.reduce((sum, value) => sum + value, 0) / this.debugFrameDeltas.length
      : 0;
    const rendererType = this.renderer.type === Phaser.WEBGL ? "WEBGL" : "CANVAS";
    this.debugText.setText(
      `FPS: ${fps.toFixed(1)}\n` +
      `avg sim.tick: ${avgTick.toFixed(2)} ms\n` +
      `max sim.tick: ${maxTick.toFixed(2)} ms\n` +
      `avg delta: ${avgDelta.toFixed(2)} ms\n` +
      `renderer: ${rendererType}\n` +
      `unidades: ${this.sim.unidades.length}\n` +
      `edificios: ${this.sim.edificios.length}\n` +
      `children: ${this.children.list.length}\n` +
      `tweens: ${this.tweens.getTweens().length}\n` +
      `Text: ${countText}`
    );
    this.debugText.setVisible(this.debugVisible);
  }

  private crearTexturaFlores(): void {
    const canvas = document.createElement("canvas");
    canvas.width = 9 * 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const petaloOrden = [0, 4, 2, 6, 1, 5, 3, 7];
    const centroX = 15.5;
    const centroY = 15.5;

    for (let frame = 0; frame <= 8; frame++) {
      const x0 = frame * 32;
      ctx.clearRect(x0, 0, 32, 32);
      const visibles = frame === 0 ? [] : petaloOrden.slice(-(frame));
      const visibleSet = new Set<number>(visibles);

      for (let i = 0; i < 8; i++) {
        if (!visibleSet.has(i)) continue;
        const angulo = -Math.PI / 2 + (i * Math.PI) / 4;
        const cx = centroX + Math.cos(angulo) * 7;
        const cy = centroY + Math.sin(angulo) * 7;
        ctx.save();
        ctx.translate(cx + x0, cy);
        ctx.rotate(angulo);
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#ffe14d";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#d9b92e";
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(centroX + x0, centroY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#8a5a1c";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#5e3c10";
      ctx.stroke();
    }

    this.textures.addCanvas("flores", canvas);
    const texture = this.textures.get("flores");
    for (let i = 0; i <= 8; i++) {
      texture.add(`flor_${i}`, 0, i * 32, 0, 32, 32);
    }
  }

  private pintarCeldaTerreno(graphics: Phaser.GameObjects.Graphics, x: number, y: number, mapaX: number, mapaY: number): void {
    const px = x * TAM;
    const py = y * TAM;
    const t = this.sim.mapa.getTerreno(mapaX, mapaY);
    let color = 0x1e1e1e;
    if (t === Terreno.Arcilloso) color = 0x4a3526;
    if (t === Terreno.Agua) color = 0x1f4e8c;
    if (t === Terreno.Arena) color = 0xd4b483;
    if (t === Terreno.Rocoso) color = 0x555555;
    if (this.sim.esDeNoche) {
      const r = ((color >> 16) & 0xff) * 0.7;
      const gCol = ((color >> 8) & 0xff) * 0.7;
      const b = (color & 0xff) * 0.7;
      color = (Math.round(r) << 16) | (Math.round(gCol) << 8) | Math.round(b);
    }
    graphics.fillStyle(color, 1);
    graphics.fillRect(px, py, TAM, TAM);

    const altura = this.sim.mapa.getAltura(mapaX, mapaY);
    if (altura > 0) {
      graphics.fillStyle(0xffffff, 0.12 * altura);
      graphics.fillRect(px, py, TAM, TAM);
    }

    if (this.sim.mapa.esRampa(mapaX, mapaY)) {
      graphics.fillStyle(0xe0a030, 0.7);
      graphics.fillRect(px + 8, py + 8, TAM - 16, TAM - 16);
    }

    graphics.lineStyle(1, 0x333333, 1);
    graphics.strokeRect(px, py, TAM, TAM);
  }

  create(): void {
    this.sim = new Simulacion(crearMapaPrueba());
    for (const stock of this.sim.stock) {
      stock.agua = 999;
      stock.arcilla = 999;
      stock.nectar = 999;
    }
    const mapa = this.sim.mapa;
    const sw = this.scale.width;
    const sh = this.scale.height;

    // La cámara de interfaz tiene que existir ANTES de usar this.camUI.ignore(...)
    // (antes se creaba mucho más abajo y create() lanzaba un TypeError).
    this.camUI = this.cameras.add(0, 0, sw, sh);

    const worldWidth = mapa.ancho * TAM;
    const worldHeight = mapa.alto * TAM;
    const chunkSize = 1024;
    const generarTerreno = (key: string, w: number, h: number, offsetX: number, offsetY: number): void => {
      try {
        if (this.textures.exists(key)) this.textures.remove(key);
        const tempG = this.add.graphics();
        for (let y = 0; y < Math.ceil(h / TAM); y++) {
          for (let x = 0; x < Math.ceil(w / TAM); x++) {
            const mapaX = Math.floor((offsetX + x * TAM) / TAM);
            const mapaY = Math.floor((offsetY + y * TAM) / TAM);
            if (mapaX < 0 || mapaX >= mapa.ancho || mapaY < 0 || mapaY >= mapa.alto) continue;

            const px = x * TAM;
            const py = y * TAM;
            this.pintarCeldaTerreno(tempG, x, y, mapaX, mapaY);

            const r = mapa.getRecurso(mapaX, mapaY);
            if (r !== Recurso.Ninguno) this.celdasConRecurso.add(mapaY * mapa.ancho + mapaX);
            const cx = px + TAM / 2;
            const cy = py + TAM / 2;
            if (r === Recurso.Arcilla) {
              tempG.fillStyle(0xb5835a, 1);
              tempG.fillRect(cx - 5, cy - 5, 10, 10);
            } else if (r === Recurso.Planta) {
              tempG.fillStyle(0x4caf50, 1);
              tempG.fillCircle(cx, cy, 7);
            } else if (r === Recurso.Hongo) {
              tempG.fillStyle(0x9c27b0, 1);
              tempG.fillCircle(cx, cy, 6);
            } else if (r === Recurso.Cristal) {
              tempG.fillStyle(0x00bcd4, 1);
              tempG.fillRect(cx - 4, cy - 6, 8, 12);
            }
          }
        }
        tempG.generateTexture(key, w, h);
        tempG.destroy();
        const terrainImage = this.add.image(offsetX, offsetY, key).setOrigin(0, 0).setDepth(-2);
        this.camUI.ignore(terrainImage);
        this.terrenoMapas.push(terrainImage);
        this.terrenoTextureKeys.push(key);
      } catch (error) {
        console.error(`Error generating terrain chunk ${key}:`, error);
      }
    };

    this.crearTexturaFlores();
    this.floresBlitter = this.add.blitter(0, 0, "flores").setDepth(-0.5);
    this.camUI.ignore(this.floresBlitter);
    this.floresCantidadInicial = new Uint16Array(mapa.ancho * mapa.alto);
    for (let y = 0; y < mapa.alto; y++) {
      for (let x = 0; x < mapa.ancho; x++) {
        if (mapa.getRecurso(x, y) !== Recurso.Flor) continue;
        const cantidad = mapa.getCantidad(x, y);
        if (cantidad <= 0) continue;
        const indice = y * mapa.ancho + x;
        this.floresCantidadInicial[indice] = cantidad;
        const bob = this.floresBlitter.create(x * TAM + 0.5, y * TAM + 0.5, "flor_8");
        bob.setFrame(8);
        bob.setVisible(true);
        this.floresBobs.set(indice, bob);
      }
    }
    mapa.celdasRecursoModificadas.clear();

    this.graficoCeldasAgotadas = this.add.graphics().setDepth(-1);
    this.camUI.ignore(this.graficoCeldasAgotadas);

    const cols = Math.ceil(worldWidth / chunkSize);
    const rows = Math.ceil(worldHeight / chunkSize);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const chunkW = Math.min(chunkSize, worldWidth - col * chunkSize);
        const chunkH = Math.min(chunkSize, worldHeight - row * chunkSize);
        generarTerreno(`terreno_${row}_${col}`, chunkW, chunkH, col * chunkSize, row * chunkSize);
      }
    }

    this.configurarCamara(worldWidth, worldHeight);

    // Interfaz: HUD superior e inferior + textos + minimapa

    this.hudTopBg = this.add
      .rectangle(0, 0, sw, 44, 0x111118, 0.9)
      .setOrigin(0, 0)
      .setDepth(10);

    this.hudBottomBg = this.add.graphics().setDepth(10);
    this.hudBottomBg.fillGradientStyle(0x0b0b12, 0x0b0b12, 0x0b0b12, 0x0b0b12, 0, 0, 0.93, 0.93);
    this.hudBottomBg.fillRect(0, sh - ALTO_HUD_INFERIOR, sw, ALTO_HUD_INFERIOR);

    this.graficoMinimapa = this.add.graphics().setDepth(12);
    this.graficoBarrasUnidades = this.add.graphics().setDepth(6);
    this.camUI.ignore(this.graficoBarrasUnidades);
    this.graficoMarquesina = this.add.graphics().setDepth(100);
    this.graficoAtaques = this.add.graphics().setDepth(19);
    this.camUI.ignore(this.graficoAtaques);
    this.marcadoresPool = Array.from({ length: 8 }, () =>
      this.add
        .rectangle(0, 0, 4, 4, 0xff3030, 0)
        .setDepth(5)
        .setVisible(false)
    );
    this.camUI.ignore(this.marcadoresPool);
    this.textosFlotantesPool = Array.from({ length: 12 }, () =>
      this.add
        .text(0, 0, "", {
          fontFamily: "monospace",
          fontSize: "8px",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 2,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(20)
        .setVisible(false)
    );
    this.camUI.ignore(this.textosFlotantesPool);
    this.rectMM = { x: 15, y: this.scale.height - 82, w: 80, h: 74 };
    this.redibujarMinimapaTerreno();

    this.rectSeleccionCelda = this.add
      .rectangle(-100, -100, TAM, TAM, 0xffffff, 0.0)
      .setOrigin(0, 0)
      .setDepth(2)
      .setVisible(false);
    this.camUI.ignore(this.rectSeleccionCelda);

    this.graficoSeleccionEdificio = this.add.graphics().setDepth(6);
    this.brilloSeleccionEdificio = this.add
      .image(0, 0, "")
      .setOrigin(0, 0)
      .setDepth(5)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.2);
    this.camUI.ignore([this.graficoSeleccionEdificio, this.brilloSeleccionEdificio]);

    this.marcadorRendezvous = this.add
      .rectangle(-100, -100, TAM, TAM, 0x59d5c5, 0.16)
      .setOrigin(0, 0)
      .setDepth(2)
      .setStrokeStyle(2, 0x59d5c5, 0.7)
      .setVisible(false);
    this.camUI.ignore(this.marcadorRendezvous);

    this.textoTick = this.add
      .text(20, 12, "", { color: "#ffffff", fontSize: "15px" })
      .setDepth(12);

    this.botonSaludBg = this.add
      .rectangle(sw - 70, 22, 110, 28, 0x2d5940, 1)
      .setDepth(13)
      .setInteractive();
    this.botonSaludBg.setStrokeStyle(1, 0x6da987);
    this.textoBotonSalud = this.add
      .text(sw - 70, 22, "HP: ON", { color: "#ffffff", fontSize: "12px", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(14);
    this.botonSaludBg.on("pointerover", () => this.botonSaludBg.setFillStyle(0x3b7553));
    this.botonSaludBg.on("pointerout", () => this.actualizarBotonSalud());
    this.botonSaludBg.on("pointerdown", () => {
      this.mostrarBarrasSalud = !this.mostrarBarrasSalud;
      this.actualizarBotonSalud();
      this.actualizarVisibilidadBarrasSalud();
    });

    // Panel de información: en el HUD inferior (centrado dentro del panel)
    this.textoInfo = this.add
      .text(0, 0, "", {
        color: "#e0e0e0",
        fontSize: "13px",
        lineSpacing: 4,
      })
      .setAlign("center")
      .setOrigin(0.5, 0)
      .setDepth(11)
      .setVisible(false);

    this.textoColaProduccion = this.add
      .text(sw - 310, sh - ALTO_HUD_INFERIOR + 12, "", {
        color: "#dfe8ff",
        fontSize: "12px",
        fontStyle: "bold",
        lineSpacing: 3,
        wordWrap: { width: 190 },
      })
      .setDepth(12)
      .setVisible(false);

    this.textoEnfermedadHUD = this.add
      .text(-70, -26, "", {
        color: "#ff4d4d",
        fontSize: "13px",
        fontStyle: "bold",
      })
      .setAlign("center")
      .setOrigin(0.5, 0)
      .setDepth(13)
      .setVisible(false);

    this.textoRegenHUD = this.add
      .text(70, -26, "", {
        color: "#65f28c",
        fontSize: "13px",
        fontStyle: "bold",
      })
      .setAlign("center")
      .setOrigin(0.5, 0)
      .setDepth(13)
      .setVisible(false);

    this.grupoInfoHUD = this.add.container(sw / 2, sh - 78, [
      this.textoEnfermedadHUD,
      this.textoRegenHUD,
      this.textoInfo,
    ]);
    this.grupoInfoHUD.setDepth(11);

    this.textoErrorHUD = this.add
      .text(sw / 2, 14, "", { color: "#ff4444", fontSize: "16px", fontStyle: "bold" })
      .setOrigin(0.5, 0)
      .setDepth(12)
      .setVisible(false);

    if (DEBUG) {
      this.debugText = this.add
        .text(12, 54, "", {
          color: "#ffffff",
          fontSize: "12px",
          fontFamily: "monospace",
          backgroundColor: "#000000aa",
          padding: { x: 8, y: 6 },
        })
        .setDepth(1000)
        .setVisible(this.debugVisible);
      this.cameras.main.ignore(this.debugText);
      this.teclaF3 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    }

    // Separación de cámaras: main dibuja el MUNDO, camUI dibuja la INTERFAZ.
    // Todo lo que sea HUD debe ser ignorado por main; todo lo del mundo, por camUI.
    this.cameras.main.ignore([
      this.hudTopBg,
      this.hudBottomBg,
      this.graficoMinimapa,
      this.graficoMarquesina,
      this.textoTick,
      this.botonSaludBg,
      this.textoBotonSalud,
      this.textoInfo,
      this.textoColaProduccion,
      this.textoEnfermedadHUD,
      this.textoRegenHUD,
      this.textoErrorHUD,
    ]);

    // Overlay de noche (removido para evitar pantalla negra)
    this.overlayNoche = this.add
      .rectangle(0, 0, 0, 0, 0x0a0a23, 0)
      .setOrigin(0, 0)
      .setDepth(5)
      .setVisible(false);
    this.camUI.ignore(this.overlayNoche);

    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      const w = size.width;
      const h = size.height;
      this.camUI.setSize(w, h);
      this.hudTopBg.setSize(w, 44);
      this.actualizarFondoHudPorSeleccion();
      this.grupoInfoHUD.setPosition(w / 2, h - 78);
      const geoCola = this.geometriaColaProduccion();
      this.textoColaProduccion.setPosition(geoCola.left, h - ALTO_HUD_INFERIOR + 12);
      this.textoColaProduccion.setWordWrapWidth(geoCola.ancho);
      this.claveColaProduccion = ""; // fuerza reconstruir la lista en su nueva posición
      this.textoErrorHUD.setX(w / 2);
      this.botonSaludBg.setX(w - 70);
      this.textoBotonSalud.setX(w - 70);
      this.rectMM = { x: 15, y: h - 82, w: 80, h: 74 };
      this.minimapaTerrenoSucio = true;
      this.ultimoMinimapaDinamico = 0;
      this.limpiarBotonesAccion(); // se recrean en su nueva posición
      if (this.menuConstruccionAbierto) {
        this.crearBotonesConstruccion(Array.from(EDIFICIOS_CONSTRUIBLES_POR_OBRERA));
      }
    });

    // Nota: con el Palacio deshabilitado por ahora se ocultan temporalmente:
    // - construir Muralla desde el edificio principal
    // - producir la Reina Joven
    // - construir una segunda Reina
    // La Reina sigue siendo el único depósito inicial.
    this.sim.crearBaseInicial(0, 8, 17);
    const baseEnemigaOrigenX = this.sim.mapa.ancho - 1 - 8;
    const baseEnemigaOrigenY = this.sim.mapa.alto - 1 - 17;
    const unidadesEnemigas: number[] = [];
    for (let i = 0; i < 20; i++) unidadesEnemigas.push(TipoUnidad.Voladora);
    this.sim.crearBaseInicial(1, baseEnemigaOrigenX, baseEnemigaOrigenY, unidadesEnemigas, 0);

    this.dibujarEdificios();
    this.crearCirculos();
    this.configurarRaton();
    // Empezar mirando la base (palacio y unidades iniciales)
    this.cameras.main.centerOn(10 * TAM, 14 * TAM);
    this.events.once("shutdown", this.shutdown, this);
  }

  private shutdown(): void {
    // LEAK: scene restart without removing resize/input listeners leaves stale handlers around.
    this.scale.off("resize");
    this.input.keyboard?.off("keydown", this.manejarHotkeyBotones, this);
    this.input.off("pointerdown");
    this.input.off("pointermove");
    this.input.off("pointerup");
    this.input.off("pointerupoutside");
    // LEAK: kill all tweens and timers so restart does not accumulate orphaned animation state.
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.notifTimer = undefined;
    for (const terrainKey of this.terrenoTextureKeys) {
      if (this.textures.exists(terrainKey)) this.textures.remove(terrainKey);
    }
    this.terrenoTextureKeys.length = 0;
    const textureKeys = Object.keys(this.textures.list)
      .filter((key) => key.startsWith("edificio_"));
    for (const key of textureKeys) this.textures.remove(key);
    if (this.textures.exists("minimapaTerreno")) this.textures.remove("minimapaTerreno");
    for (const terrainImage of this.terrenoMapas) terrainImage.destroy();
    this.terrenoMapas = [];
    if (this.minimapaTerrenoImage) {
      this.minimapaTerrenoImage.destroy();
      this.minimapaTerrenoImage = undefined;
    }
    this.angulos.clear();
    this.angulosDeseados.clear();
    this.giroForzadoHasta.clear();
    this.animacionesCadaveres.clear();
    if (this.graficoCeldasAgotadas) {
      this.graficoCeldasAgotadas.destroy();
    }
    if (this.graficoSeleccionEdificio) {
      this.graficoSeleccionEdificio.destroy();
    }
    if (this.brilloSeleccionEdificio) {
      this.brilloSeleccionEdificio.destroy();
    }
    if (this.floresBlitter) {
      this.floresBlitter.destroy();
      this.floresBlitter = undefined;
    }
    if (this.textures.exists("flores")) this.textures.remove("flores");
    if (this.graficoAtaques) {
      this.graficoAtaques.destroy();
    }
    if (this.marcadoresPool.length) {
      for (const marcador of this.marcadoresPool) marcador.destroy();
      this.marcadoresPool = [];
      this.marcadoresOcupados.clear();
    }
    if (this.textosFlotantesPool.length) {
      for (const texto of this.textosFlotantesPool) texto.destroy();
      this.textosFlotantesPool = [];
      this.textosFlotantesOcupados.clear();
      this.textosFlotantesTokens.clear();
    }
    this.tooltipHUD = undefined;
    this.tooltipTimer = undefined;
    this.textoNotifCreacion = undefined;
    this.previewConstruccion = undefined;
    this.previewTipo = null;
    this.arrastreConstruccion = null;
    this.previewLinea.forEach((item) => item.destroy());
    this.previewLinea = [];
    if (this.textoCosteLinea) {
      this.textoCosteLinea.destroy();
      this.textoCosteLinea = undefined;
    }
  }

  private redibujarMinimapaTerreno(): void {
    const { x: mmX, y: mmY, w: mmW, h: mmH } = this.rectMinimapa();
    const mapa = this.sim.mapa;
    const textureKey = "minimapaTerreno";
    if (this.textures.exists(textureKey)) this.textures.remove(textureKey);

    const tempG = this.add.graphics();
    const escalaX = mmW / mapa.ancho;
    const escalaY = mmH / mapa.alto;
    for (let y = 0; y < mapa.alto; y++) {
      for (let x = 0; x < mapa.ancho; x++) {
        const t = mapa.getTerreno(x, y);
        let col = 0x222222;
        if (t === Terreno.Arcilloso) col = 0x4a3526;
        if (t === Terreno.Agua) col = 0x1f4e8c;
        if (t === Terreno.Arena) col = 0xd4b483;
        if (t === Terreno.Rocoso) col = 0x555555;
        tempG.fillStyle(col, 1);
        tempG.fillRect(x * escalaX, y * escalaY, Math.max(1, escalaX), Math.max(1, escalaY));
      }
    }
    tempG.generateTexture(textureKey, Math.max(1, Math.ceil(mmW)), Math.max(1, Math.ceil(mmH)));
    tempG.destroy();

    if (!this.minimapaTerrenoImage) {
      this.minimapaTerrenoImage = this.add.image(mmX, mmY, textureKey).setOrigin(0, 0).setDepth(11);
      this.cameras.main.ignore(this.minimapaTerrenoImage);
    } else {
      this.minimapaTerrenoImage.setTexture(textureKey).setPosition(mmX, mmY).setDisplaySize(mmW, mmH);
    }

    this.minimapaTerrenoImage.setVisible(true);
    this.minimapaTerrenoSucio = false;
  }

  // Posición del minimapa (la misma para dibujarlo y para detectar clics)
  private rectMinimapa(): { x: number; y: number; w: number; h: number } {
    return this.rectMM;
  }

  private configurarCamara(anchoMundo: number, altoMundo: number): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, anchoMundo, altoMundo);
    cam.setZoom(1.2);
    cam.centerOn(anchoMundo / 2, altoMundo / 2);

    // Arrastrar con el botón central del ratón
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.middleButtonDown()) return;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });

    this.teclas = this.input.keyboard!.createCursorKeys();
    this.teclaAtaque = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.teclaEscape = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.input.keyboard!.on("keydown", this.manejarHotkeyBotones, this);
  }

  // Un rectángulo por edificio (provisional hasta tener sprites)
  private edificiosDibujados = new Set<number>();
  private edificiosMuriendo = new Set<number>();

  private rebuildLiveIndexes(): void {
    this.liveUnitIds.clear();
    this.liveBuildingIds.clear();
    this.liveCorpseIds.clear();
    this.unitById.clear();
    this.buildingById.clear();
    this.corpseById.clear();

    for (const unidad of this.sim.unidades) {
      this.liveUnitIds.add(unidad.id);
      this.unitById.set(unidad.id, unidad);
    }
    for (const edificio of this.sim.edificios) {
      this.liveBuildingIds.add(edificio.id);
      this.buildingById.set(edificio.id, edificio);
    }
    for (const cadaver of this.sim.cadaveres) {
      this.liveCorpseIds.add(cadaver.id);
      this.corpseById.set(cadaver.id, cadaver);
    }
  }

  private ensureTexturaEdificio(tipo: number, jugador: number): string {
    const key = `edificio_${tipo}_${jugador}`;
    if (this.textures.exists(key)) return key;

    const datos = DATOS_EDIFICIO[tipo] ?? { ancho: 1, alto: 1 };
    const ancho = Math.max(1, datos.ancho) * TAM;
    const alto = Math.max(1, datos.alto) * TAM;
    const paleta = jugador < 0 ? PALETA_GAIA : PALETA_JUGADORES[jugador % PALETA_JUGADORES.length];
    const formas = FORMAS_EDIFICIO[tipo] ?? [[0, 0, 1, 1]];
    const g = this.add.graphics();

    if (tipo === TipoEdificio.Reina) {
      const cx = ancho / 2;
      const cy = alto / 2;
      const radioExterior = Math.min(ancho, alto) * 0.38;
      const radioInterior = radioExterior * 0.52;
      const puntos: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < 14; i++) {
        const angulo = -Math.PI / 2 + (i * Math.PI) / 7;
        const radio = i % 2 === 0 ? radioExterior : radioInterior;
        puntos.push({ x: cx + Math.cos(angulo) * radio, y: cy + Math.sin(angulo) * radio });
      }
      g.fillStyle(paleta.borde, 1);
      g.fillCircle(cx, cy, radioExterior + 7);
      g.fillStyle(paleta.edificio, 1);
      g.fillCircle(cx, cy, radioExterior);
      g.fillStyle(paleta.borde, 1);
      g.fillPoints(puntos, true);
      g.generateTexture(key, ancho, alto);
      g.destroy();
      return key;
    }

    for (const [x0, y0, x1, y1] of formas) {
      const rx0 = Phaser.Math.Clamp(x0 * ancho - 2, 0, ancho);
      const ry0 = Phaser.Math.Clamp(y0 * alto - 2, 0, alto);
      const rx1 = Phaser.Math.Clamp(x1 * ancho + 2, 0, ancho);
      const ry1 = Phaser.Math.Clamp(y1 * alto + 2, 0, alto);
      g.fillStyle(paleta.borde, 1);
      g.fillRect(rx0, ry0, Math.max(0, rx1 - rx0), Math.max(0, ry1 - ry0));
    }

    for (const [x0, y0, x1, y1] of formas) {
      g.fillStyle(paleta.edificio, 1);
      g.fillRect(x0 * ancho, y0 * alto, Math.max(0, (x1 - x0) * ancho), Math.max(0, (y1 - y0) * alto));
    }

    g.generateTexture(key, ancho, alto);
    g.destroy();
    return key;
  }

  private dibujarEdificios(): void {
    for (const [id, visual] of this.edificiosVisuales) {
      if (this.liveBuildingIds.has(id)) continue;
      if (this.edificiosMuriendo.has(id)) continue;
      this.edificiosMuriendo.add(id);
      if (this.seleccionadaEdificio === id) this.seleccionadaEdificio = null;
      const barra = this.barrasSalud.get(id);
      const objetos: Phaser.GameObjects.GameObject[] = [visual];
      if (barra) objetos.push(barra.bg, barra.fill);
      this.tweens.add({
        targets: objetos,
        alpha: 0,
        duration: 800,
        ease: "Linear",
        onComplete: () => {
          visual.destroy();
          this.edificiosVisuales.delete(id);
          this.edificiosDibujados.delete(id);
          this.edificiosMuriendo.delete(id);
          this.eliminarBarraSalud(id);
        },
      });
    }
    for (const e of this.sim.edificios) {
      const key = this.ensureTexturaEdificio(e.tipo, e.jugador);
      const visual = this.edificiosVisuales.get(e.id);
      const maxHp = DATOS_EDIFICIO[e.tipo]?.hp ?? e.hp;
      const alpha = e.enConstruccion ? 0.5 + 0.5 * (e.hp / maxHp) : 1;
      if (visual) {
        visual.setTexture(key).setPosition(e.x * TAM, e.y * TAM).setOrigin(0, 0).setAlpha(alpha);
        continue;
      }
      const img = this.add.image(e.x * TAM, e.y * TAM, key).setOrigin(0, 0).setDepth(3).setAlpha(alpha);
      this.camUI.ignore(img);
      this.edificiosVisuales.set(e.id, img);
      this.crearBarraSalud(
        e.id,
        DATOS_EDIFICIO[e.tipo]?.hp ?? e.hp,
        e.x * TAM,
        e.y * TAM - 7,
        e.ancho * TAM
      );
    }
  }

  private dibujarCadaveres(): void {
    for (const cadaver of this.sim.cadaveres) {
      let visual = this.cadaveresVisuales.get(cadaver.id);
      const color =
        cadaver.nivel === 3 ? 0x4a245c : cadaver.nivel === 2 ? 0x713838 : 0x664238;
      if (!visual) {
        visual = this.add
          .rectangle(cadaver.x * TAM + TAM / 2, cadaver.y * TAM + TAM / 2, 15, 15, color)
          .setRotation(Math.PI / 4)
          .setDepth(2)
          .setStrokeStyle(2, 0x24151b);
        this.camUI.ignore(visual);
        this.cadaveresVisuales.set(cadaver.id, visual);
      }
      visual
        .setPosition(cadaver.x * TAM + TAM / 2, cadaver.y * TAM + TAM / 2)
        .setRotation(Math.PI / 4)
        .setFillStyle(color)
        .setVisible(true);
    }

    for (const [id, visual] of this.cadaveresVisuales) {
      // PERF: O(1) liveCorpseIds avoids a full corpse scan per visual.
      if (this.liveCorpseIds.has(id)) continue;
      visual.destroy();
      this.cadaveresVisuales.delete(id);
      if (this.cadaverInspeccionadoId === id) this.cadaverInspeccionadoId = null;
    }
  }

  private eliminarBarraSalud(id: number): void {
    const barra = this.barrasSalud.get(id);
    if (!barra) return;
    barra.bg.destroy();
    barra.fill.destroy();
    this.barrasSalud.delete(id);
  }

  private crearBarraSalud(id: number, maximo: number, x: number, y: number, ancho: number): void {
    if (this.barrasSalud.has(id)) return;
    const bg = this.add
      .rectangle(x, y, ancho, 5, 0x111118, 0.9)
      .setOrigin(0, 0)
      .setDepth(6);
    bg.setStrokeStyle(1, 0x444444);
    const fill = this.add
      .rectangle(x + 1, y + 1, Math.max(0, ancho - 2), 3, 0x42d66b, 1)
      .setOrigin(0, 0)
      .setDepth(7);
    this.camUI.ignore([bg, fill]);
    this.barrasSalud.set(id, { bg, fill, maximo: Math.max(1, maximo) });
    this.actualizarVisibilidadBarraSalud({ bg, fill, maximo: Math.max(1, maximo) });
  }

  private actualizarVisibilidadBarraSalud(barra: BarraSalud): void {
    barra.bg.setVisible(this.mostrarBarrasSalud);
    barra.fill.setVisible(this.mostrarBarrasSalud);
  }

  private actualizarVisibilidadBarrasSalud(): void {
    for (const barra of this.barrasSalud.values()) {
      this.actualizarVisibilidadBarraSalud(barra);
    }
  }

  private actualizarBotonSalud(): void {
    this.textoBotonSalud.setText(`HP: ${this.mostrarBarrasSalud ? "ON" : "OFF"}`);
    this.botonSaludBg.setFillStyle(this.mostrarBarrasSalud ? 0x2d5940 : 0x3d3d3d);
  }

  private actualizarBarrasSalud(): void {
    for (const e of this.sim.edificios) {
      const barra = this.barrasSalud.get(e.id);
      if (!barra) continue;
      const x = e.x * TAM;
      const y = e.y * TAM - 7;
      const ancho = e.ancho * TAM;
      const proporcion = Math.max(0, Math.min(1, e.hp / barra.maximo));
      barra.bg.setPosition(x, y).setSize(ancho, 5);
      barra.fill.setPosition(x + 1, y + 1).setSize(Math.max(0, (ancho - 2) * proporcion), 3);
      if (e.enConstruccion) {
        barra.fill.setFillStyle(0x9aa0a6);
      } else {
        barra.fill.setFillStyle(0x42d66b);
      }
      this.actualizarVisibilidadBarraSalud(barra);
    }

    for (const u of this.sim.unidades) {
      const maximo = DATOS_UNIDAD[u.tipo]?.hp ?? u.hp;
      if (u.hp >= maximo) {
        continue;
      }
    }
  }

  private detenerAnimacionPulgon(unidadId: number): void {
    const animacion = this.animacionesPulgonesCurando.get(unidadId);
    if (!animacion) return;
    this.tweens.killTweensOf(animacion.halo);
    animacion.halo.destroy();
    this.animacionesPulgonesCurando.delete(unidadId);
  }

  private detenerAnimacionReparacion(unidadId: number): void {
    const shape = this.circulos.get(unidadId);
    if (shape) {
      this.tweens.killTweensOf(shape);
      shape.setScale(1);
    }
    this.animacionesReparacion.delete(unidadId);
  }

  private actualizarAnimacionReparacion(unidad: Unidad): void {
    const shape = this.circulos.get(unidad.id);
    if (!shape) return;
    if (unidad.estado !== Estado.ReparandoEdificio) {
      if (this.animacionesReparacion.has(unidad.id)) {
        this.detenerAnimacionReparacion(unidad.id);
      }
      return;
    }
    if (this.animacionesReparacion.has(unidad.id)) return;
    this.animacionesReparacion.add(unidad.id);
    this.tweens.add({
      targets: shape,
      scaleX: 1.24,
      scaleY: 1.24,
      duration: 120,
      yoyo: true,
      repeat: 1,
      repeatDelay: 140,
      loop: -1,
      ease: "Sine.easeInOut",
    });
  }

  private iniciarAnimacionDomesticacion(unidadId: number, burbuja: boolean): void {
    if (this.animacionesDomesticacion.has(unidadId)) return;
    const shape = this.circulos.get(unidadId);
    if (!shape) return;
    this.animacionesDomesticacion.add(unidadId);
    this.tweens.add({
      targets: shape,
      scaleX: burbuja ? 1.3 : 1.08,
      scaleY: burbuja ? 0.68 : 0.92,
      duration: burbuja ? 190 : 130,
      yoyo: true,
      repeat: 1,
      repeatDelay: burbuja ? 100 : 80,
      loop: -1,
      ease: "Sine.easeInOut",
    });
  }

  private actualizarFeedbackDomesticacion(): void {
    const unidadesAnimadas = new Set<number>();
    const progresoPorPulgon = new Map<number, number>();

    for (const trabajador of this.sim.unidades) {
      if (
        trabajador.tipo !== TipoUnidad.Obrera ||
        trabajador.objetivoDomesticacionId === null ||
        trabajador.estado !== Estado.IrADomesticar && trabajador.estado !== Estado.Domesticando
      ) {
        continue;
      }
      // PERF: unitById avoids scanning all units for each worker target.
      const pulgon = this.unitById.get(trabajador.objetivoDomesticacionId);
      if (!pulgon || pulgon.jugador === trabajador.jugador) continue;

      unidadesAnimadas.add(trabajador.id);
      unidadesAnimadas.add(pulgon.id);
      this.iniciarAnimacionDomesticacion(trabajador.id, false);
      this.iniciarAnimacionDomesticacion(pulgon.id, true);

      const progreso = trabajador.estado === Estado.Domesticando
        ? 1 - trabajador.temporizadorDomesticacion / TICKS_DOMESTICACION_PULGON
        : 0;
      progresoPorPulgon.set(
        pulgon.id,
        Math.max(progresoPorPulgon.get(pulgon.id) ?? 0, progreso)
      );
    }

    for (const unidadId of this.animacionesDomesticacion) {
      if (unidadesAnimadas.has(unidadId)) continue;
      const shape = this.circulos.get(unidadId);
      if (shape) {
        this.tweens.killTweensOf(shape);
        shape.setScale(1);
      }
      this.animacionesDomesticacion.delete(unidadId);
    }

    for (const [pulgonId, barra] of this.barrasDomesticacion) {
      if (progresoPorPulgon.has(pulgonId)) continue;
      barra.bg.destroy();
      barra.fill.destroy();
      this.barrasDomesticacion.delete(pulgonId);
    }

    for (const [pulgonId, progreso] of progresoPorPulgon) {
      const shape = this.circulos.get(pulgonId);
      if (!shape) continue;
      let barra = this.barrasDomesticacion.get(pulgonId);
      if (!barra) {
        const bg = this.add
          .rectangle(0, 0, 22, 5, 0x171b18, 0.95)
          .setOrigin(0.5, 0)
          .setDepth(8)
          .setStrokeStyle(1, 0x9cae98, 0.9);
        const fill = this.add
          .rectangle(0, 0, 20, 3, 0xb9d875, 1)
          .setOrigin(0, 0)
          .setDepth(9);
        this.camUI.ignore([bg, fill]);
        barra = { bg, fill };
        this.barrasDomesticacion.set(pulgonId, barra);
      }
      const x = shape.x;
      const y = shape.y - 14;
      barra.bg.setPosition(x, y);
      barra.fill
        .setPosition(x - 10, y + 1)
        .setSize(20 * Math.max(0, Math.min(1, progreso)), 3);
    }
  }

  private sincronizarUnidadesVisibles(): void {
    for (const [id, circulo] of this.circulos) {
      // PERF: liveUnitIds keeps the removal check O(1) instead of O(n) per visible circle.
      if (this.liveUnitIds.has(id)) continue;
      circulo.destroy();
      this.circulos.delete(id);
      this.bases.delete(id);
      this.angulos.delete(id);
      this.angulosDeseados.delete(id);
      this.giroForzadoHasta.delete(id);
      this.unidadVisible.delete(id);
      this.detenerAnimacionPulgon(id);
      this.detenerAnimacionReparacion(id);
      this.animacionesCadaveres.delete(id);
      this.seleccionadas.delete(id);
      if (this.unidadInspeccionadaEnemiga === id) this.unidadInspeccionadaEnemiga = null;
    }
    for (const u of this.sim.unidades) {
      if (!this.circulos.has(u.id)) {
        const bx = u.x * TAM + TAM / 2;
        const by = u.y * TAM + TAM / 2;
        const c = this.crearFormaUnidad(bx, by, u);
        c.setStrokeStyle(2, this.coloresJugador(u.jugador).borde);
        this.camUI.ignore(c);
        this.circulos.set(u.id, c);
        this.bases.set(u.id, { x: bx, y: by });
        this.angulos.set(u.id, Math.PI / 2);
        this.angulosDeseados.set(u.id, Math.PI / 2);
        this.giroForzadoHasta.set(u.id, 0);
        this.unidadVisible.set(u.id, true);
      }
    }
  }

  // Crea un círculo por cada unidad que aún no tenga uno
  private crearCirculos(): void {
    for (const u of this.sim.unidades) {
      if (this.circulos.has(u.id)) continue;
      const bx = u.x * TAM + TAM / 2;
      const by = u.y * TAM + TAM / 2;
      const c = this.crearFormaUnidad(bx, by, u);
      c.setStrokeStyle(2, this.coloresJugador(u.jugador).borde);
      this.camUI.ignore(c); // la cámara de interfaz no dibuja el mundo
      this.circulos.set(u.id, c);
      this.bases.set(u.id, { x: bx, y: by });
      this.angulos.set(u.id, Math.PI / 2);
      this.angulosDeseados.set(u.id, Math.PI / 2);
      this.giroForzadoHasta.set(u.id, 0);
      this.unidadVisible.set(u.id, true);
    }
  }

  // Shift real del evento del navegador (no depende de la versión de Phaser)
  private shiftPulsado(p: Phaser.Input.Pointer): boolean {
    return !!(p.event as MouseEvent | undefined)?.shiftKey;
  }

  private punteroSobreMinimapa(x: number, y: number): boolean {
    const mm = this.rectMinimapa();
    return x >= mm.x && x <= mm.x + mm.w && y >= mm.y && y <= mm.y + mm.h;
  }

  private punteroSobreBotonHUD(x: number, y: number): boolean {
    for (const btn of this.botonesAccion) {
      const bx = btn.x - btn.width / 2;
      const by = btn.y - btn.height / 2;
      if (x >= bx && x <= bx + btn.width && y >= by && y <= by + btn.height) return true;
    }
    for (const btn of this.botonesConstruccion) {
      const bx = btn.x - btn.width / 2;
      const by = btn.y - btn.height / 2;
      if (x >= bx && x <= bx + btn.width && y >= by && y <= by + btn.height) return true;
    }
    for (const btn of this.botonesColaProduccion) {
      const bx = btn.x - btn.width / 2;
      const by = btn.y - btn.height / 2;
      if (x >= bx && x <= bx + btn.width && y >= by && y <= by + btn.height) return true;
    }
    return false;
  }

  private punteroSobreHUD(x: number, y: number): boolean {
    if (y < 44) return true;
    if (this.punteroSobreMinimapa(x, y)) return true;
    return this.punteroSobreBotonHUD(x, y);
  }

  private cerrarMenuConstruccion(): void {
    this.menuConstruccionAbierto = false;
    this.modoConstruccion = null;
    this.limpiarBotonesConstruccion();
    this.limpiarBotonesAccion();
    this.pointerDownEnHUD = false;
    this.clicConsumidoPorHUD = false;
    if (this.previewConstruccion) this.previewConstruccion.setVisible(false);
    this.panelDirty = true;
  }

  private configurarRaton(): void {
    // Evita el menú contextual del navegador al hacer clic derecho
    this.input.mouse?.disableContextMenu();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.clicConsumidoPorHUD) {
        this.clicConsumidoPorHUD = false;
        return;
      }
      if (p.leftButtonDown()) {
        if (this.modoConstruccion !== null) {
          if (!this.esConstruccionArrastrable(this.modoConstruccion)) {
            this.esArrastrandoMarquesina = false;
            this.huboArrastre = false;
            this.pointerDownEnHUD = false;
            return;
          }
          if (this.punteroSobreHUD(p.x, p.y)) {
            this.pointerDownEnHUD = true;
            return;
          }
          this.arrastreConstruccion = {
            inicio: this.celdaDesdePuntero(p),
            fin: this.celdaDesdePuntero(p),
          };
          this.esArrastrandoMarquesina = false;
          this.huboArrastre = false;
          this.pointerDownEnHUD = false;
          return;
        }
        if (p.y < 44) return; // HUD superior
        if (p.y > this.scale.height - ALTO_HUD_INFERIOR) {
          const mm = this.rectMinimapa();
          const sobreMinimapa = p.x >= mm.x && p.x <= mm.x + mm.w && p.y >= mm.y && p.y <= mm.y + mm.h;
          if (sobreMinimapa) {
            this.arrastrandoMinimapa = true;
            this.clicHUDInferior(p);
            return;
          }
          if (this.punteroSobreBotonHUD(p.x, p.y)) {
            this.clicHUDInferior(p);
            return;
          }
        }
        if (this.shiftPulsado(p)) {
          // Shift + clic izquierdo: mover el mapa
          this.panArrastrando = true;
          return;
        }
        // Clic izquierdo: puede ser un clic simple o el inicio de una selección por cuadro
        this.esArrastrandoMarquesina = true;
        this.huboArrastre = false;
        this.inicioArrastre = { x: p.x, y: p.y };
      } else if (p.rightButtonDown()) {
        if (this.modoConstruccion !== null) {
          if (this.arrastreConstruccion) {
            this.arrastreConstruccion = null;
            this.previewLinea.forEach((item) => item.destroy());
            this.previewLinea = [];
            if (this.textoCosteLinea) this.textoCosteLinea.setVisible(false);
            return;
          }
          this.modoConstruccion = null;
          this.menuConstruccionAbierto = false;
          this.limpiarBotonesConstruccion();
          this.actualizarBotonesModo();
          if (this.previewConstruccion) this.previewConstruccion.setVisible(false);
          return;
        }
        if (p.y < 44) return; // HUD superior
        if (p.y > this.scale.height - ALTO_HUD_INFERIOR) {
          if (this.punteroSobreMinimapa(p.x, p.y) || this.punteroSobreBotonHUD(p.x, p.y)) {
            this.clicHUDInferior(p);
            return;
          }
        }
        const mundo = this.cameras.main.getWorldPoint(p.x, p.y);
        const x = Math.floor(mundo.x / TAM);
        const y = Math.floor(mundo.y / TAM);
        const edificio = this.sim.edificios.find(
          (e) => e.id === this.seleccionadaEdificio && e.tipo === TipoEdificio.Reina
        );
        if (edificio) {
          edificio.puntoRendezvousX = x;
          edificio.puntoRendezvousY = y;
          this.mostrarMarcador(x, y);
        } else if (this.seleccionadas.size > 0) {
          this.darOrdenAUnidades(x, y);
        }
      }
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.arrastrandoMinimapa && p.leftButtonDown()) {
        this.centrarCamaraDesdeMinimapa(p);
        return;
      }
      if (this.panArrastrando && p.leftButtonDown()) {
        const cam = this.cameras.main;
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
        return;
      }
      if (this.esConstruccionArrastrable(this.modoConstruccion) && this.arrastreConstruccion && this.modoConstruccion !== null && p.leftButtonDown()) {
        this.arrastreConstruccion.fin = this.celdaDesdePuntero(p);
        this.actualizarPreviewConstruccion();
        return;
      }
      if (!this.esArrastrandoMarquesina) return;
      const x0 = this.inicioArrastre.x;
      const y0 = this.inicioArrastre.y;
      // Hasta moverse 5 px se considera un clic normal, no un cuadro
      if (!this.huboArrastre && Math.hypot(p.x - x0, p.y - y0) < 5) return;
      this.huboArrastre = true;
      this.graficoMarquesina.clear();
      this.graficoMarquesina.fillStyle(0xffffff, 0.08);
      this.graficoMarquesina.fillRect(x0, y0, p.x - x0, p.y - y0);
      this.graficoMarquesina.lineStyle(1, 0xffffff, 0.9);
      this.graficoMarquesina.strokeRect(x0, y0, p.x - x0, p.y - y0);
    });

    const alSoltar = (p: Phaser.Input.Pointer): void => {
      if (this.pointerDownEnHUD || this.clicConsumidoPorHUD) {
        this.pointerDownEnHUD = false;
        this.clicConsumidoPorHUD = false;
        return;
      }
      if (this.arrastrandoMinimapa) {
        if (p.leftButtonReleased()) this.arrastrandoMinimapa = false;
        return;
      }
      if (this.panArrastrando) {
        if (p.leftButtonReleased()) this.panArrastrando = false;
        return;
      }
      if (this.modoConstruccion !== null) {
        this.esArrastrandoMarquesina = false;
        this.graficoMarquesina.clear();
        if (p.leftButtonReleased()) {
          if (this.punteroSobreHUD(p.x, p.y) || this.clicConsumidoPorHUD) {
            this.clicConsumidoPorHUD = false;
            return;
          }
          const mundo = this.cameras.main.getWorldPoint(p.x, p.y);
          const cx = Math.floor(mundo.x / TAM);
          const cy = Math.floor(mundo.y / TAM);
          if (this.arrastreConstruccion && (this.arrastreConstruccion.inicio.x !== cx || this.arrastreConstruccion.inicio.y !== cy)) {
            const celdas = this.lineaDeConstruccion(this.arrastreConstruccion.inicio, this.arrastreConstruccion.fin);
            const obreras = [...this.seleccionadas]
              .map((id) => this.sim.unidades.find((u) => u.id === id))
              .filter((u): u is Unidad => !!u && u.tipo === TipoUnidad.Obrera && u.jugador === this.jugadorLocal)
              .sort((a, b) => a.id - b.id);
            if (obreras.length === 0) {
              this.mostrarMensajeError("Selecciona una obrera para construir");
              this.arrastreConstruccion = null;
              return;
            }
            this.sim.enviarOrden({
              tipo: "construirLinea",
              unidadIds: obreras.map((u) => u.id),
              edificioTipo: this.modoConstruccion,
              celdas,
              jugador: this.jugadorLocal,
            });
            this.mostrarMarcador(cx, cy);
            this.arrastreConstruccion = null;
            this.previewLinea.forEach((item) => item.destroy());
            this.previewLinea = [];
            if (this.textoCosteLinea) this.textoCosteLinea.setVisible(false);
            this.modoConstruccion = null;
            this.menuConstruccionAbierto = false;
            this.limpiarBotonesConstruccion();
            this.actualizarBotonesModo();
            if (this.previewConstruccion) this.previewConstruccion.setVisible(false);
            this.panelDirty = true;
            return;
          }
          if (!this.puedeColocarEdificioEn(cx, cy, this.modoConstruccion)) {
            this.mostrarMensajeError("No se puede construir aquí");
            this.actualizarPreviewConstruccion();
            return;
          }
          const obreras = [...this.seleccionadas]
            .map((id) => this.sim.unidades.find((u) => u.id === id))
            .filter((u): u is Unidad => !!u && u.tipo === TipoUnidad.Obrera && u.jugador === this.jugadorLocal);
          if (obreras.length === 0) {
            this.mostrarMensajeError("Selecciona una obrera para construir");
            return;
          }
          for (const obrera of obreras) {
            this.sim.enviarOrden({
              tipo: "construir",
              unidadId: obrera.id,
              edificioTipo: this.modoConstruccion,
              x: cx,
              y: cy,
              jugador: this.jugadorLocal,
            });
          }
          this.mostrarMarcador(cx, cy);
          this.modoConstruccion = null;
          this.menuConstruccionAbierto = false;
          this.limpiarBotonesConstruccion();
          this.actualizarBotonesModo();
          if (this.previewConstruccion) this.previewConstruccion.setVisible(false);
          this.panelDirty = true;
        }
        return;
      }
      if (!this.esArrastrandoMarquesina || !p.leftButtonReleased()) return;
      this.esArrastrandoMarquesina = false;
      this.graficoMarquesina.clear();
      if (this.huboArrastre) {
        this.seleccionarEnRectangulo(this.inicioArrastre.x, this.inicioArrastre.y, p.x, p.y);
        return;
      }

      const ahora = this.time.now;
      const esDoble = ahora - this.ultimoDobleClick.t < 300 &&
        Math.hypot(p.x - this.ultimoDobleClick.x, p.y - this.ultimoDobleClick.y) < 12;

      if (
        !this.modoAtaque &&
        !this.modoCuracion &&
        !this.modoReparacionEdificio &&
        !this.modoDomesticar &&
        !this.modoLlevarCadaver
      ) {
        if (esDoble) {
          this.seleccionarTipoEnVistaPorDobleClick(p);
          this.ultimoDobleClick = { x: 0, y: 0, t: 0 };
          return;
        }
        this.ultimoDobleClick = { x: p.x, y: p.y, t: ahora };
      }

      this.clicIzquierdoMundo(p);
    };
    this.input.on("pointerup", alSoltar);
    this.input.on("pointerupoutside", alSoltar);
  }

  // Selección por cuadro: selecciona todas las unidades cuyo centro queda dentro
  private seleccionarEnRectangulo(x1: number, y1: number, x2: number, y2: number): void {
    this.panelDirty = true;
    const cam = this.cameras.main;
    const a = cam.getWorldPoint(x1, y1);
    const b = cam.getWorldPoint(x2, y2);
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    this.seleccionadas.clear();
    this.unidadInspeccionadaEnemiga = null;
    this.cadaverInspeccionadoId = null;
    this.seleccionadaEdificio = null;
    this.celdaInfo = null;
    this.resetModosAccion();
    for (const u of this.sim.unidades) {
      const wx = u.x * TAM + TAM / 2;
      const wy = u.y * TAM + TAM / 2;
      if (
        u.jugador === this.jugadorLocal &&
        wx >= minX &&
        wx <= maxX &&
        wy >= minY &&
        wy <= maxY
      ) {
        this.seleccionadas.add(u.id);
      }
    }
  }

  private seleccionarTipoEnVistaPorDobleClick(p: Phaser.Input.Pointer): void {
    const cam = this.cameras.main;
    const mundo = cam.getWorldPoint(p.x, p.y);
    const cx = Math.floor(mundo.x / TAM);
    const cy = Math.floor(mundo.y / TAM);
    const vista = cam.worldView;

    const unidad = this.sim.unidades.find(
      (u) => u.jugador === this.jugadorLocal && u.x === cx && u.y === cy
    );
    if (unidad) {
      this.panelDirty = true;
      this.seleccionadas.clear();
      this.unidadInspeccionadaEnemiga = null;
      this.cadaverInspeccionadoId = null;
      this.seleccionadaEdificio = null;
      this.celdaInfo = null;
      this.resetModosAccion();
      this.rectSeleccionCelda.setVisible(false);

      for (const u of this.sim.unidades) {
        if (u.jugador !== this.jugadorLocal || u.tipo !== unidad.tipo) continue;
        const wx = u.x * TAM + TAM / 2;
        const wy = u.y * TAM + TAM / 2;
        if (wx >= vista.x && wx <= vista.right && wy >= vista.y && wy <= vista.bottom) {
          this.seleccionadas.add(u.id);
        }
      }
      return;
    }

    const edificio = this.sim.edificios.find(
      (e) =>
        e.jugador === this.jugadorLocal &&
        cx >= e.x &&
        cx < e.x + e.ancho &&
        cy >= e.y &&
        cy < e.y + e.alto
    );
    if (!edificio) return;

    this.panelDirty = true;
    this.seleccionadas.clear();
    this.unidadInspeccionadaEnemiga = null;
    this.cadaverInspeccionadoId = null;
    this.celdaInfo = null;
    this.resetModosAccion();
    this.actualizarCursorModoSeleccion();
    this.seleccionadaEdificio = edificio.id;
    this.rectSeleccionCelda.setVisible(false);
  }

  // Clic izquierdo simple en el mundo: unidad, edificio, punto de reunión o celda
  private clicIzquierdoMundo(p: Phaser.Input.Pointer): void {
    this.panelDirty = true;
    const mundo = this.cameras.main.getWorldPoint(p.x, p.y);
    const cx = Math.floor(mundo.x / TAM);
    const cy = Math.floor(mundo.y / TAM);

    if (this.modoConstruccion !== null) {
      return;
    }

    if (this.modoAtaque) {
      const unidadObjetivo = this.sim.unidades.find((u) => u.x === cx && u.y === cy);
      const edificioObjetivo = unidadObjetivo
        ? undefined
        : this.sim.edificios.find(
            (e) => cx >= e.x && cx < e.x + e.ancho && cy >= e.y && cy < e.y + e.alto
          );
      const objetivo = unidadObjetivo
        ? { tipo: "unidad" as const, id: unidadObjetivo.id }
        : edificioObjetivo
          ? { tipo: "edificio" as const, id: edificioObjetivo.id }
          : null;
      if (objetivo) {
        for (const id of this.seleccionadas) {
          if (objetivo.tipo === "unidad" && objetivo.id === id) continue;
          this.sim.enviarOrden({
            tipo: "atacar",
            unidadId: id,
            objetivo,
            jugador: this.jugadorLocal,
          });
        }
        this.mostrarMarcador(cx, cy, 0xff3030);
      }
      this.modoAtaque = false;
      this.actualizarCursorModoSeleccion();
      this.actualizarBotonesModo();
      return;
    }

    if (this.modoCuracion) {
      const objetivo = this.sim.unidades.find((u) => u.x === cx && u.y === cy);
      if (objetivo) {
        for (const id of this.seleccionadas) {
          const pulgon = this.sim.unidades.find((u) => u.id === id);
          if (pulgon?.tipo === TipoUnidad.Pulgones) {
            this.sim.enviarOrden({ tipo: "curarEnfermedad", unidadId: id, objetivoId: objetivo.id, jugador: this.jugadorLocal });
          }
        }
        this.mostrarMarcador(cx, cy);
      }
      this.modoCuracion = false;
      this.actualizarCursorModoSeleccion();
      this.actualizarBotonesModo();
      return;
    }

    if (this.modoReparacionEdificio) {
      const edificio = this.sim.edificios.find(
        (e) => cx >= e.x && cx < e.x + e.ancho && cy >= e.y && cy < e.y + e.alto
      );
      if (edificio) {
        for (const id of this.seleccionadas) {
          const trabajador = this.sim.unidades.find((u) => u.id === id);
          if (trabajador?.tipo === TipoUnidad.Obrera) {
            this.sim.enviarOrden({ tipo: "repararEdificio", unidadId: id, edificioId: edificio.id, jugador: this.jugadorLocal });
          }
        }
        this.mostrarMarcador(cx, cy);
      }
      this.modoReparacionEdificio = false;
      this.actualizarBotonesModo();
      return;
    }

    if (this.modoDomesticar) {
      const pulgon = this.sim.unidades.find(
        (u) =>
          u.x === cx &&
          u.y === cy &&
          u.tipo === TipoUnidad.Pulgones &&
          u.jugador !== this.jugadorLocal
      );
      if (pulgon) {
        const trabajadoresSeleccionados = [...this.seleccionadas]
          .map((id) => this.sim.unidades.find((u) => u.id === id))
          .filter((u): u is Unidad => !!u && u.tipo === TipoUnidad.Obrera && u.jugador === this.jugadorLocal);
        if (trabajadoresSeleccionados.length > 0) {
          this.asignarDomesticacion(trabajadoresSeleccionados, pulgon);
        }
      }
      this.modoDomesticar = false;
      this.actualizarCursorModoSeleccion();
      this.actualizarBotonesModo();
      return;
    }

    if (this.modoLlevarCadaver) {
      const guerreras = this.guerrerasSeleccionadas();
      const guerrerasCargando = guerreras.filter((u) => u.cadaverCargado !== null);
      if (guerrerasCargando.length > 0) {
        const guerrera = guerrerasCargando.reduce((mejor, actual) => {
          const mejorDist = Math.abs(mejor.x - cx) + Math.abs(mejor.y - cy);
          const actualDist = Math.abs(actual.x - cx) + Math.abs(actual.y - cy);
          return actualDist < mejorDist ? actual : mejor;
        }, guerrerasCargando[0]);
        this.sim.enviarOrden({ tipo: "soltarCadaver", unidadId: guerrera.id, x: cx, y: cy, jugador: this.jugadorLocal });
        this.modoLlevarCadaver = false;
        this.actualizarBotonesModo();
        this.mostrarMarcador(cx, cy);
        return;
      }

      const cadaver = this.sim.cadaveres.find((v) => v.x === cx && v.y === cy);
      if (cadaver) {
        const guerrerasLibres = guerreras.filter((u) => u.cadaverCargado === null);
        if (guerrerasLibres.length === 0) {
          this.mostrarMensajeError("Todas las guerreras ya cargan un cadáver");
          this.modoLlevarCadaver = false;
          this.actualizarBotonesModo();
          return;
        }
        const guerrera = guerrerasLibres.reduce((mejor, actual) => {
          const mejorDist = Math.abs(mejor.x - cadaver.x) + Math.abs(mejor.y - cadaver.y);
          const actualDist = Math.abs(actual.x - cadaver.x) + Math.abs(actual.y - cadaver.y);
          return actualDist < mejorDist || (actualDist === mejorDist && actual.id < mejor.id) ? actual : mejor;
        }, guerrerasLibres[0]);
        this.sim.enviarOrden({ tipo: "cargarCadaver", unidadId: guerrera.id, cadaverId: cadaver.id, jugador: this.jugadorLocal });
        this.modoLlevarCadaver = false;
        this.actualizarBotonesModo();
        this.mostrarMarcador(cx, cy);
        return;
      }

      this.modoLlevarCadaver = false;
      this.actualizarBotonesModo();
      return;
    }

    const u = this.sim.unidades.find(
      (v) => v.x === cx && v.y === cy
    );
    if (u) {
      if (u.jugador === this.jugadorLocal) {
        this.seleccionadas.clear();
        this.seleccionadas.add(u.id);
        this.unidadInspeccionadaEnemiga = null;
        this.cadaverInspeccionadoId = null;
        this.seleccionadaEdificio = null;
      } else {
        this.seleccionadas.clear();
        this.unidadInspeccionadaEnemiga = u.id;
        this.cadaverInspeccionadoId = null;
        this.seleccionadaEdificio = null;
      }
      this.celdaInfo = this.sim.mapa.dentro(cx, cy) ? { x: cx, y: cy } : null;
      if (this.celdaInfo) {
        this.rectSeleccionCelda
          .setPosition(this.celdaInfo.x * TAM, this.celdaInfo.y * TAM)
          .setVisible(true);
      } else {
        this.rectSeleccionCelda.setVisible(false);
      }
      return;
    }

    const cadaver = this.sim.cadaveres.find((v) => v.x === cx && v.y === cy);
    if (cadaver) {
      this.seleccionadas.clear();
      this.unidadInspeccionadaEnemiga = null;
      this.cadaverInspeccionadoId = cadaver.id;
      this.seleccionadaEdificio = null;
      this.celdaInfo = this.sim.mapa.dentro(cx, cy) ? { x: cx, y: cy } : null;
      this.rectSeleccionCelda
        .setPosition(cx * TAM, cy * TAM)
        .setVisible(this.celdaInfo !== null);
      return;
    } else {
      this.cadaverInspeccionadoId = null;
    }

    {
      const ed = this.sim.edificios.find(
        (b) =>
          b.jugador === this.jugadorLocal &&
          cx >= b.x &&
          cx < b.x + b.ancho &&
          cy >= b.y &&
          cy < b.y + b.alto
      );
      if (ed) {
        this.seleccionadaEdificio = ed.id;
        this.seleccionadas.clear();
        this.unidadInspeccionadaEnemiga = null;
        this.cadaverInspeccionadoId = null;
        this.alternarColorRendezvous = !this.alternarColorRendezvous;
      } else {
        this.seleccionadas.clear();
        this.seleccionadaEdificio = null;
        this.unidadInspeccionadaEnemiga = null;
        this.cadaverInspeccionadoId = null;
      }
    }

    // Guarda la celda para el panel de información
    this.celdaInfo = this.sim.mapa.dentro(cx, cy) ? { x: cx, y: cy } : null;
    if (this.celdaInfo) {
      this.rectSeleccionCelda
        .setPosition(this.celdaInfo.x * TAM, this.celdaInfo.y * TAM)
        .setVisible(true);
    } else {
      this.rectSeleccionCelda.setVisible(false);
    }
  }

  // Clic en el HUD inferior: minimapa o botones de acción
  private clicHUDInferior(p: Phaser.Input.Pointer): void {
    const mm = this.rectMinimapa();
    if (p.x >= mm.x && p.x <= mm.x + mm.w && p.y >= mm.y && p.y <= mm.y + mm.h) {
      this.centrarCamaraDesdeMinimapa(p);
    } else {
      this.comprobarClicBotonesAccion(p.x, p.y);
    }
  }

  private centrarCamaraDesdeMinimapa(p: Phaser.Input.Pointer): void {
    const mm = this.rectMinimapa();
    const mapa = this.sim.mapa;
    const x = Math.max(mm.x, Math.min(p.x, mm.x + mm.w));
    const y = Math.max(mm.y, Math.min(p.y, mm.y + mm.h));
    const targetX = Math.floor(((x - mm.x) / mm.w) * mapa.ancho);
    const targetY = Math.floor(((y - mm.y) / mm.h) * mapa.alto);
    this.cameras.main.centerOn((targetX + 0.5) * TAM, (targetY + 0.5) * TAM);
  }

  // Prioridad de acciones del clic derecho: enemigo -> hostil; propio/friendly -> ayuda o movimiento, nunca ataque.
  private darOrdenAUnidades(cx: number, cy: number): void {
    if (!this.sim.mapa.dentro(cx, cy)) return;
    this.resetModosAccion();
    const ids = [...this.seleccionadas];
    const unidadesSeleccionadas = this.sim.unidades.filter((u) => this.seleccionadas.has(u.id));
    const jugador = unidadesSeleccionadas[0]?.jugador ?? this.jugadorLocal;
    const pedirMover = (id: number, x: number, y: number): void => {
      this.sim.enviarOrden({ tipo: "mover", unidadId: id, x, y, jugador: this.jugadorLocal });
    };
    const celdaLibreAdyacente = (edificio: Edificio): { x: number; y: number } | null => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = edificio.x + dx;
          const y = edificio.y + dy;
          if (!this.sim.mapa.dentro(x, y)) continue;
          if (this.sim.mapa.estaBloqueada(x, y)) continue;
          if (this.sim.edificios.some((b) => b.id !== edificio.id && x >= b.x && x < b.x + b.ancho && y >= b.y && y < b.y + b.alto)) continue;
          if (x >= edificio.x && x < edificio.x + edificio.ancho && y >= edificio.y && y < edificio.y + edificio.alto) continue;
          return { x, y };
        }
      }
      return null;
    };

    const cadaverObjetivo = this.sim.cadaveres.find((c) => c.x === cx && c.y === cy);
    const guerrerasSeleccionadas = this.guerrerasSeleccionadas();
    if (cadaverObjetivo && guerrerasSeleccionadas.length > 0) {
      const guerrerasLibres = guerrerasSeleccionadas.filter((u) => u.cadaverCargado === null);
      if (guerrerasLibres.length === 0) {
        this.mostrarMensajeError("Todas las guerreras ya cargan un cadáver");
        this.mostrarMarcador(cx, cy);
        return;
      }
      const guerreraElegida = guerrerasLibres.reduce((mejor, actual) => {
        const mejorDist = Math.abs(mejor.x - cx) + Math.abs(mejor.y - cy);
        const actualDist = Math.abs(actual.x - cx) + Math.abs(actual.y - cy);
        return actualDist < mejorDist || (actualDist === mejorDist && actual.id < mejor.id) ? actual : mejor;
      }, guerrerasLibres[0]);
      this.sim.enviarOrden({ tipo: "cargarCadaver", unidadId: guerreraElegida.id, cadaverId: cadaverObjetivo.id, jugador: this.jugadorLocal });
      this.mostrarMarcador(cx, cy, 0x00ff88);
      return;
    }

    const pulgon = this.sim.unidades.find(
      (u) =>
        u.x === cx &&
        u.y === cy &&
        u.tipo === TipoUnidad.Pulgones &&
        u.jugador !== this.jugadorLocal
    );
    const trabajadoresSeleccionados = unidadesSeleccionadas.filter(
      (u) => u.tipo === TipoUnidad.Obrera && u.jugador === this.jugadorLocal
    );
    if (pulgon && trabajadoresSeleccionados.length > 0) {
      this.asignarDomesticacion(trabajadoresSeleccionados, pulgon);
      return;
    }

    const unidadObjetivo = this.sim.unidades.find((u) => u.x === cx && u.y === cy);
    const edificioObjetivo = this.sim.edificios.find(
      (e) =>
        cx >= e.x &&
        cx < e.x + e.ancho &&
        cy >= e.y &&
        cy < e.y + e.alto
    );
    const unidadEnemiga = unidadObjetivo && unidadObjetivo.jugador !== jugador ? unidadObjetivo : null;

    if (
      edificioObjetivo &&
      edificioObjetivo.jugador === jugador &&
      edificioObjetivo.hp < (DATOS_EDIFICIO[edificioObjetivo.tipo]?.hp ?? edificioObjetivo.hp) &&
      trabajadoresSeleccionados.length > 0
    ) {
      for (const trabajador of trabajadoresSeleccionados) {
        this.sim.enviarOrden({
          tipo: "repararEdificio",
          unidadId: trabajador.id,
          edificioId: edificioObjetivo.id,
          jugador: this.jugadorLocal,
        });
      }
      this.mostrarMarcador(cx, cy);
      return;
    }

    const unidadesConCarga = unidadesSeleccionadas.filter(
      (u) => u.jugador === jugador && (u.cargaAgua > 0 || u.cargaArcilla > 0 || u.cargaNectar > 0)
    );
    if (edificioObjetivo && edificioObjetivo.jugador === jugador && edificioObjetivo.esDeposito && unidadesConCarga.length > 0) {
      const destino = celdaLibreAdyacente(edificioObjetivo) ?? { x: cx, y: cy };
      for (const unidad of unidadesConCarga) {
        pedirMover(unidad.id, destino.x, destino.y);
      }
      this.mostrarMarcador(cx, cy);
      return;
    }

    const pulgonConNectar = this.sim.unidades.find(
      (u) =>
        u.x === cx &&
        u.y === cy &&
        u.tipo === TipoUnidad.Pulgones &&
        u.jugador === jugador &&
        u.cargaNectar > 0
    );
    if (pulgonConNectar && trabajadoresSeleccionados.length > 0) {
      for (const trabajador of trabajadoresSeleccionados) {
        this.sim.enviarOrden({ tipo: "cargarNectar", unidadId: trabajador.id, pulgonId: pulgonConNectar.id, jugador: this.jugadorLocal });
      }
      this.mostrarMarcador(cx, cy);
      return;
    }

    const pulgonesSeleccionados = unidadesSeleccionadas.filter((u) => u.tipo === TipoUnidad.Pulgones && u.jugador === this.jugadorLocal);
    if (unidadObjetivo && unidadObjetivo.jugador === jugador && pulgonesSeleccionados.length > 0) {
      const maximo = DATOS_UNIDAD[unidadObjetivo.tipo]?.hp ?? unidadObjetivo.hp;
      if (unidadObjetivo.enfermedadViral || unidadObjetivo.hp < maximo) {
        for (const pulgon of pulgonesSeleccionados) {
          if (unidadObjetivo.enfermedadViral) {
            this.sim.enviarOrden({ tipo: "curarEnfermedad", unidadId: pulgon.id, objetivoId: unidadObjetivo.id, jugador: this.jugadorLocal });
          } else {
            const destino = this.sim.mapa.dentro(unidadObjetivo.x, unidadObjetivo.y)
              ? { x: unidadObjetivo.x, y: unidadObjetivo.y }
              : { x: cx, y: cy };
            const vecino = this.celdasDestino(destino.x, destino.y, 1)[0] ?? { x: cx, y: cy };
            pedirMover(pulgon.id, vecino.x, vecino.y);
          }
        }
        this.mostrarMarcador(cx, cy);
        return;
      }
    }

    const edificioSeleccionado = this.seleccionadaEdificio !== null
      ? this.sim.edificios.find((b) => b.id === this.seleccionadaEdificio)
      : null;

    if (edificioSeleccionado && !edificioSeleccionado.enConstruccion && (DATOS_EDIFICIO[edificioSeleccionado.tipo]?.atk ?? 0) > 0 && (unidadEnemiga || (edificioObjetivo && edificioObjetivo.jugador !== jugador))) {
      const objetivo = unidadEnemiga
        ? { tipo: "unidad" as const, id: unidadEnemiga.id }
        : { tipo: "edificio" as const, id: edificioObjetivo!.id };
      this.sim.enviarOrden({ tipo: "atacar", edificioId: edificioSeleccionado.id, objetivo, jugador: this.jugadorLocal });
      this.mostrarMarcador(cx, cy, 0xff3030);
      return;
    }

    if (unidadEnemiga || (edificioObjetivo && edificioObjetivo.jugador !== jugador)) {
      const objetivo = unidadEnemiga
        ? { tipo: "unidad" as const, id: unidadEnemiga.id }
        : { tipo: "edificio" as const, id: edificioObjetivo!.id };
      for (const id of ids) {
        this.sim.enviarOrden({ tipo: "atacar", unidadId: id, objetivo, jugador: this.jugadorLocal });
      }
      this.mostrarMarcador(cx, cy, 0xff3030);
      return;
    }

    const idsPulgonesAsignados = new Set<number>();
    if (this.sim.mapa.getRecurso(cx, cy) === Recurso.Flor && pulgonesSeleccionados.length > 0) {
      const celdasValidas: Array<{ x: number; y: number }> = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (!this.sim.mapa.dentro(x, y)) continue;
          if (this.sim.mapa.esAgua(x, y) || this.sim.mapa.estaBloqueada(x, y)) continue;
          if (this.sim.edificios.some((b) => x >= b.x && x < b.x + b.ancho && y >= b.y && y < b.y + b.alto)) continue;
          celdasValidas.push({ x, y });
        }
      }
      if (celdasValidas.length === 0) {
        celdasValidas.push({ x: cx, y: cy });
      }

      if (pulgonesSeleccionados.length === 1) {
        const pulgon = pulgonesSeleccionados[0];
        const actualEnRango = Math.max(Math.abs(pulgon.x - cx), Math.abs(pulgon.y - cy)) <= 1;
        const cell = actualEnRango
          ? { x: pulgon.x, y: pulgon.y }
          : celdasValidas
              .map((pos) => ({ ...pos, dist: Math.max(Math.abs(pos.x - pulgon.x), Math.abs(pos.y - pulgon.y)) }))
              .sort((a, b) => a.dist - b.dist || a.y - b.y || a.x - b.x)[0] ?? { x: cx, y: cy };
        this.sim.enviarOrden({
          tipo: "recolectar",
          unidadId: pulgon.id,
          x: cx,
          y: cy,
          posX: cell.x,
          posY: cell.y,
          jugador: this.jugadorLocal,
        });
        idsPulgonesAsignados.add(pulgon.id);
      } else {
        const restantes = [...pulgonesSeleccionados].sort((a, b) => a.id - b.id);
        while (restantes.length > 0) {
          const ronda: Array<{ pulgon: Unidad; cell: { x: number; y: number } }> = [];
          const usados = new Set<number>();
          for (const cell of celdasValidas) {
            let mejor: Unidad | null = null;
            let mejorDist = Number.POSITIVE_INFINITY;
            for (const pulgon of restantes) {
              if (usados.has(pulgon.id)) continue;
              const dist = Math.max(Math.abs(pulgon.x - cell.x), Math.abs(pulgon.y - cell.y));
              if (dist < mejorDist || (dist === mejorDist && (mejor === null || pulgon.id < mejor.id))) {
                mejor = pulgon;
                mejorDist = dist;
              }
            }
            if (!mejor) continue;
            usados.add(mejor.id);
            ronda.push({ pulgon: mejor, cell });
          }
          if (ronda.length === 0) break;
          for (const { pulgon, cell } of ronda) {
            this.sim.enviarOrden({
              tipo: "recolectar",
              unidadId: pulgon.id,
              x: cx,
              y: cy,
              posX: cell.x,
              posY: cell.y,
              jugador: this.jugadorLocal,
            });
            idsPulgonesAsignados.add(pulgon.id);
            const idx = restantes.findIndex((u) => u.id === pulgon.id);
            if (idx >= 0) restantes.splice(idx, 1);
          }
        }
      }
    }

    if (this.sim.mapa.estaBloqueada(cx, cy)) {
      this.mostrarMarcador(cx, cy);
      return;
    }

    if (this.sim.mapa.esAgua(cx, cy)) {
      const idsRecolectores = ids.filter((id) => {
        const unidad = this.sim.unidades.find((u) => u.id === id);
        return unidad?.tipo === TipoUnidad.Obrera && unidad.jugador === this.jugadorLocal;
      });
      const idsMovimiento = ids.filter((id) => !idsRecolectores.includes(id));
      for (const id of idsRecolectores) {
        if (idsPulgonesAsignados.has(id)) continue;
        this.sim.enviarOrden({ tipo: "recolectar", unidadId: id, x: cx, y: cy, jugador: this.jugadorLocal });
      }
      const destinos = this.celdasDestino(cx, cy, idsMovimiento.length);
      destinos.forEach((d, i) => {
        const id = idsMovimiento[i];
        if (id === undefined) return;
        pedirMover(id, d.x, d.y);
      });
      this.mostrarMarcador(cx, cy);
      return;
    }

    if (this.sim.mapa.getRecurso(cx, cy) === Recurso.Flor && this.sim.mapa.getCantidad(cx, cy) > 0) {
      const idsNoPulgones = ids.filter((id) => !idsPulgonesAsignados.has(id) && !pulgonesSeleccionados.some((u) => u.id === id));
      const destinos = this.celdasDestino(cx, cy, idsNoPulgones.length);
      destinos.forEach((d, i) => {
        const id = idsNoPulgones[i];
        if (id === undefined) return;
        pedirMover(id, d.x, d.y);
      });
      this.mostrarMarcador(cx, cy, 0x00ff88);
      return;
    }

    if (this.sim.esRecolectable(cx, cy)) {
      for (const id of ids) {
        if (idsPulgonesAsignados.has(id)) continue;
        this.sim.enviarOrden({ tipo: "recolectar", unidadId: id, x: cx, y: cy, jugador: this.jugadorLocal });
      }
    } else {
      const idsSinPulgones = ids.filter((id) => !idsPulgonesAsignados.has(id));
      const destinos = this.celdasDestino(cx, cy, idsSinPulgones.length);
      destinos.forEach((d, i) => {
        const id = idsSinPulgones[i];
        if (id === undefined) return;
        pedirMover(id, d.x, d.y);
      });
    }
    this.mostrarMarcador(cx, cy);
  }

  // Formación simple: la celda clicada y anillos alrededor (sin agua ni edificios)
  private celdasDestino(cx: number, cy: number, n: number): Array<{ x: number; y: number }> {
    const mapa = this.sim.mapa;
    const res: Array<{ x: number; y: number }> = [];
    const maxRadio = Math.max(mapa.ancho, mapa.alto);
    for (let r = 0; res.length < n && r <= maxRadio; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (r > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (!mapa.dentro(x, y)) continue;
          if (mapa.getTerreno(x, y) === Terreno.Agua) continue;
          if (mapa.estaBloqueada(x, y)) continue;
          if (this.sim.edificios.some((b) => x >= b.x && x < b.x + b.ancho && y >= b.y && y < b.y + b.alto)) continue;
          res.push({ x, y });
          if (res.length >= n) break;
        }
        if (res.length >= n) break;
      }
    }
    return res;
  }

  private asignarDomesticacion(trabajadores: Unidad[], pulgonClic: Unidad): void {
    const idsSeleccionadas = new Set(trabajadores.map((u) => u.id));
    const ocupados = new Set<number>(
      this.sim.unidades
        .filter(
          (u) =>
            u.tipo === TipoUnidad.Obrera &&
            (u.estado === Estado.IrADomesticar || u.estado === Estado.Domesticando) &&
            u.objetivoDomesticacionId !== null &&
            !idsSeleccionadas.has(u.id)
        )
        .map((u) => u.objetivoDomesticacionId)
        .filter((id): id is number => id !== null)
    );

    const candidatos = [pulgonClic, ...this.sim.unidades.filter(
      (u) =>
        u.tipo === TipoUnidad.Pulgones &&
        u.hp > 0 &&
        u.jugador !== this.jugadorLocal &&
        u.id !== pulgonClic.id &&
        Math.max(Math.abs(u.x - pulgonClic.x), Math.abs(u.y - pulgonClic.y)) <= 1
    )]
      .filter((u, index, arr) => arr.findIndex((v) => v.id === u.id) === index)
      .filter((u) => u.hp > 0 && u.tipo === TipoUnidad.Pulgones && u.jugador !== this.jugadorLocal && !ocupados.has(u.id))
      .sort((a, b) => {
        const da = Math.max(Math.abs(a.x - pulgonClic.x), Math.abs(a.y - pulgonClic.y));
        const db = Math.max(Math.abs(b.x - pulgonClic.x), Math.abs(b.y - pulgonClic.y));
        if (a.id === pulgonClic.id) return -1;
        if (b.id === pulgonClic.id) return 1;
        return da - db;
      });

    if (candidatos.length === 0) {
      this.mostrarMensajeError("No free aphids to tame");
      return;
    }

    const trabajadoresRestantes = [...trabajadores];
    const asignados = new Set<number>();

    for (const aphid of candidatos) {
      if (trabajadoresRestantes.length === 0) break;
      let trabajadorElegido = trabajadoresRestantes[0];
      let mejorDist = Number.POSITIVE_INFINITY;

      for (const trabajador of trabajadoresRestantes) {
        const dist = Math.max(Math.abs(trabajador.x - aphid.x), Math.abs(trabajador.y - aphid.y));
        if (dist < mejorDist) {
          mejorDist = dist;
          trabajadorElegido = trabajador;
        }
      }

      const index = trabajadoresRestantes.findIndex((u) => u.id === trabajadorElegido.id);
      if (index >= 0) {
        trabajadoresRestantes.splice(index, 1);
      }
      if (asignados.has(trabajadorElegido.id)) continue;
      asignados.add(trabajadorElegido.id);
      this.sim.enviarOrden({
        tipo: "domesticar",
        unidadId: trabajadorElegido.id,
        objetivoId: aphid.id,
        jugador: this.jugadorLocal,
      });
    }

    this.mostrarMarcador(pulgonClic.x, pulgonClic.y);
  }

  // Marcador de destino: cuatro "píxeles" que se cierran hacia el centro.
  // Verde por defecto (mover, curar, reparar, etc.), rojo solo para ataque real.
  private mostrarMarcador(cx: number, cy: number, color: number = 0x2ecc71): void {
    const centroX = cx * TAM + TAM / 2;
    const centroY = cy * TAM + TAM / 2;
    const esquinas = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const marcadoresLibres = this.marcadoresPool.filter((_, index) => !this.marcadoresOcupados.has(index));
    if (marcadoresLibres.length < 4) return;

    for (let i = 0; i < esquinas.length; i++) {
      const [sx, sy] = esquinas[i];
      const idx = this.marcadoresPool.indexOf(marcadoresLibres[i]);
      if (idx === -1) continue;
      this.marcadoresOcupados.add(idx);
      const r = this.marcadoresPool[idx];
      r
        .setPosition(centroX + sx * 12, centroY + sy * 12)
        .setFillStyle(color)
        .setAlpha(1)
        .setVisible(true);
      this.tweens.add({
        targets: r,
        x: centroX + sx * 4,
        y: centroY + sy * 4,
        alpha: 0,
        duration: 350,
        ease: "Quad.easeIn",
        onComplete: () => {
          r.setVisible(false).setAlpha(1);
          this.marcadoresOcupados.delete(idx);
        },
      });
    }
  }

   // Entrega: sale un "+1" por recurso entregado (si entrega agua, aparecen dos "+1")
  private obtenerTextoFlotante(): { texto: Phaser.GameObjects.Text; token: number } | null {
    for (let i = 0; i < this.textosFlotantesPool.length; i++) {
      if (this.textosFlotantesOcupados.has(i)) continue;
      this.textosFlotantesOcupados.add(i);
      const texto = this.textosFlotantesPool[i];
      const token = (this.textosFlotantesTokens.get(texto) ?? 0) + 1;
      this.textosFlotantesTokens.set(texto, token);
      texto.setVisible(true).setAlpha(1);
      return { texto, token };
    }
    return null;
  }

  private releaseTextoFlotante(texto: Phaser.GameObjects.Text, token?: number): void {
    if (token !== undefined && this.textosFlotantesTokens.get(texto) !== token) {
      return;
    }
    if (this.textosFlotantesPool.includes(texto)) {
      const index = this.textosFlotantesPool.indexOf(texto);
      if (index !== -1) {
        this.textosFlotantesOcupados.delete(index);
      }
      this.textosFlotantesTokens.delete(texto);
      this.tweens.killTweensOf(texto);
      texto.setVisible(false).setAlpha(1);
      return;
    }
    this.tweens.killTweensOf(texto);
    this.textosFlotantesTokens.delete(texto);
    texto.setVisible(false).setAlpha(1);
    texto.destroy();
  }

  private mostrarEntrega(ev: EventoEntrega): void {
    const c = this.circulos.get(ev.unidadId);
    if (!c) return;

    const entregas: Array<{ color: string; offsetX: number }> = [];
    if (ev.agua > 0) {
      entregas.push({ color: "#4aa8ff", offsetX: -5 });
      entregas.push({ color: "#4aa8ff", offsetX: 5 });
    }
    if (ev.arcilla > 0) {
      entregas.push({ color: "#ffd23f", offsetX: -5 });
      entregas.push({ color: "#ffd23f", offsetX: 5 });
    }
    if ((ev.nectar ?? 0) > 0) {
      entregas.push({ color: "#ff69b4", offsetX: 0 });
    }

    entregas.forEach((item, i) => {
      const asignado = this.obtenerTextoFlotante();
      const t = asignado ? asignado.texto : this.add.text(c.x + item.offsetX, c.y - 11, "+1", {
        fontFamily: "monospace",
        fontSize: "8px",
        fontStyle: "bold",
        color: item.color,
        stroke: "#000000",
        strokeThickness: 2,
        resolution: 2,
      }).setOrigin(0.5).setDepth(20);
      const token = asignado?.token;
      this.camUI.ignore(t);
      t.setText("+1").setPosition(c.x + item.offsetX, c.y - 11).setColor(item.color).setVisible(true);
      this.tweens.add({
        targets: t,
        y: t.y - 11 - (i % 2) * 4,
        alpha: 0,
        duration: 800,
        ease: "Quad.easeOut",
        onComplete: () => {
          this.releaseTextoFlotante(t, token);
        },
      });
    });
  }

  private mostrarMensajeError(msg: string): void {
    this.textoMensajeError = msg;
    this.temporizadorError = 30; // 3 segundos a 10 ticks/s
  }

  private mostrarNotificacion(mensaje: string): void {
    if (!this.textoNotifCreacion) {
      this.textoNotifCreacion = this.add
        .text(this.scale.width / 2, 60, "", {
          color: "#4aff66",
          fontSize: "16px",
          fontStyle: "bold",
          backgroundColor: "#000000aa",
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0.5, 0)
        .setDepth(15);
      this.cameras.main.ignore(this.textoNotifCreacion); // es HUD: solo la dibuja camUI
    }
    this.textoNotifCreacion.setText(mensaje).setVisible(true);
    // LEAK: reset a previous notification timer before creating a new delayed callback.
    if (this.notifTimer) this.time.removeEvent(this.notifTimer);
    this.notifTimer = this.time.delayedCall(1000, () => {
      if (this.textoNotifCreacion) {
        this.textoNotifCreacion.setVisible(false);
      }
    });
  }
  private actualizarBarrasProgresoEdificio(): void {
    const activos = new Set<number>();

    for (const e of this.sim.edificios) {
      if (!e.cola || e.cola.length === 0) continue;
      activos.add(e.id);

      const item = e.cola[0];
      const progreso = Math.max(0, Math.min(1, 1 - item.ticksRestantes / item.ticksTotales));
      const tiempoRestanteSeg = Math.max(0, item.ticksRestantes / TICKS_POR_SEGUNDO);
      const bx = e.x * TAM;
      const by = e.y * TAM - 12;
      const ancho = TAM * e.ancho;

      let barra = this.barrasProgresoPorEdificio.get(e.id);
      if (!barra) {
        const bg = this.add
          .rectangle(bx, by, ancho, 6, 0x111118, 0.8)
          .setOrigin(0, 0)
          .setDepth(10);
        bg.setStrokeStyle(1, 0x444444);
        this.camUI.ignore(bg);

        const bar = this.add
          .rectangle(bx + 1, by + 1, Math.round((ancho - 2) * progreso), 4, 0x4aa8ff, 1)
          .setOrigin(0, 0)
          .setDepth(11);
        this.camUI.ignore(bar);

        const txt = this.add
          .text(bx + ancho / 2, by - 6, `${tiempoRestanteSeg.toFixed(1)}s`, {
            color: "#ffffff",
            fontSize: "8px",
            fontFamily: "monospace",
          })
          .setOrigin(0.5, 0.5)
          .setDepth(12);
        this.camUI.ignore(txt);

        barra = { bg, bar, txt };
        this.barrasProgresoPorEdificio.set(e.id, barra);
      }

      barra.bg.setPosition(bx, by).setSize(ancho, 6);
      barra.bar.setPosition(bx + 1, by + 1).setSize(Math.max(0, Math.round((ancho - 2) * progreso)), 4);
      barra.txt
        .setPosition(bx + ancho / 2, by - 6)
        .setText(`${tiempoRestanteSeg.toFixed(1)}s`);
    }

    for (const [id, barra] of this.barrasProgresoPorEdificio) {
      if (!activos.has(id)) {
        barra.bg.destroy();
        barra.bar.destroy();
        barra.txt.destroy();
        this.barrasProgresoPorEdificio.delete(id);
      }
    }
    this.colasEdificiosDirty = false;
  }




  private comprobarClicBotonesAccion(x: number, y: number): void {
    for (let i = 0; i < this.botonesAccion.length; i++) {
      const btn = this.botonesAccion[i];
      const bx = btn.x - btn.width / 2;
      const by = btn.y - btn.height / 2;
      if (x >= bx && x <= bx + btn.width && y >= by && y <= by + btn.height) {
        const accion = this.accionesBotonesActuales[i]?.accion;
        if (accion === "borrarEdificio") {
          this.eliminarEdificioEnConstruccionSeleccionado();
          return;
        }

        const unidadesSeleccionadas = this.sim.unidades.filter((u) => this.seleccionadas.has(u.id));
        if (unidadesSeleccionadas.length > 0) {
          if (accion === "ataque") {
            this.modoAtaque = this.hayUnidadSeleccionadaQuePuedeAtacar() || this.hayEdificioSeleccionadoQuePuedeAtacar();
            this.modoCuracion = false;
            this.modoReparacionEdificio = false;
            this.modoDomesticar = false;
            this.modoLlevarCadaver = false;
            this.modoConstruccion = null;
            this.limpiarBotonesConstruccion();
          } else if (accion === "llevarCadaver") {
            this.modoAtaque = false;
            this.modoCuracion = false;
            this.modoReparacionEdificio = false;
            this.modoDomesticar = false;
            this.modoLlevarCadaver = true;
            this.modoConstruccion = null;
            this.limpiarBotonesConstruccion();
            this.actualizarCursorModoSeleccion();
            this.actualizarBotonesModo();
            return;
          } else if (accion === "domesticar") {
            this.modoAtaque = false;
            this.modoCuracion = false;
            this.modoReparacionEdificio = false;
            this.modoDomesticar = true;
            this.modoLlevarCadaver = false;
            this.modoConstruccion = null;
            this.limpiarBotonesConstruccion();
            this.actualizarCursorModoSeleccion();
            this.actualizarBotonesModo();
            return;
          } else if (accion === "curar") {
            this.modoAtaque = false;
            this.modoCuracion = true;
            this.modoReparacionEdificio = false;
            this.modoDomesticar = false;
            this.modoLlevarCadaver = false;
            this.modoConstruccion = null;
            this.limpiarBotonesConstruccion();
            this.actualizarCursorModoSeleccion();
            this.actualizarBotonesModo();
            return;
          } else if (accion === "reparar") {
            this.modoAtaque = false;
            this.modoCuracion = false;
            this.modoReparacionEdificio = true;
            this.modoDomesticar = false;
            this.modoLlevarCadaver = false;
            this.modoConstruccion = null;
            this.limpiarBotonesConstruccion();
            this.actualizarCursorModoSeleccion();
            this.actualizarBotonesModo();
            return;
          } else if (accion === "construir") {
            this.modoAtaque = false;
            this.modoCuracion = false;
            this.modoReparacionEdificio = false;
            this.modoDomesticar = false;
            this.modoLlevarCadaver = false;
            this.modoConstruccion = null;
            if (this.menuConstruccionAbierto) {
              this.cerrarMenuConstruccion();
            } else {
              this.menuConstruccionAbierto = true;
              this.limpiarBotonesAccion();
              this.crearBotonesConstruccion(Array.from(EDIFICIOS_CONSTRUIBLES_POR_OBRERA));
            }
            this.actualizarBotonesModo();
            return;
          }
          this.actualizarCursorModoSeleccion();
          this.actualizarBotonesModo();
          return;
        }
        const e = this.sim.edificios.find((b) => b.id === this.seleccionadaEdificio);
        if (!e) return;

        if (e.cola && e.cola.length >= 8) {
          this.mostrarMensajeError("Production queue full (max 8)");
          return;
        }

        if (e.tipo === TipoEdificio.Reina) {
          const unidadesTipos = [0, 1, 2, 3];
          const tipoU = unidadesTipos[i];
          if (tipoU !== undefined) {
            this.sim.enviarOrden({ tipo: "producir", edificioId: e.id, tipoUnidad: tipoU, jugador: this.jugadorLocal });
            this.colasEdificiosDirty = true;
          }
        }
        this.actualizarBarrasProgresoEdificio();
      }
    }
  }

  private claveBotones = "";

  private posicionBotonHUD(indice: number): { x: number; y: number } {
    const cols = 3;
    const totalW = cols * BTN_W + (cols - 1) * BTN_GAP; // 246
    const izquierda = this.scale.width - HUD_PADDING - totalW; // right edge = width - 12
    const arriba = this.scale.height - ALTO_HUD_INFERIOR + HUD_PADDING;
    const col = indice % cols;
    const fila = Math.floor(indice / cols);
    return {
      x: izquierda + BTN_W / 2 + col * (BTN_W + BTN_GAP),
      y: arriba + BTN_H / 2 + fila * (BTN_H + BTN_GAP),
    };
  }

  private posicionBotonAccionHUD(indice: number): { x: number; y: number } {
    const accionX = this.scale.width - 150;
    const accionY = this.scale.height - ALTO_HUD_INFERIOR + 26 + indice * (ACCION_BTN_H + ACCION_BTN_GAP);
    return { x: accionX, y: accionY };
  }

  private puedeColocarEdificioEn(x: number, y: number, tipo: number): boolean {
    const datos = DATOS_EDIFICIO[tipo];
    if (!datos) return false;
    for (let dy = 0; dy < datos.alto; dy++) {
      for (let dx = 0; dx < datos.ancho; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (!this.sim.mapa.dentro(cx, cy)) return false;
        if (this.sim.mapa.esAgua(cx, cy) || this.sim.mapa.estaBloqueada(cx, cy)) return false;
        const solapa = this.sim.edificios.some((ed) =>
          cx >= ed.x &&
          cx < ed.x + ed.ancho &&
          cy >= ed.y &&
          cy < ed.y + ed.alto &&
          !(ed.tipo === tipo && ed.enConstruccion && ed.jugador === this.jugadorLocal && ed.x === x && ed.y === y && ed.ancho === datos.ancho && ed.alto === datos.alto)
        );
        if (solapa) return false;
      }
    }
    return true;
  }

  private actualizarPreviewConstruccion(): void {
    if (this.modoConstruccion === null) {
      this.previewTipo = null;
      if (this.previewConstruccion) this.previewConstruccion.setVisible(false);
      this.previewLinea.forEach((item) => item.destroy());
      this.previewLinea = [];
      if (this.textoCosteLinea) this.textoCosteLinea.setVisible(false);
      return;
    }
    const tipo = this.modoConstruccion;
    const datos = DATOS_EDIFICIO[tipo];
    if (!datos) return;
    if (this.esConstruccionArrastrable(tipo) && this.arrastreConstruccion) {
      const celdas = this.lineaDeConstruccion(this.arrastreConstruccion.inicio, this.arrastreConstruccion.fin);
      this.previewLinea.forEach((item) => item.destroy());
      this.previewLinea = [];
      if (!this.textoCosteLinea) {
        this.textoCosteLinea = this.add
          .text(0, 0, "", {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#00000088',
            padding: { x: 6, y: 4 },
          })
          .setDepth(20)
          .setVisible(false);
        this.cameras.main.ignore(this.textoCosteLinea);
      }
      const coste = datos.costeArcilla ?? 0;
      const total = celdas.length * coste;
      const texto = `${celdas.length} celdas · ${total} arcilla`;
      const costeValido = this.sim.stock[this.jugadorLocal].arcilla >= total;
      this.textoCosteLinea.setText(texto).setColor(costeValido ? '#A9F0B5' : '#FF8D8D');
      const puntero = this.input.activePointer;
      this.textoCosteLinea.setPosition(puntero.x + 18, puntero.y - 24).setVisible(true);
      for (let i = 0; i < celdas.length; i++) {
        const celda = celdas[i];
        const img = this.add.image(0, 0, this.ensureTexturaEdificio(tipo, this.jugadorLocal));
        img
          .setOrigin(0, 0)
          .setDepth(4)
          .setAlpha(0.5)
          .setPosition(celda.x * TAM, celda.y * TAM)
          .setDisplaySize(datos.ancho * TAM, datos.alto * TAM)
          .setTint(this.puedeColocarEdificioEn(celda.x, celda.y, tipo) ? 0x67f0a5 : 0xff8d8d)
          .setVisible(true);
        this.camUI.ignore(img);
        this.previewLinea.push(img);
      }
      return;
    }
    this.previewLinea.forEach((item) => item.destroy());
    this.previewLinea = [];
    if (this.textoCosteLinea) this.textoCosteLinea.setVisible(false);
    if (!this.previewConstruccion || this.previewTipo !== tipo) {
      this.previewTipo = tipo;
      if (this.previewConstruccion) this.previewConstruccion.destroy();
      this.previewConstruccion = this.add
        .image(0, 0, this.ensureTexturaEdificio(tipo, this.jugadorLocal))
        .setOrigin(0, 0)
        .setDepth(4)
        .setAlpha(0.45);
      this.camUI.ignore(this.previewConstruccion);
    }
    const puntero = this.input.activePointer;
    if (this.punteroSobreHUD(puntero.x, puntero.y)) {
      this.previewConstruccion.setVisible(false);
      return;
    }
    const mundo = this.cameras.main.getWorldPoint(puntero.x, puntero.y);
    const x = Math.floor(mundo.x / TAM);
    const y = Math.floor(mundo.y / TAM);
    const valido = this.puedeColocarEdificioEn(x, y, tipo);
    this.previewConstruccion
      .setPosition(x * TAM, y * TAM)
      .setDisplaySize(datos.ancho * TAM, datos.alto * TAM)
      .setTint(valido ? 0x67f0a5 : 0xff8d8d)
      .setAlpha(0.45)
      .setVisible(true);
  }

  private celdaDesdePuntero(p: Phaser.Input.Pointer): { x: number; y: number } {
    const mundo = this.cameras.main.getWorldPoint(p.x, p.y);
    return {
      x: Math.floor(mundo.x / TAM),
      y: Math.floor(mundo.y / TAM),
    };
  }

  private lineaDeConstruccion(inicio: { x: number; y: number }, fin: { x: number; y: number }): Array<{ x: number; y: number }> {
    const dx = fin.x - inicio.x;
    const dy = fin.y - inicio.y;
    if (dx === 0 && dy === 0) return [inicio];

    const angulo = Math.atan2(dy, dx);
    const anguloAjustado = Math.round(angulo / (Math.PI / 4)) * (Math.PI / 4);
    const cosAjustado = Math.cos(anguloAjustado);
    const sinAjustado = Math.sin(anguloAjustado);
    const sx = Math.abs(cosAjustado) < 0.5 ? 0 : (cosAjustado >= 0 ? 1 : -1);
    const sy = Math.abs(sinAjustado) < 0.5 ? 0 : (sinAjustado >= 0 ? 1 : -1);
    const denominador = sx * sx + sy * sy;
    const n = Math.max(0, Math.round((dx * sx + dy * sy) / denominador));

    const celdas: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= n; i++) {
      celdas.push({ x: inicio.x + i * sx, y: inicio.y + i * sy });
    }
    return celdas.slice(0, MAX_CELDAS_ARRASTRE);
  }

  private limpiarBotonesConstruccion(): void {
    this.ocultarTooltipBoton();
    this.tiposBotonesConstruccion = [];
    for (const b of this.botonesConstruccion) b.destroy();
    for (const t of this.textosBotonConstruccion) t.destroy();
    for (const r of this.subrayadosBotonConstruccion) r.destroy();
    this.subrayadosBotonConstruccion = [];
    for (const item of this.textosCostoConstruccion) item.texto.destroy();
    this.botonesConstruccion = [];
    this.textosBotonConstruccion = [];
    this.textosCostoConstruccion = [];
  }

  private limpiarBotonesAccion(): void {
    this.ocultarTooltipBoton();
    this.claveBotones = "";
    this.accionesBotonesActuales = [];
    for (const b of this.botonesAccion) b.destroy();
    for (const t of this.textosBotonAccion) t.destroy();
    for (const r of this.subrayadosBotonAccion) r.destroy();
    this.subrayadosBotonAccion = [];
    for (const item of this.textosCostoAccion) item.texto.destroy();
    this.botonesAccion = [];
    this.textosBotonAccion = [];
    this.textosCostoAccion = [];
  }

  private listarCostesRecurso(coste?: { agua?: number; arcilla?: number; nectar?: number; costeAgua?: number; costeArcilla?: number; costeNectar?: number }): Array<{ etiqueta: string; valor: number; recurso: "agua" | "arcilla" | "nectar" }> {
    const agua = coste?.agua ?? coste?.costeAgua ?? 0;
    const arcilla = coste?.arcilla ?? coste?.costeArcilla ?? 0;
    const nectar = coste?.nectar ?? coste?.costeNectar ?? 0;
    return [
      { etiqueta: "Agua", valor: agua, recurso: "agua" as const },
      { etiqueta: "Arcilla", valor: arcilla, recurso: "arcilla" as const },
      { etiqueta: "Néctar", valor: nectar, recurso: "nectar" as const },
    ].filter((item) => item.valor > 0);
  }

  private refrescarColoresCosto(): void {
    const stock = this.sim.stock[this.jugadorLocal];
    for (const item of [...this.textosCostoAccion, ...this.textosCostoConstruccion]) {
      const color = item.recurso === "agua"
        ? (stock.agua >= item.valor ? "#4aa8ff" : "#ff5555")
        : item.recurso === "arcilla"
          ? (stock.arcilla >= item.valor ? "#ffd23f" : "#ff5555")
          : (stock.nectar >= item.valor ? "#ff69b4" : "#ff5555");
      item.texto.setColor(color);
    }
  }

  // Mide texto con la misma tipografía que un Phaser.Text (para calcular el subrayado).
  private medirTexto(ref: Phaser.GameObjects.Text, cadena: string): number {
    if (!this.ctxMedicionTexto) {
      this.ctxMedicionTexto = document.createElement("canvas").getContext("2d");
    }
    const ctx = this.ctxMedicionTexto;
    if (!ctx) return 0;
    ctx.font = `${ref.style.fontStyle} ${ref.style.fontSize} ${ref.style.fontFamily}`;
    return ctx.measureText(cadena).width;
  }

  // Subraya la primera aparición de `tecla` en el texto del botón (funciona con texto
  // centrado y también si el texto se parte en varias líneas).
  private crearSubrayadoHotkey(texto: Phaser.GameObjects.Text, tecla: string): Phaser.GameObjects.Rectangle | null {
    const lineas = texto.getWrappedText(texto.text);
    const letra = tecla.toLowerCase();
    for (let li = 0; li < lineas.length; li++) {
      const ci = lineas[li].toLowerCase().indexOf(letra);
      if (ci < 0) continue;
      const anchoLinea = this.medirTexto(texto, lineas[li]);
      const antes = this.medirTexto(texto, lineas[li].slice(0, ci));
      const anchoLetra = this.medirTexto(texto, lineas[li][ci]);
      const altoLinea = texto.height / lineas.length;
      const xLetra = texto.x - anchoLinea / 2 + antes + anchoLetra / 2;
      const yLinea = texto.y - texto.height / 2 + (li + 1) * altoLinea - 3;
      return this.add.rectangle(xLetra, yLinea, anchoLetra, 2, 0xffffff, 1).setDepth(15);
    }
    return null;
  }

  private descripcionTooltipBoton(label: string): string {
    const texto = label.trim();
    switch (texto) {
      case "Attack": return "Attack nearby enemies and deal damage in combat.";
      case "Build": return "Construct structures for unit creation, economy, etc.";
      case "Tame": return "Calm wild units and recruit them to your side.";
      case "Cure Disease": return "Remove viral infection from affected units.";
      case "Repair Building": return "Restore damaged structures and keep them operational.";
      case "Delete building": return "Cancel construction and refund half the resource cost.";
      case "Ant Worker": return "Train a worker that gathers resources and builds.";
      case "Guerrera": return "Train a ground warrior.";
      case "Voladora": return "Train a flying scout.";
      case "G. Voladora": return "Train a flying warrior.";
      case "Carry Corpse": return "Pick up a corpse and bring it to safety.";
      case "Leave Corpse": return "Drop the carried corpse in the current area.";
      case "Back": return "Return to the previous build menu.";
      default: return texto;
    }
  }

  private descripcionTooltipEdificio(tipo: number): string {
    if (tipo === -1) return "Return to the previous build menu.";
    const datos = DATOS_EDIFICIO[tipo];
    return datos?.descripcion ?? "Build this structure to support the colony.";
  }

  private ocultarTooltipBoton(): void {
    if (this.tooltipTimer) {
      this.tooltipTimer.remove(false);
      this.tooltipTimer = undefined;
    }
    if (this.tooltipHUD) {
      this.tooltipHUD.setVisible(false).setText("");
    }
  }

  private mostrarTooltipBoton(texto: string, px: number, py: number): void {
    if (!this.tooltipHUD) {
      this.tooltipHUD = this.add.text(0, 0, "", {
        color: "#f7f9ff",
        backgroundColor: "#111827CC",
        padding: { x: 8, y: 4 },
        fontSize: "12px",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
        wordWrap: { width: 260 },
        resolution: 2,
      }).setDepth(2000).setVisible(false).setOrigin(1, 0.5);
      this.cameras.main.ignore(this.tooltipHUD);
    }
    this.tooltipHUD.setText(texto);
    this.posicionarTooltip(px, py);
    this.tooltipHUD.setVisible(true);
  }

  // Left of the cursor, always inside the screen.
  private posicionarTooltip(px: number, py: number): void {
    const t = this.tooltipHUD;
    if (!t) return;
    const margen = 4;
    const x = Math.max(t.width + margen, px - 16);
    const y = Phaser.Math.Clamp(
      py - 18,
      t.height / 2 + margen,
      this.scale.height - t.height / 2 - margen
    );
    t.setPosition(x, y);
  }

  private registrarTooltipBoton(bg: Phaser.GameObjects.Rectangle, texto: string): void {
    bg.on("pointerover", () => {
      this.ocultarTooltipBoton();
      this.tooltipTimer = this.time.delayedCall(1500, () => {
        const p = this.input.activePointer;
        this.mostrarTooltipBoton(texto, p.x, p.y);
      });
    });
    bg.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.tooltipHUD?.visible) this.posicionarTooltip(pointer.x, pointer.y);
    });
    bg.on("pointerout", () => this.ocultarTooltipBoton());
    bg.on("pointerdown", () => this.ocultarTooltipBoton());
  }

  // Todo el contenido del botón (nombre + costes) queda centrado dentro del propio botón,
  // tanto horizontal como verticalmente.
  private crearBotonConCosto(
    x: number,
    y: number,
    nombre: string,
    coste?: { agua?: number; arcilla?: number; nectar?: number; costeAgua?: number; costeArcilla?: number; costeNectar?: number },
    stock?: { agua: number; arcilla: number; nectar: number },
    costoTarget: Array<{ texto: Phaser.GameObjects.Text; recurso: "agua" | "arcilla" | "nectar"; valor: number }> = [],
    ancho = BTN_W,
    alto = BTN_H,
    costeStepY = 13,
    costesEnLinea = false,
    separacionNombreCoste = 5,
    hotkey?: string
  ): {
    bg: Phaser.GameObjects.Rectangle;
    textoNombre: Phaser.GameObjects.Text;
    textosCoste: Phaser.GameObjects.Text[];
    subrayado: Phaser.GameObjects.Rectangle | null;
  } {
    const bg = this.add
      .rectangle(x, y, ancho, alto, 0x2a3a5a, 1)
      .setInteractive()
      .setDepth(13)
      .setStrokeStyle(1, 0x5a7ca5);
    bg.on("pointerover", () => bg.setFillStyle(0x3b527e));
    bg.on("pointerout", () => this.actualizarBotonesModo());

    const textoNombre = this.add
      .text(x, y, nombre, {
        color: "#ffffff",
        fontSize: "14px",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: ancho - 8 },
        resolution: 2,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(14);

    const textosCoste: Phaser.GameObjects.Text[] = [];
    const costes = this.listarCostesRecurso(coste ?? { agua: 0, arcilla: 0, nectar: 0 });
    for (let i = 0; i < costes.length; i++) {
      const item = costes[i];
      const color = item.recurso === "agua" ? "#4aa8ff" : item.recurso === "arcilla" ? "#ffd23f" : "#ff69b4";
      const text = this.add
        .text(x, y, `${item.valor} ${item.etiqueta}`, {
          color: stock && (item.recurso === "agua" ? stock.agua : item.recurso === "arcilla" ? stock.arcilla : stock.nectar) < item.valor ? "#ff5555" : color,
          fontSize: "10px",
          fontStyle: "bold",
          align: "center",
          resolution: 2,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(14);
      textosCoste.push(text);
      costoTarget.push({ texto: text, recurso: item.recurso, valor: item.valor });
    }

    // Bloque vertical: nombre + (separación) + costes, centrado en el botón.
    const altoNombre = textoNombre.height;
    const altoCoste = textosCoste.length > 0 ? textosCoste[0].height : 0;
    const filasCoste = textosCoste.length === 0 ? 0 : costesEnLinea ? 1 : textosCoste.length;
    const altoCostes = filasCoste === 0 ? 0 : (filasCoste - 1) * costeStepY + altoCoste;
    const separacion = filasCoste === 0 ? 0 : separacionNombreCoste;
    const altoTotal = altoNombre + separacion + altoCostes;
    const arriba = y - altoTotal / 2;
    textoNombre.setY(arriba + altoNombre / 2);
    for (let i = 0; i < textosCoste.length; i++) {
      const fila = costesEnLinea ? 0 : i;
      textosCoste[i].setY(arriba + altoNombre + separacion + altoCoste / 2 + fila * costeStepY);
    }

    // Costes en una sola línea: se colocan uno al lado del otro y el conjunto queda centrado.
    if (costesEnLinea && textosCoste.length > 0) {
      const hueco = 10;
      const total = textosCoste.reduce((acc, t) => acc + t.width, 0) + hueco * (textosCoste.length - 1);
      let cursor = x - total / 2;
      for (const t of textosCoste) {
        t.setOrigin(0, 0.5).setX(cursor);
        cursor += t.width + hueco;
      }
    }

    const subrayado = hotkey ? this.crearSubrayadoHotkey(textoNombre, hotkey) : null;
    return { bg, textoNombre, textosCoste, subrayado };
  }

  // Misma lógica que el clic en un botón de edificio del menú de construcción.
  private elegirEdificioParaConstruir(tipo: number): void {
    this.modoConstruccion = tipo;
    this.modoAtaque = false;
    this.modoCuracion = false;
    this.modoReparacionEdificio = false;
    this.modoDomesticar = false;
    this.modoLlevarCadaver = false;
    this.menuConstruccionAbierto = true;
    this.pointerDownEnHUD = false;
    this.clicConsumidoPorHUD = false;
    this.actualizarBotonesModo();
    this.actualizarPreviewConstruccion();
  }

  // Hotkeys de los botones del HUD. Con el menú de construcción abierto solo valen las
  // teclas de los edificios (P/T/D/M); si no, las de los botones de acción.
  // La tecla A la sigue gestionando `teclaAtaque` en update().
  private manejarHotkeyBotones(ev: KeyboardEvent): void {
    if (ev.repeat || ev.ctrlKey || ev.altKey || ev.metaKey) return;
    if (ev.key.length !== 1) return;
    const tecla = ev.key.toUpperCase();

    if (this.botonesConstruccion.length > 0) {
      const i = this.tiposBotonesConstruccion.findIndex((t) => HOTKEY_EDIFICIO[t] === tecla);
      if (i < 0) return;
      this.pulsoBoton(this.botonesConstruccion[i], this.textosBotonConstruccion[i]);
      this.elegirEdificioParaConstruir(this.tiposBotonesConstruccion[i]);
      return;
    }

    if (tecla === "A") return;
    const i = this.accionesBotonesActuales.findIndex((a) => HOTKEY_ACCION[a.label] === tecla);
    if (i < 0) return;
    const btn = this.botonesAccion[i];
    if (!btn) return;
    this.pulsoBoton(btn, this.textosBotonAccion[i]);
    this.comprobarClicBotonesAccion(btn.x, btn.y);
  }

  private pulsoBoton(bg: Phaser.GameObjects.Rectangle, texto?: Phaser.GameObjects.Text): void {
    this.tweens.add({
      targets: texto ? [bg, texto] : [bg],
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 60,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  private textoBotonEdificio(tipo: number): string {
    if (tipo === -1) return "Back";
    const datos = DATOS_EDIFICIO[tipo];
    return datos?.etiqueta ?? `E${tipo}`;
  }

  private crearBotonesConstruccion(edificios: number[]): void {
    this.limpiarBotonesConstruccion();
    const tipos = [...edificios, -1];
    for (let i = 0; i < tipos.length; i++) {
      const tipo = tipos[i];
      const esBack = tipo === -1;
      const { x, y } = this.posicionBotonHUD(i);
      const boton = this.crearBotonConCosto(
        x,
        y,
        esBack ? "Back" : this.textoBotonEdificio(tipo),
        esBack ? undefined : DATOS_EDIFICIO[tipo],
        this.sim.stock[this.jugadorLocal],
        this.textosCostoConstruccion,
        BTN_W,
        BTN_H,
        13,
        false,
        5,
        esBack ? undefined : HOTKEY_EDIFICIO[tipo]
      );
      boton.bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation?.();
        this.clicConsumidoPorHUD = true;
        this.pointerDownEnHUD = true;
        boton.bg.setScale(0.96);
        if (esBack) {
          this.cerrarMenuConstruccion();
          return;
        }
        this.elegirEdificioParaConstruir(tipo);
      });
      boton.bg.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation?.();
        boton.bg.setScale(1);
      });
      this.registrarTooltipBoton(boton.bg, this.descripcionTooltipEdificio(tipo));
      this.tiposBotonesConstruccion.push(tipo);
      this.botonesConstruccion.push(boton.bg);
      this.textosBotonConstruccion.push(boton.textoNombre);
      const extrasC = boton.subrayado ? [boton.subrayado] : [];
      if (boton.subrayado) this.subrayadosBotonConstruccion.push(boton.subrayado);
      this.cameras.main.ignore([boton.bg, boton.textoNombre, ...boton.textosCoste, ...extrasC]);
    }
    this.actualizarBotonesModo();
  }

  private eliminarEdificioEnConstruccionSeleccionado(): void {
    const edificio = this.seleccionadaEdificio !== null ? this.buildingById.get(this.seleccionadaEdificio) : undefined;
    if (!edificio || !edificio.enConstruccion) {
      this.mostrarMensajeError("Only buildings under construction can be deleted.");
      return;
    }

    const datos = DATOS_EDIFICIO[edificio.tipo];
    const reembolso = {
      agua: Math.floor((datos?.costeAgua ?? 0) / 2),
      arcilla: Math.floor((datos?.costeArcilla ?? 0) / 2),
      nectar: Math.floor((datos?.costeNectar ?? 0) / 2),
    };

    const stock = this.sim.stock[edificio.jugador];
    stock.agua += reembolso.agua;
    stock.arcilla += reembolso.arcilla;
    stock.nectar += reembolso.nectar;

    for (let y = 0; y < edificio.alto; y++) {
      for (let x = 0; x < edificio.ancho; x++) {
        this.sim.mapa.setBloqueada(edificio.x + x, edificio.y + y, false);
      }
    }

    const indice = this.sim.edificios.findIndex((e) => e.id === edificio.id);
    if (indice >= 0) this.sim.edificios.splice(indice, 1);
    this.rebuildLiveIndexes();

    this.seleccionadaEdificio = null;
    this.panelDirty = true;
    this.limpiarBotonesAccion();
    this.actualizarFondoHudPorSeleccion();
    this.dibujarEdificios();
    this.mostrarMensajeError(`Building deleted. ${reembolso.agua + reembolso.arcilla + reembolso.nectar > 0 ? "Resources refunded." : "No resources refunded."}`);
  }

  private crearBotonesAccion(etiquetas: Array<string | { label: string; costes?: { agua?: number; arcilla?: number; nectar?: number } }>): void {
    if (this.menuConstruccionAbierto) {
      if (this.botonesAccion.length > 0) this.limpiarBotonesAccion();
      return;
    }
    const stock = this.sim.stock[this.jugadorLocal];
    const items = etiquetas.map((item) => {
      const label = typeof item === "string" ? item : item.label;
      const coste = typeof item === "string" ? { agua: 0, arcilla: 0, nectar: 0 } : { agua: item.costes?.agua ?? 0, arcilla: item.costes?.arcilla ?? 0, nectar: item.costes?.nectar ?? 0 };
      const puedePagar = {
        agua: stock.agua >= (coste.agua ?? 0),
        arcilla: stock.arcilla >= (coste.arcilla ?? 0),
        nectar: stock.nectar >= (coste.nectar ?? 0),
      };
      return { label, coste, accion: label === "Attack" ? "ataque" : label === "Tame" ? "domesticar" : label === "Cure Disease" ? "curar" : label === "Repair Building" ? "reparar" : label === "Build" ? "construir" : label === "Delete building" ? "borrarEdificio" : label === "Carry Corpse" || label === "Leave Corpse" ? "llevarCadaver" : "", puedePagar };
    });
    const clave = JSON.stringify(items.map((item) => ({ label: item.label, coste: item.coste, puedePagar: item.puedePagar })));
    if (clave === this.claveBotones && this.botonesAccion.length > 0) return;
    this.limpiarBotonesAccion();
    this.claveBotones = clave;
    this.accionesBotonesActuales = items.map((item) => ({ label: item.label, accion: item.accion }));
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { x, y } = this.posicionBotonAccionHUD(i);
      const boton = this.crearBotonConCosto(
        x,
        y,
        item.label,
        item.coste,
        stock,
        this.textosCostoAccion,
        ACCION_BTN_W,
        ACCION_BTN_H,
        0,
        true, // costes en una línea
        3, // separación entre el nombre y los costes
        HOTKEY_ACCION[item.label]
      );
      boton.bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation?.();
        this.clicConsumidoPorHUD = true;
        this.pointerDownEnHUD = true;
        boton.bg.setScale(0.96);
        this.comprobarClicBotonesAccion(boton.bg.x, boton.bg.y);
      });
      boton.bg.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation?.();
        boton.bg.setScale(1);
      });
      this.registrarTooltipBoton(boton.bg, this.descripcionTooltipBoton(item.label));
      this.botonesAccion.push(boton.bg);
      this.textosBotonAccion.push(boton.textoNombre);
      const extrasA = boton.subrayado ? [boton.subrayado] : [];
      if (boton.subrayado) this.subrayadosBotonAccion.push(boton.subrayado);
      this.cameras.main.ignore([boton.bg, boton.textoNombre, ...boton.textosCoste, ...extrasA]);
    }
    this.actualizarBotonesModo();
  }

  private actualizarBotonesModo(): void {
    for (let i = 0; i < this.botonesAccion.length; i++) {
      const texto = this.textosBotonAccion[i]?.text ?? "";
      const modoActivo =
        (this.modoAtaque && texto === "Attack") ||
        (this.modoCuracion && texto === "Cure Disease") ||
        (this.modoReparacionEdificio && texto === "Repair Building") ||
        (this.modoDomesticar && texto === "Tame") ||
        (this.modoConstruccion !== null && texto === "Build") ||
        (this.modoLlevarCadaver && (texto === "Carry Corpse" || texto === "Leave Corpse"));
      this.botonesAccion[i].setFillStyle(modoActivo ? 0x4c78b8 : 0x2a3a5a);
    }
    for (let i = 0; i < this.botonesConstruccion.length; i++) {
      const tipo = this.tiposBotonesConstruccion[i];
      const activo = tipo !== undefined && tipo !== -1 && this.modoConstruccion === tipo;
      this.botonesConstruccion[i].setFillStyle(activo ? 0x4c78b8 : 0x2a3a5a);
    }
  }

  private actualizarSeleccionEdificio(ahora: number): void {
    const seleccionado = this.seleccionadaEdificio !== null ? this.buildingById.get(this.seleccionadaEdificio) : undefined;
    if (!seleccionado) {
      this.graficoSeleccionEdificio.clear();
      this.brilloSeleccionEdificio.setVisible(false);
      return;
    }

    const x = seleccionado.x * TAM;
    const y = seleccionado.y * TAM;
    const w = seleccionado.ancho * TAM;
    const h = seleccionado.alto * TAM;
    const color = seleccionado.enConstruccion ? 0x9aa0a6 : 0xffde59;
    const glow = 0.18 + (0.5 + 0.5 * Math.sin(ahora * 0.007)) * 0.22;

    this.brilloSeleccionEdificio
      .setTexture(this.ensureTexturaEdificio(seleccionado.tipo, seleccionado.jugador))
      .setPosition(x, y)
      .setOrigin(0, 0)
      .setDisplaySize(w, h)
      .setAlpha(glow)
      .setVisible(true);

    this.graficoSeleccionEdificio.clear();
    this.graficoSeleccionEdificio.fillStyle(color, 0.12 + 0.12 * Math.sin(ahora * 0.008));
    for (let ty = 0; ty < seleccionado.alto; ty++) {
      for (let tx = 0; tx < seleccionado.ancho; tx++) {
        const forma = FORMAS_EDIFICIO[seleccionado.tipo] ?? [[0, 0, 1, 1]];
        const dentro = forma.some(([x0, y0, x1, y1]) => {
          const bx0 = tx / seleccionado.ancho;
          const bx1 = (tx + 1) / seleccionado.ancho;
          const by0 = ty / seleccionado.alto;
          const by1 = (ty + 1) / seleccionado.alto;
          return Math.max(bx0, x0) <= Math.min(bx1, x1) && Math.max(by0, y0) <= Math.min(by1, y1);
        });
        if (!dentro) continue;
        const px = x + tx * TAM;
        const py = y + ty * TAM;
        this.graficoSeleccionEdificio.fillRect(px + 2, py + 2, TAM - 4, TAM - 4);
      }
    }

    this.graficoSeleccionEdificio.lineStyle(2, color, 1);
    this.graficoSeleccionEdificio.strokeRect(x - 2, y - 2, w + 4, h + 4);

    const notch = 4;
    this.graficoSeleccionEdificio.fillStyle(color, 1);
    for (let i = 1; i < seleccionado.ancho; i++) {
      const px = x + i * TAM;
      this.graficoSeleccionEdificio.fillRect(px - notch / 2, y - 2, notch, notch);
      this.graficoSeleccionEdificio.fillRect(px - notch / 2, y + h - notch + 2, notch, notch);
    }
    for (let i = 1; i < seleccionado.alto; i++) {
      const py = y + i * TAM;
      this.graficoSeleccionEdificio.fillRect(x - 2, py - notch / 2, notch, notch);
      this.graficoSeleccionEdificio.fillRect(x + w - notch + 2, py - notch / 2, notch, notch);
    }

    const corner = Math.min(10, w * 0.18, h * 0.18);
    const corners = [
      { x: x - 2, y: y - 2, dx: 1, dy: 1 },
      { x: x + w + 2, y: y - 2, dx: -1, dy: 1 },
      { x: x - 2, y: y + h + 2, dx: 1, dy: -1 },
      { x: x + w + 2, y: y + h + 2, dx: -1, dy: -1 },
    ];
    for (const cornerInfo of corners) {
      this.graficoSeleccionEdificio.beginPath();
      this.graficoSeleccionEdificio.moveTo(cornerInfo.x + (cornerInfo.dx > 0 ? 0 : -corner), cornerInfo.y + (cornerInfo.dy > 0 ? 0 : -corner));
      this.graficoSeleccionEdificio.lineTo(cornerInfo.x + (cornerInfo.dx > 0 ? corner : -corner), cornerInfo.y + (cornerInfo.dy > 0 ? 0 : -corner));
      this.graficoSeleccionEdificio.moveTo(cornerInfo.x + (cornerInfo.dx > 0 ? 0 : -corner), cornerInfo.y + (cornerInfo.dy > 0 ? 0 : -corner));
      this.graficoSeleccionEdificio.lineTo(cornerInfo.x + (cornerInfo.dx > 0 ? 0 : -corner), cornerInfo.y + (cornerInfo.dy > 0 ? corner : -corner));
      this.graficoSeleccionEdificio.strokePath();
    }
  }

  private actualizarMarcadorRendezvous(): void {
    const edificio = this.sim.edificios.find((e) => e.id === this.seleccionadaEdificio);
    if (!edificio || edificio.puntoRendezvousX === undefined || edificio.puntoRendezvousY === undefined) {
      this.marcadorRendezvous.setVisible(false);
      return;
    }
    this.marcadorRendezvous
      .setPosition(edificio.puntoRendezvousX * TAM, edificio.puntoRendezvousY * TAM)
      .setFillStyle(this.alternarColorRendezvous ? 0x70c7ff : 0x59d5c5, 0.18)
      .setStrokeStyle(2, this.alternarColorRendezvous ? 0x70c7ff : 0x59d5c5, 0.75)
      .setVisible(true);
  }

  // Texto del panel: unidad seleccionada > edificio seleccionado > edificio de la celda > celda
  private bonusRegenAura(u: Unidad): number {
    return this.sim.unidades.filter((v) =>
      v.id !== u.id &&
      v.tipo === TipoUnidad.Pulgones &&
      v.hp > 0 &&
      v.jugador === u.jugador &&
      Math.max(Math.abs(v.x - u.x), Math.abs(v.y - u.y)) <= 1
    ).length * 1.0;
  }

  // La lista de producción va SIEMPRE a la izquierda de la columna de botones de unidades.
  // Se calcula a partir de los límites reales de esa columna, así nunca se solapan.
  private geometriaColaProduccion(): { left: number; ancho: number } {
    const columnaAccionIzq = this.posicionBotonAccionHUD(0).x - ACCION_BTN_W / 2;
    const derecha = columnaAccionIzq - COLA_GAP_A_ACCIONES;
    const limiteIzq = Math.max(120, this.scale.width / 2 + 120); // no invadir el panel de info central
    const ancho = Math.max(COLA_BTN_W_MIN, Math.min(COLA_BTN_W, derecha - limiteIzq));
    return { left: derecha - ancho, ancho };
  }

  private limpiarColaProduccionHUD(): void {
    this.ocultarTooltipBoton();
    for (const fila of this.filasColaProduccion) {
      this.tweens.killTweensOf([fila.bg, fila.progreso, fila.texto, fila.cruz]);
      fila.bg.destroy();
      fila.progreso.destroy();
      fila.texto.destroy();
      fila.cruz.destroy();
    }
    this.filasColaProduccion = [];
    this.botonesColaProduccion = [];
    this.claveColaProduccion = "";
  }

  private actualizarColaProduccionHUD(): void {
    const edificio = this.sim.edificios.find((e) => e.id === this.seleccionadaEdificio);
    if (!edificio || edificio.cola.length === 0) {
      if (this.filasColaProduccion.length > 0) this.limpiarColaProduccionHUD();
      this.textoColaProduccion.setText("").setVisible(false);
      return;
    }

    const { left, ancho } = this.geometriaColaProduccion();
    this.anchoColaActual = ancho;
    const top = this.scale.height - ALTO_HUD_INFERIOR + 12;
    this.textoColaProduccion
      .setPosition(left, top)
      .setWordWrapWidth(ancho)
      .setText("Producción:")
      .setVisible(true);

    // Máx. 8 ítems en cola: se muestran todos para poder cancelar cualquiera.
    const colaVisible = edificio.cola.slice(0, 8);
    const clave = `${edificio.id}|${left}|${ancho}|${top}|` + colaVisible.map((it) => `${it.id ?? "x"}:${it.esUnidad ? "u" : "e"}${it.tipo}`).join(",");

    // La lista solo se reconstruye si cambia la cola. Antes se destruía en cada frame,
    // lo que impedía cualquier animación hover. Mientras no cambie, solo se refrescan
    // el tiempo restante y la barra de progreso.
    if (clave !== this.claveColaProduccion) {
      this.limpiarColaProduccionHUD();
      this.claveColaProduccion = clave;
      for (let i = 0; i < colaVisible.length; i++) {
        this.crearFilaColaProduccion(edificio.id, colaVisible[i], left, top + 26 + i * COLA_BTN_PASO);
      }
    }

    for (let i = 0; i < this.filasColaProduccion.length; i++) {
      const item = colaVisible[i];
      const fila = this.filasColaProduccion[i];
      if (!item) continue;
      const seg = Math.max(0, Math.ceil(item.ticksRestantes / TICKS_POR_SEGUNDO));
      fila.texto.setText(`${fila.nombre}  ${seg}s`);
      const prog = i === 0 ? Math.max(0, Math.min(1, 1 - item.ticksRestantes / item.ticksTotales)) : 0;
      fila.progreso.setSize(Math.max(0, (this.anchoColaActual - 2) * prog), COLA_BTN_H - 2).setVisible(prog > 0);
    }
  }

  private crearFilaColaProduccion(
    edificioId: number,
    item: Edificio["cola"][number],
    left: number,
    yCentro: number
  ): void {
    const nombre = item.esUnidad
      ? DATOS_UNIDAD[item.tipo]?.nombre ?? `Tipo ${item.tipo}`
      : DATOS_EDIFICIO[item.tipo]?.nombre ?? `Edificio ${item.tipo}`;
    const ancho = this.anchoColaActual;
    const x = left + ancho / 2;

    const bg = this.add
      .rectangle(x, yCentro, ancho, COLA_BTN_H, 0x1a2733, 0.85)
      .setDepth(12)
      .setStrokeStyle(1, 0x4f6b91, 1)
      .setInteractive({ useHandCursor: true });
    const progreso = this.add
      .rectangle(left + 1, yCentro - (COLA_BTN_H - 2) / 2, 0, COLA_BTN_H - 2, 0x4aa8ff, 0.35)
      .setOrigin(0, 0)
      .setDepth(12.5)
      .setVisible(false);
    const texto = this.add
      .text(x, yCentro, nombre, {
        color: "#dfe8ff",
        fontSize: "11px",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 1,
        resolution: 2,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(13);
    const cruz = this.add
      .text(left + ancho - 10, yCentro, "✕", {
        color: "#ff5555",
        fontSize: "11px",
        fontStyle: "bold",
        resolution: 2,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(13)
      .setAlpha(0);

    // Animación hover: el botón crece un poco, se tiñe de rojo (indica "cancelar"),
    // el texto se desplaza ligeramente y aparece la ✕.
    const hover = (activo: boolean, animar = true): void => {
      this.tweens.killTweensOf([bg, texto, cruz]);
      const duracion = animar ? 130 : 0;
      bg.setFillStyle(activo ? 0x4a2430 : 0x1a2733, activo ? 1 : 0.85);
      bg.setStrokeStyle(1, activo ? 0xff6b6b : 0x4f6b91, 1);
      texto.setColor(activo ? "#ffd0d0" : "#dfe8ff");
      this.tweens.add({
        targets: bg,
        scaleX: activo ? 1.03 : 1,
        scaleY: activo ? 1.22 : 1,
        duration: duracion,
        ease: "Quad.easeOut",
      });
      this.tweens.add({
        targets: texto,
        x: activo ? x - 8 : x,
        scaleX: activo ? 1.05 : 1,
        scaleY: activo ? 1.05 : 1,
        duration: duracion,
        ease: "Quad.easeOut",
      });
      this.tweens.add({ targets: cruz, alpha: activo ? 1 : 0, duration: duracion, ease: "Quad.easeOut" });
    };

    bg.on("pointerover", () => hover(true));
    bg.on("pointerout", () => {
      hover(false);
      this.ocultarTooltipBoton();
    });
    bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.preventDefault();
      pointer.event.stopPropagation?.();
      this.clicConsumidoPorHUD = true;
      this.pointerDownEnHUD = true;
      // Pequeño "pulso" al pulsar
      this.tweens.add({ targets: [bg, texto], scaleX: 0.96, scaleY: 0.9, duration: 70, yoyo: true, ease: "Quad.easeOut" });
      // Se cancela por id de ítem (no por posición) y la simulación devuelve los recursos.
      this.sim.enviarOrden({
        tipo: "cancelarProduccion",
        edificioId,
        indice: this.filasColaProduccion.findIndex((f) => f.bg === bg),
        itemId: item.id,
        jugador: this.jugadorLocal,
      });
    });

    this.registrarTooltipBoton(bg, `Cancel production: remove ${nombre} from the queue.`);
    this.filasColaProduccion.push({ bg, progreso, texto, cruz, nombre, itemId: item.id });
    this.botonesColaProduccion.push(bg);
    this.cameras.main.ignore([bg, progreso, texto, cruz]);

    // Tras reconstruir la lista, si el puntero ya está encima de este botón, se muestra
    // en estado hover sin esperar a que el ratón se mueva.
    const p = this.input.activePointer;
    if (Math.abs(p.x - x) <= ancho / 2 && Math.abs(p.y - yCentro) <= COLA_BTN_H / 2) hover(true, false);
  }

  private textoPanel(): string | null {
    // 1. Unidades seleccionadas (se descartan las que ya no existen)
    // PERF: liveUnitIds makes the selection cleanup O(1) per id instead of O(n²).
    for (const id of [...this.seleccionadas]) {
      if (!this.liveUnitIds.has(id)) this.seleccionadas.delete(id);
    }
    if (this.seleccionadas.size === 1) {
      const id = [...this.seleccionadas][0];
      const u = this.unitById.get(id);
      if (u) {
        // El Pulgón no ataca: no tiene botón Attack.
        const botones: string[] = u.tipo === TipoUnidad.Pulgones ? [] : ["Attack"];
        if (u.tipo === TipoUnidad.Obrera && !this.menuConstruccionAbierto) {
          botones.push("Build");
          botones.push("Tame");
        }
        if (u.tipo === TipoUnidad.Pulgones) botones.push("Cure Disease");
        if (u.tipo === TipoUnidad.Obrera) botones.push("Repair Building");
        if (u.tipo === TipoUnidad.Guerrera) {
          botones.push(u.cadaverCargado !== null ? "Leave Corpse" : "Carry Corpse");
        }
        this.crearBotonesAccion(botones);
        const datos = DATOS_UNIDAD[u.tipo];
        const velocidadAtaque = (datos?.atk ?? 0) > 0
          ? `  |  Attack speed: ${ATAQUES_POR_SEGUNDO.toFixed(1)}/s`
          : "";
        const capacidadCarga = u.tipo === TipoUnidad.Guerrera ? 1 : (datos?.capacidadCarga ?? 0);
        let cargaTexto = "Carga: 0/0";
        if (u.tipo === TipoUnidad.Guerrera) {
          const valor = u.cadaverCargado !== null ? 1 : 0;
          const color = u.cadaverCargado !== null ? "#f7d34b" : "#9aa0a6";
          cargaTexto = `Carga: <span style="color:${color}">${valor}</span>/${capacidadCarga}`;
        } else {
          const carga =
            [
              u.cargaAgua > 0 ? "Agua" : "",
              u.cargaArcilla > 0 ? "Arcilla" : "",
              u.cargaNectar > 0 ? "Néctar" : "",
            ]
              .filter((t) => t !== "")
              .join(" + ") || "Nada";
          cargaTexto = `Carga: ${carga}/${capacidadCarga}`;
        }
        const baseRegen = datos?.regeneracion ?? 0;
        return (
          `${datos?.nombre ?? "Unidad"}  |  Jugador ${u.jugador}\n` +
          `Función: ${datos?.descripcion ?? "Unidad del ejército."}\n` +
          `HP: ${u.hp}/${datos?.hp ?? u.hp}  |  ATK: ${datos?.atk ?? 0}${velocidadAtaque}  |  DEF: ${datos?.def ?? 0}  |  Regen: ${baseRegen.toFixed(1)} HP/s\n` +
          `${cargaTexto}  |  Estado: ${NOMBRES_ESTADO[u.estado]}\n` +
          `Celda: (${u.x}, ${u.y})`
        );
      }
    } else if (this.seleccionadas.size > 1) {
      const sel = this.sim.unidades.filter((v) => this.seleccionadas.has(v.id));
      const tienePulgones = sel.some((v) => v.tipo === TipoUnidad.Pulgones);
      const tieneTrabajadores = sel.some((v) => v.tipo === TipoUnidad.Obrera);
      const guerreras = this.guerrerasSeleccionadas();
      const tieneGuerreras = guerreras.length > 0;
      const esSoloPulgones = sel.length > 0 && sel.every((v) => v.tipo === TipoUnidad.Pulgones);
      const botones: string[] = esSoloPulgones ? [] : ["Attack"];
      if (tieneTrabajadores && !this.menuConstruccionAbierto) {
        botones.push("Build");
        botones.push("Tame");
      }
      if (tienePulgones) botones.push("Cure Disease");
      if (tieneTrabajadores) botones.push("Repair Building");
      if (tieneGuerreras) {
        botones.push(guerreras.some((v) => v.cadaverCargado !== null) ? "Leave Corpse" : "Carry Corpse");
      }
      this.crearBotonesAccion(botones);
      const libres = sel.filter((v) => v.estado === 0).length;
      const conCarga = sel.filter((v) => v.cargaAgua > 0 || v.cargaArcilla > 0).length;
      return (
        `${sel.length} unidades seleccionadas\n` +
        `Libres: ${libres}  |  Con carga: ${conCarga}\n` +
        `Clic derecho: dar la misma orden a todas`
      );
    }

    const unidadInspeccionada = this.unitById.get(this.unidadInspeccionadaEnemiga ?? -1);
    if (unidadInspeccionada) {
      this.limpiarBotonesAccion();
      const datos = DATOS_UNIDAD[unidadInspeccionada.tipo];
      const propietario = unidadInspeccionada.jugador < 0
        ? "Neutral Gaia"
        : `Enemy player ${unidadInspeccionada.jugador}`;
      const velocidadAtaque = (datos?.atk ?? 0) > 0
        ? `  |  Attack speed: ${ATAQUES_POR_SEGUNDO.toFixed(1)}/s`
        : "";
      return (
        `${datos?.nombre ?? "Unit"}  |  ${propietario}\n` +
        `Función: ${datos?.descripcion ?? "Unidad enemiga."}\n` +
        `HP: ${unidadInspeccionada.hp}/${datos?.hp ?? unidadInspeccionada.hp}  |  ATK: ${datos?.atk ?? 0}${velocidadAtaque}  |  DEF: ${datos?.def ?? 0}\n` +
        `Cell: (${unidadInspeccionada.x}, ${unidadInspeccionada.y})`
      );
    }

    const cadaverInspeccionado = this.corpseById.get(this.cadaverInspeccionadoId ?? -1);
    if (cadaverInspeccionado) {
      this.limpiarBotonesAccion();
      return (
        `Corpse  |  Level ${cadaverInspeccionado.nivel}\n` +
        `Remaining: ${cadaverInspeccionado.ticksRestantes} ticks (${Math.ceil(cadaverInspeccionado.ticksRestantes / TICKS_POR_SEGUNDO)}s)\n` +
        `Cell: (${cadaverInspeccionado.x}, ${cadaverInspeccionado.y})`
      );
    }

    // 2. Edificio seleccionado
    const edSel = this.seleccionadaEdificio !== null ? this.buildingById.get(this.seleccionadaEdificio) : undefined;
    if (edSel) {
      const datosEdificio = DATOS_EDIFICIO[edSel.tipo];
      const ataqueEdificio = (datosEdificio?.atk ?? 0) > 0
        ? `  |  ATK: ${datosEdificio.atk}  |  Attack speed: ${ATAQUES_POR_SEGUNDO.toFixed(1)}/s`
        : "";
      const botones: string[] = [];
      if (edSel.enConstruccion) botones.push("Delete building");
      if ((DATOS_EDIFICIO[edSel.tipo]?.atk ?? 0) > 0 && !edSel.enConstruccion) {
        botones.push("Attack");
      }
      if (edSel.tipo === TipoEdificio.Reina) {
        botones.push(
          ...[
            { label: "Ant Worker", costes: { agua: DATOS_UNIDAD[TipoUnidad.Obrera].costeAgua, arcilla: 0, nectar: DATOS_UNIDAD[TipoUnidad.Obrera].costeNectar } },
            { label: "Guerrera", costes: { agua: DATOS_UNIDAD[TipoUnidad.Guerrera].costeAgua, arcilla: 0, nectar: DATOS_UNIDAD[TipoUnidad.Guerrera].costeNectar } },
            { label: "Voladora", costes: { agua: DATOS_UNIDAD[TipoUnidad.Voladora].costeAgua, arcilla: 0, nectar: DATOS_UNIDAD[TipoUnidad.Voladora].costeNectar } },
            { label: "G. Voladora", costes: { agua: DATOS_UNIDAD[TipoUnidad.GuerreraVoladora].costeAgua, arcilla: 0, nectar: DATOS_UNIDAD[TipoUnidad.GuerreraVoladora].costeNectar } },
          ].map((item) => item.label)
        );
      }
      this.crearBotonesAccion(botones.map((label) => label === "Ant Worker" ? { label, costes: { agua: DATOS_UNIDAD[TipoUnidad.Obrera].costeAgua, arcilla: 0, nectar: DATOS_UNIDAD[TipoUnidad.Obrera].costeNectar } } : label === "Guerrera" ? { label, costes: { agua: DATOS_UNIDAD[TipoUnidad.Guerrera].costeAgua, arcilla: 0, nectar: DATOS_UNIDAD[TipoUnidad.Guerrera].costeNectar } } : label === "Voladora" ? { label, costes: { agua: DATOS_UNIDAD[TipoUnidad.Voladora].costeAgua, arcilla: 0, nectar: DATOS_UNIDAD[TipoUnidad.Voladora].costeNectar } } : label === "G. Voladora" ? { label, costes: { agua: DATOS_UNIDAD[TipoUnidad.GuerreraVoladora].costeAgua, arcilla: 0, nectar: DATOS_UNIDAD[TipoUnidad.GuerreraVoladora].costeNectar } } : label));
      this.rectSeleccionCelda.setVisible(false);
      return (
        `${DATOS_EDIFICIO[edSel.tipo]?.nombre ?? `E${edSel.tipo}`}  |  Jugador ${edSel.jugador}\n` +
        `Función: ${datosEdificio?.descripcion ?? "Edificio de la colonia."}\n` +
        `HP: ${edSel.hp}${ataqueEdificio}  |  Tamaño: ${edSel.ancho}x${edSel.alto}  |  Depósito: ${edSel.esDeposito ? "Sí" : "No"}\n` +
        `Esquina: (${edSel.x}, ${edSel.y})`
      );
    } else {
      this.limpiarBotonesAccion();
    }

    if (!this.celdaInfo) return null;
    const { x, y } = this.celdaInfo;
    const mapa = this.sim.mapa;

    // 3. Edificio en la celda
    const edCelda = [...this.buildingById.values()].find(
      (b) => x >= b.x && x < b.x + b.ancho && y >= b.y && y < b.y + b.alto
    );
    if (edCelda) {
      const datosEdificio = DATOS_EDIFICIO[edCelda.tipo];
      const ataqueEdificio = (datosEdificio?.atk ?? 0) > 0
        ? `  |  ATK: ${datosEdificio.atk}  |  Attack speed: ${ATAQUES_POR_SEGUNDO.toFixed(1)}/s`
        : "";
      return (
        `${DATOS_EDIFICIO[edCelda.tipo]?.nombre ?? `E${edCelda.tipo}`}  |  Jugador ${edCelda.jugador}\n` +
        `Función: ${datosEdificio?.descripcion ?? "Edificio de la colonia."}\n` +
        `HP: ${edCelda.hp}${ataqueEdificio}  |  Tamaño: ${edCelda.ancho}x${edCelda.alto}  |  Depósito: ${edCelda.esDeposito ? "Sí" : "No"}\n` +
        `Esquina: (${edCelda.x}, ${edCelda.y})`
      );
    }

    // 4. Celda vacía
    const r = mapa.getRecurso(x, y);
    const recurso =
      r === Recurso.Ninguno
        ? "Ninguno"
        : `${NOMBRES_RECURSO[r]} (${mapa.getCantidad(x, y)})`;
    return (
      `Celda (${x}, ${y})\n` +
      `Terreno: ${NOMBRES_TERRENO[mapa.getTerreno(x, y)]}  |  Altura: ${mapa.getAltura(x, y)}  |  Rampa: ${mapa.esRampa(x, y) ? "Sí" : "No"}\n` +
      `Recurso: ${recurso}`
    );
  }

  private puntoObjetivo(objetivo: ObjetivoCombate): {
    objeto: Phaser.GameObjects.Shape | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
    x: number;
    y: number;
  } | null {
    if (objetivo.tipo === "unidad") {
      const objeto = this.circulos.get(objetivo.id);
      return objeto ? { objeto, x: objeto.x, y: objeto.y } : null;
    }
    const edificio = this.buildingById.get(objetivo.id);
    const objeto = this.edificiosVisuales.get(objetivo.id);
    return edificio && objeto
      ? {
          objeto,
          x: (edificio.x + edificio.ancho / 2) * TAM,
          y: (edificio.y + edificio.alto / 2) * TAM,
        }
      : null;
  }

  private progresoAnimacion(ahora: number, inicio: number, duracion: number): number {
    const t = Math.max(0, Math.min(1, (ahora - inicio) / duracion));
    return 1 - (1 - t) ** 2;
  }

  private mostrarCantidadFlotante(
    x: number,
    y: number,
    texto: string,
    color: string,
    duration = 500
  ): Phaser.GameObjects.Text {
    const asignado = this.obtenerTextoFlotante();
    const etiqueta = asignado ? asignado.texto : this.add
      .text(x, y, texto, { color, fontSize: "8px", fontStyle: "bold", stroke: "#111118", strokeThickness: 2, resolution: 2 })
      .setOrigin(0.5)
      .setDepth(20);
    const token = asignado?.token;
    this.camUI.ignore(etiqueta);
    etiqueta
      .setText(texto)
      .setPosition(x, y)
      .setColor(color)
      .setVisible(true)
      .setAlpha(1);
    this.tweens.add({
      targets: etiqueta,
      y: y - 9,
      duration,
      ease: "Quad.easeOut",
    });
    const fadeDelay = duration > 500 ? duration / 2 : 0;
    const fadeDuration = duration > 500 ? duration / 2 : duration;
    if (fadeDelay > 0) {
      this.time.delayedCall(fadeDelay, () => {
        this.tweens.add({
          targets: etiqueta,
          alpha: 0,
          duration: fadeDuration,
          ease: "Quad.easeOut",
          onComplete: () => {
            this.releaseTextoFlotante(etiqueta, token);
          },
        });
      });
    } else {
      this.tweens.add({
        targets: etiqueta,
        alpha: 0,
        duration: fadeDuration,
        ease: "Quad.easeOut",
        onComplete: () => {
          this.releaseTextoFlotante(etiqueta, token);
        },
      });
    }
    return etiqueta;
  }

  private animarAtaque(ev: EventoAtaque): void {
    const atacante = this.circulos.get(ev.atacanteId);
    const objetivo = this.puntoObjetivo(ev.objetivo);
    if (!atacante || !objetivo) return;

    const a = Math.atan2(objetivo.y - atacante.y, objetivo.x - atacante.x);
    this.angulosDeseados.set(ev.atacanteId, a);
    this.giroForzadoHasta.set(ev.atacanteId, this.time.now + 400);

    const tweenAnterior = this.ataquesTweenPorUnidad.get(ev.atacanteId);
    if (tweenAnterior) {
      tweenAnterior.stop();
      this.ataquesTweenPorUnidad.delete(ev.atacanteId);
    }

    const tweenAtaque = this.tweens.add({
      targets: atacante,
      scaleX: 1.35,
      scaleY: 1.35,
      duration: 90,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (this.ataquesTweenPorUnidad.get(ev.atacanteId) === tweenAtaque) {
          this.ataquesTweenPorUnidad.delete(ev.atacanteId);
        }
      },
    });
    this.ataquesTweenPorUnidad.set(ev.atacanteId, tweenAtaque);

    // PERF: keep attack traces in a single shared graphics layer instead of a fresh Graphics per hit.
    this.ataquesActivos.push({
      x1: atacante.x,
      y1: atacante.y,
      x2: objetivo.x,
      y2: objetivo.y,
      hasta: this.time.now + 180,
    });

    this.animarDanoColor(objetivo.objeto);
    this.mostrarCantidadFlotante(objetivo.x, objetivo.y - 8, `-${ev.dano.toFixed(1)}`, "#ff6969");
  }

  private animarDanoColor(objeto: Phaser.GameObjects.Shape | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image): void {
    this.animarColorFlash(objeto, 0xff5a5a, 120);
  }

  private animarColorFlash(
    objeto: Phaser.GameObjects.Shape | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image,
    color: number,
    duracion: number
  ): void {
    const animacionActual = this.coloresOriginalesFlash.get(objeto);
    if (animacionActual) this.time.removeEvent(animacionActual.temporizador);
    if (objeto instanceof Phaser.GameObjects.Image) {
      objeto.setTintFill(color);
      const temporizador = this.time.delayedCall(duracion, () => {
        if (objeto.active) objeto.clearTint();
        this.coloresOriginalesFlash.delete(objeto);
      });
      this.coloresOriginalesFlash.set(objeto, { color, temporizador });
      return;
    }
    const colorOriginal = animacionActual?.color ?? objeto.fillColor;
    objeto.setFillStyle(color);
    const temporizador = this.time.delayedCall(duracion, () => {
      if (objeto.active) objeto.setFillStyle(colorOriginal);
      this.coloresOriginalesFlash.delete(objeto);
    });
    this.coloresOriginalesFlash.set(objeto, { color: colorOriginal, temporizador });
  }

  private animarPodredumbre(ev: EventoPodredumbre): void {
    const objetivo = this.circulos.get(ev.unidadId);
    if (!objetivo) return;
    this.animarDanoColor(objetivo);
    this.mostrarCantidadFlotante(objetivo.x, objetivo.y - 8, `-${ev.dano}`, "#b879d6");
  }

  private animarCuracion(ev: EventoCuracion): void {
    if (ev.origenId === undefined) return;
    const objeto = this.circulos.get(ev.unidadId);
    const origen = this.circulos.get(ev.origenId);
    if (!objeto) return;
    if (origen) {
      const a = Math.atan2(objeto.y - origen.y, objeto.x - origen.x);
      this.angulosDeseados.set(ev.origenId, a);
      this.giroForzadoHasta.set(ev.origenId, this.time.now + 400);
    }
    this.animarPulgonCurando(ev.origenId);
    const offsetBase = this.desplazamientoTextoCuracion.get(ev.unidadId) ?? -3;
    const offset = offsetBase === -3 ? 3 : -3;
    this.desplazamientoTextoCuracion.set(ev.unidadId, offset);
    this.mostrarCantidadFlotante(
      objeto.x + offset,
      objeto.y - 8,
      `+${ev.cantidad.toFixed(1)}`,
      "#65f28c",
      1000
    );
  }

  private animarPulgonCurando(pulgonId: number): void {
    const pulgon = this.circulos.get(pulgonId);
    if (!pulgon) return;
    this.detenerAnimacionPulgon(pulgonId);
    const halo = this.add
      .circle(pulgon.x, pulgon.y, 9, 0x65f28c, 0)
      .setStrokeStyle(1.5, 0x65f28c, 0.95)
      .setDepth(19);
    this.camUI.ignore(halo);
    this.animacionesPulgonesCurando.set(pulgonId, { halo });
    this.tweens.add({
      targets: halo,
      scaleX: 1.45,
      scaleY: 1.45,
      alpha: 0,
      duration: 300,
      ease: "Quad.easeOut",
      onComplete: () => this.detenerAnimacionPulgon(pulgonId),
    });
  }

  private detenerAnimacionPulgonRecolectandoFlor(unidadId: number): void {
    const animacion = this.animacionesPulgonesRecolectandoFlor.get(unidadId);
    if (!animacion) return;
    this.tweens.killTweensOf(animacion.shape);
    animacion.shape.setScale(1, 1);
    this.animacionesPulgonesRecolectandoFlor.delete(unidadId);
  }

  private animarFlorCosechada(x: number, y: number): void {
    const key = `${x},${y}`;
    if (this.animacionesFlorCosechada.has(key)) return;

    const efecto = this.add
      .circle(x * TAM + TAM / 2, y * TAM + TAM / 2, 8, 0xd1aa2a, 0.9)
      .setDepth(8);
    this.camUI.ignore(efecto);
    this.animacionesFlorCosechada.set(key, efecto);

    this.tweens.add({
      targets: efecto,
      alpha: 0,
      scaleX: 1.35,
      scaleY: 1.35,
      duration: 140,
      ease: "Quad.easeOut",
      onComplete: () => {
        efecto.destroy();
        this.animacionesFlorCosechada.delete(key);
      },
    });
  }

  private actualizarAnimacionRecolectandoFlor(unidad: Unidad): void {
    const shape = this.circulos.get(unidad.id);
    if (!shape) return;

    const recolectaFlorPulgon =
      unidad.tipo === TipoUnidad.Pulgones &&
      unidad.estado === Estado.Recogiendo &&
      this.sim.mapa.getRecurso(unidad.recursoX, unidad.recursoY) === Recurso.Flor;

    if (recolectaFlorPulgon) {
      this.animarFlorCosechada(unidad.recursoX, unidad.recursoY);
    }

    const recolectaNectarTrabajador =
      unidad.tipo === TipoUnidad.Obrera &&
      unidad.estado === Estado.RecogiendoNectar &&
      unidad.objetivoNectarId !== null;

    const debeAnimar = recolectaFlorPulgon || recolectaNectarTrabajador;

    if (!debeAnimar) {
      this.detenerAnimacionPulgonRecolectandoFlor(unidad.id);
      return;
    }

    let animacion = this.animacionesPulgonesRecolectandoFlor.get(unidad.id);
    if (!animacion) {
      animacion = { shape };
      this.animacionesPulgonesRecolectandoFlor.set(unidad.id, animacion);
      this.tweens.add({
        targets: shape,
        scaleX: 0.82,
        scaleY: 1.18,
        duration: 80,
        yoyo: true,
        repeat: -1,
        ease: "Quad.easeInOut",
      });
      this.tweens.add({
        targets: shape,
        scaleY: 0.82,
        scaleX: 1.18,
        duration: 80,
        yoyo: true,
        repeat: -1,
        ease: "Quad.easeInOut",
        delay: 40,
      });
    }
  }

  private mostrarErrorSimulacion(ev: EventoError): void {
    this.mostrarMensajeError(ev.mensaje);
  }

  private animarEnfermedadCurada(ev: EventoEnfermedadCurada): void {
    const unidad = this.circulos.get(ev.unidadId);
    if (unidad) this.mostrarCantidadFlotante(unidad.x, unidad.y - 8, "CURED", "#65f28c");
  }

  private actualizarIndicadorEnfermedad(): void {
    const texto = this.sim.unidades.some(
      (unidad) => this.seleccionadas.has(unidad.id) && unidad.enfermedadViral
    )
      ? "VIRAL DISEASE"
      : "";
    if (texto !== this.ultimoTextoEnfermedadHUD) {
      this.textoEnfermedadHUD.setText(texto);
      this.ultimoTextoEnfermedadHUD = texto;
    }
    this.textoEnfermedadHUD.setVisible(texto !== "");
  }

  private actualizarIndicadorRegen(): void {
    const texto = this.seleccionadas.size === 1
      ? (() => {
          const id = [...this.seleccionadas][0];
          const u = this.unitById.get(id);
          if (!u) return "";
          const bonus = this.bonusRegenAura(u);
          return bonus > 0 ? `AURA +${bonus.toFixed(1)} HP/s` : "";
        })()
      : "";
    if (texto !== this.ultimoTextoRegenHUD) {
      this.textoRegenHUD.setText(texto);
      this.ultimoTextoRegenHUD = texto;
    }
    this.textoRegenHUD.setVisible(texto !== "");
  }

  private animarConstruccion(ev: { tipo: "construccion"; edificioId: number; cantidad: number }): void {
    const edificio = this.buildingById.get(ev.edificioId);
    if (!edificio) return;
    const x = (edificio.x + edificio.ancho / 2) * TAM;
    const y = (edificio.y + edificio.alto / 2) * TAM - 8;
    this.mostrarCantidadFlotante(x, y, `+${ev.cantidad}`, "#dfe8ff", 700);
  }

  private procesarEventosSimulacion(): void {
    for (const ev of this.sim.eventos) {
      if (ev.tipo === "entrega") this.mostrarEntrega(ev);
      else if (ev.tipo === "notificacion") this.mostrarNotificacion(ev.mensaje);
      else if (ev.tipo === "ataque") this.animarAtaque(ev);
      else if (ev.tipo === "curacion") this.animarCuracion(ev);
      else if (ev.tipo === "construccion") this.animarConstruccion(ev);
      else if (ev.tipo === "error") this.mostrarErrorSimulacion(ev);
      else if (ev.tipo === "podredumbre") this.animarPodredumbre(ev);
      else if (ev.tipo === "enfermedadCurada") this.animarEnfermedadCurada(ev);
    }
    this.sim.eventos.length = 0;
  }

  private actualizarFlores(): void {
    const mapa = this.sim.mapa;
    for (const indice of mapa.celdasRecursoModificadas) {
      const x = indice % mapa.ancho;
      const y = Math.floor(indice / mapa.ancho);
      const bob = this.floresBobs.get(indice);
      const recurso = mapa.getRecurso(x, y);

      if (recurso !== Recurso.Flor) {
        if (bob) {
          bob.visible = false;
        }
        continue;
      }

      const cantidad = mapa.getCantidad(x, y);
      if (cantidad <= 0) {
        if (bob) bob.visible = false;
        continue;
      }

      const inicial = this.floresCantidadInicial[indice] || cantidad;
      const fraccion = Math.min(1, Math.max(0, cantidad / inicial));
      let petals = Math.round(fraccion * 8);
      if (cantidad > 0 && petals === 0) petals = 0;
      if (bob) {
        bob.setFrame(petals);
        bob.setVisible(true);
      }
    }
    mapa.celdasRecursoModificadas.clear();
  }

  private actualizarCeldasAgotadas(): void {
    const mapa = this.sim.mapa;
    if (!this.graficoCeldasAgotadas) return;

    let huboCambio = false;
    for (const indice of this.celdasConRecurso) {
      const x = indice % mapa.ancho;
      const y = Math.floor(indice / mapa.ancho);
      if (mapa.getRecurso(x, y) !== Recurso.Ninguno) continue;

      this.pintarCeldaTerreno(this.graficoCeldasAgotadas, x, y, x, y);
      this.celdasConRecurso.delete(indice);
      huboCambio = true;
    }
    if (huboCambio) {
      this.minimapaTerrenoSucio = true;
    }
    this.actualizarFlores();
  }

  update(_tiempo: number, delta: number): void {
    if (DEBUG) {
      if (Phaser.Input.Keyboard.JustDown(this.teclaF3)) {
        this.debugVisible = !this.debugVisible;
        this.debugText?.setVisible(this.debugVisible);
        if (this.debugVisible) this.actualizarOverlayDebug();
      }
      this.debugFrameDeltas.push(delta);
      if (this.debugFrameDeltas.length > 60) this.debugFrameDeltas.shift();
    }

    if (Phaser.Input.Keyboard.JustDown(this.teclaAtaque)) {
      this.modoAtaque = !this.modoAtaque && this.hayUnidadSeleccionadaQuePuedeAtacar();
      this.modoCuracion = false;
      this.actualizarCursorModoSeleccion();
      this.actualizarBotonesModo();
    }
    if (Phaser.Input.Keyboard.JustDown(this.teclaEscape)) {
      if (this.modoConstruccion !== null) {
        this.modoConstruccion = null;
        this.menuConstruccionAbierto = false;
        this.limpiarBotonesConstruccion();
        this.actualizarBotonesModo();
        if (this.previewConstruccion) this.previewConstruccion.setVisible(false);
      } else if (this.menuConstruccionAbierto) {
        this.cerrarMenuConstruccion();
      }
    }
    if (this.modoConstruccion !== null) {
      this.menuConstruccionAbierto = true;
      this.actualizarPreviewConstruccion();
    }

    // Cámara
    const cam = this.cameras.main;
    const paso = (600 * delta) / 1000 / cam.zoom;
    if (this.teclas.left.isDown) cam.scrollX -= paso;
    if (this.teclas.right.isDown) cam.scrollX += paso;
    if (this.teclas.up.isDown) cam.scrollY -= paso;
    if (this.teclas.down.isDown) cam.scrollY += paso;

    // Simulación: acumula tiempo y avanza en ticks fijos
    this.acumulador += Math.min(delta, 250); // tope para no "espiralizar" tras una pausa
    let ticksProcesados = 0;
    while (ticksProcesados < 5 && this.acumulador >= MS_POR_TICK) {
      const simStart = performance.now();
      this.sim.tick();
      const simMsTick = performance.now() - simStart;
      this.debugTickMs.push(simMsTick);
      if (this.debugTickMs.length > 60) this.debugTickMs.shift();
      this.colasEdificiosDirty = this.colasEdificiosDirty || this.sim.edificios.some(
        (edificio) => edificio.cola.some((item) => item.ticksRestantes === 0)
      );
      if (this.temporizadorError > 0) this.temporizadorError--; // cuenta en ticks, no en frames
      this.acumulador -= MS_POR_TICK;
      ticksProcesados++;
    }
    if (this.acumulador >= MS_POR_TICK) {
      this.acumulador = 0;
    }
    if (ticksProcesados > 0) {
      this.rebuildLiveIndexes();
      this.procesarEventosSimulacion();
      this.actualizarCeldasAgotadas();
      this.sincronizarUnidadesVisibles();
    }
    if (DEBUG && this.time.now - this.debugLastOverlayMs >= 250) {
      this.debugLastOverlayMs = this.time.now;
      this.actualizarOverlayDebug();
    }
    this.dibujarEdificios(); // dibuja edificios nuevos (los ya dibujados se omiten)
    this.actualizarSeleccionEdificio(this.time.now);
    this.dibujarCadaveres();

    this.graficoAtaques.clear();
    const ahora = this.time.now;
    for (let i = this.ataquesActivos.length - 1; i >= 0; i--) {
      const ataque = this.ataquesActivos[i];
      if (ahora > ataque.hasta) {
        this.ataquesActivos.splice(i, 1);
        continue;
      }
      const alpha = Math.max(0, (ataque.hasta - ahora) / 180) * 0.95;
      this.graficoAtaques.lineStyle(1, 0xff3030, alpha);
      this.graficoAtaques.beginPath();
      this.graficoAtaques.moveTo(ataque.x1, ataque.y1);
      this.graficoAtaques.lineTo(ataque.x2, ataque.y2);
      const angulo = Math.atan2(ataque.y2 - ataque.y1, ataque.x2 - ataque.x1);
      const punta = 8;
      const anchoPunta = 3;
      const baseX = ataque.x2 - Math.cos(angulo) * punta;
      const baseY = ataque.y2 - Math.sin(angulo) * punta;
      this.graficoAtaques.moveTo(ataque.x2, ataque.y2);
      this.graficoAtaques.lineTo(
        baseX + Math.sin(angulo) * anchoPunta,
        baseY - Math.cos(angulo) * anchoPunta
      );
      this.graficoAtaques.lineTo(
        baseX - Math.sin(angulo) * anchoPunta,
        baseY + Math.cos(angulo) * anchoPunta
      );
      this.graficoAtaques.lineTo(ataque.x2, ataque.y2);
      this.graficoAtaques.strokePath();
    }

    // Dibujo: la base de cada unidad avanza a velocidad constante hacia su celda.
    // Se actualiza el movimiento visual de todas las unidades, pero las llamadas a
    // Phaser se omiten fuera del viewport ampliado para evitar trabajo innecesario.
    const view = cam.worldView;
    const vistaExpandida = {
      x: view.x - 64,
      y: view.y - 64,
      right: view.right + 64,
      bottom: view.bottom + 64,
    };
    for (const u of this.sim.unidades) {
      const c = this.circulos.get(u.id);
      const base = this.bases.get(u.id);
      if (!c || !base) continue;

      const objetivoX = u.x * TAM + TAM / 2;
      const objetivoY = u.y * TAM + TAM / 2;
      const dx = objetivoX - base.x;
      const dy = objetivoY - base.y;
      const dist = Math.hypot(dx, dy);
      // Si se rezaga demasiado (por ejemplo tras una pausa), acelera para alcanzarla
      const factor = Math.max(1, dist / (TAM * 1.5));
      const maxPaso = (VELOCIDAD_VISUAL * factor * delta) / 1000;
      if (dist <= maxPaso) {
        base.x = objetivoX;
        base.y = objetivoY;
      } else {
        base.x += (dx / dist) * maxPaso;
        base.y += (dy / dist) * maxPaso;
      }

      const fueraVista =
        base.x < vistaExpandida.x ||
        base.x > vistaExpandida.right ||
        base.y < vistaExpandida.y ||
        base.y > vistaExpandida.bottom;

      if (dist > 0.5 && this.time.now >= (this.giroForzadoHasta.get(u.id) ?? 0)) {
        this.angulosDeseados.set(u.id, Math.atan2(dy, dx));
      }

      const anguloActual = this.angulos.get(u.id) ?? Math.PI / 2;
      const anguloDeseado = this.angulosDeseados.get(u.id) ?? anguloActual;
      const nuevo = Phaser.Math.Angle.RotateTo(anguloActual, anguloDeseado, (14 * delta) / 1000);
      this.angulos.set(u.id, nuevo);

      let objetivoAccionX: number | null = null;
      let objetivoAccionY: number | null = null;
      if (dist <= 0.5) {
        if (u.estado === Estado.Atacando && u.objetivoCombate) {
          const objetivo = this.unitById.get(u.objetivoCombate.id) ?? this.buildingById.get(u.objetivoCombate.id);
          if (objetivo) {
            const objetivoCentroX = objetivo.x * TAM + ("ancho" in objetivo ? (objetivo.ancho * TAM) / 2 : TAM / 2);
            const objetivoCentroY = objetivo.y * TAM + ("alto" in objetivo ? (objetivo.alto * TAM) / 2 : TAM / 2);
            objetivoAccionX = objetivoCentroX;
            objetivoAccionY = objetivoCentroY;
          }
        } else if (u.estado === Estado.ReparandoEdificio && u.objetivoReparacionId !== null) {
          const edificio = this.buildingById.get(u.objetivoReparacionId);
          if (edificio) {
            objetivoAccionX = (edificio.x + edificio.ancho / 2) * TAM;
            objetivoAccionY = (edificio.y + edificio.alto / 2) * TAM;
          }
        } else if (u.estado === Estado.Construyendo && u.objetivoReparacionId !== null) {
          const edificio = this.buildingById.get(u.objetivoReparacionId);
          if (edificio) {
            objetivoAccionX = (edificio.x + edificio.ancho / 2) * TAM;
            objetivoAccionY = (edificio.y + edificio.alto / 2) * TAM;
          }
        } else if ((u.estado === Estado.IrADomesticar || u.estado === Estado.Domesticando) && u.objetivoDomesticacionId !== null) {
          const pulgon = this.unitById.get(u.objetivoDomesticacionId);
          if (pulgon) {
            objetivoAccionX = pulgon.x * TAM + TAM / 2;
            objetivoAccionY = pulgon.y * TAM + TAM / 2;
          }
        } else if (u.curandoUnidadId !== null) {
          const curado = this.unitById.get(u.curandoUnidadId);
          if (curado) {
            objetivoAccionX = curado.x * TAM + TAM / 2;
            objetivoAccionY = curado.y * TAM + TAM / 2;
          }
        }
      }
      if (objetivoAccionX !== null && objetivoAccionY !== null) {
        this.angulosDeseados.set(u.id, Math.atan2(objetivoAccionY - base.y, objetivoAccionX - base.x));
      }

      if (fueraVista) {
        const visibleAntes = this.unidadVisible.get(u.id) ?? true;
        if (visibleAntes !== false) {
          c.setVisible(false);
          this.unidadVisible.set(u.id, false);
        }
        continue;
      }

      const visibleAntes = this.unidadVisible.get(u.id) ?? true;
      if (visibleAntes !== true) {
        c.setVisible(true);
        this.unidadVisible.set(u.id, true);
      }

      c.setFillStyle(this.coloresJugador(u.jugador).unidad);
      this.actualizarAnimacionReparacion(u);
      this.actualizarAnimacionRecolectandoFlor(u);
      c.setPosition(base.x, base.y);

      if (u.tipo !== TipoUnidad.Obrera && u.tipo !== TipoUnidad.Pulgones) {
        c.setRotation(nuevo + Math.PI / 2);
      }

      // Borde: amarillo = seleccionada
      c.setStrokeStyle(
        2,
        this.seleccionadas.has(u.id) ? 0xffe14d : this.coloresJugador(u.jugador).borde
      );
    }

    this.graficoBarrasUnidades.clear();
    for (const u of this.sim.unidades) {
      const base = this.bases.get(u.id);
      if (!base) continue;
      const fueraVista =
        base.x < vistaExpandida.x ||
        base.x > vistaExpandida.right ||
        base.y < vistaExpandida.y ||
        base.y > vistaExpandida.bottom;
      if (fueraVista) continue;

      const radio = this.radioUnidad(u.tipo);
      const x = base.x - radio;
      const y = base.y - radio - 7;
      const ancho = radio * 2;
      const anguloVisual = this.angulos.get(u.id) ?? Math.PI / 2;
      const bordeColor = this.coloresJugador(u.jugador).borde;

      const maximo = DATOS_UNIDAD[u.tipo]?.hp ?? u.hp;
      const mostrarSalud = this.mostrarBarrasSalud;
      if (mostrarSalud) {
        const proporcion = Math.max(0, Math.min(1, u.hp / maximo));
        const colorBarra = u.enfermedadViral ? 0xff2d2d : 0x42d66b;
        this.graficoBarrasUnidades.fillStyle(0x111118, 0.9);
        this.graficoBarrasUnidades.fillRect(x, y, ancho, 5);
        this.graficoBarrasUnidades.lineStyle(1, 0x444444, 1);
        this.graficoBarrasUnidades.strokeRect(x, y, ancho, 5);
        this.graficoBarrasUnidades.fillStyle(colorBarra, 1);
        this.graficoBarrasUnidades.fillRect(x + 1, y + 1, Math.max(0, ancho - 2) * proporcion, 3);

        const cargado = u.cadaverCargado !== null;
        const animacion = this.animacionesCadaveres.get(u.id);
        if (animacion && (animacion.animTipo === "carga" || animacion.animTipo === "descarga")) {
          const start = animacion.animTipo === "carga" ? 0 : 1;
          const end = animacion.animTipo === "carga" ? 1 : 0;
          const progreso = this.progresoAnimacion(this.time.now, animacion.animInicio, 350);
          const valor = start + (end - start) * progreso;
          if (progreso >= 1) {
            animacion.animTipo = null;
          }
          const barWidth = Math.max(10, ancho * 0.55);
          const barX = x + (ancho - barWidth) / 2;
          const barY = y - 5;
          const alpha = animacion.animTipo === "descarga" ? Math.max(0, 1 - valor) : 1;
          this.graficoBarrasUnidades.fillStyle(0x3a2b00, 0.9 * alpha);
          this.graficoBarrasUnidades.fillRect(barX, barY, barWidth, 3);
          this.graficoBarrasUnidades.fillStyle(0xf7d34b, 1 * alpha);
          this.graficoBarrasUnidades.fillRect(barX + 1, barY + 1, Math.max(0, barWidth - 2) * valor, 1);
        } else if (cargado) {
          const barWidth = Math.max(10, ancho * 0.55);
          const barX = x + (ancho - barWidth) / 2;
          const barY = y - 5;
          this.graficoBarrasUnidades.fillStyle(0x3a2b00, 0.9);
          this.graficoBarrasUnidades.fillRect(barX, barY, barWidth, 3);
          this.graficoBarrasUnidades.fillStyle(0xf7d34b, 1);
          this.graficoBarrasUnidades.fillRect(barX + 1, barY + 1, Math.max(0, barWidth - 2), 1);
        }

        if (cargado !== (animacion?.cargado ?? cargado)) {
          const siguiente: { cargado: boolean; animInicio: number; animTipo: "carga" | "descarga" | null } = {
            cargado,
            animInicio: this.time.now,
            animTipo: cargado ? "carga" : "descarga",
          };
          this.animacionesCadaveres.set(u.id, siguiente);
        } else if (!animacion) {
          this.animacionesCadaveres.set(u.id, { cargado, animInicio: this.time.now, animTipo: null });
        }
      }

      if (u.tipo === TipoUnidad.Obrera || u.tipo === TipoUnidad.Guerrera || u.tipo === TipoUnidad.Pulgones) {
        const tamanoMarcador = u.tipo === TipoUnidad.Pulgones ? 2 : 3;
        const px = base.x + Math.cos(anguloVisual) * radio * 0.75;
        const py = base.y + Math.sin(anguloVisual) * radio * 0.75;
        const trianguloMarcador = this.verticesTrianguloRotado(px, py, tamanoMarcador * 2, tamanoMarcador * 2, anguloVisual + Math.PI / 2);
        this.graficoBarrasUnidades.fillStyle(bordeColor, 1);
        this.graficoBarrasUnidades.fillTriangle(
          trianguloMarcador[0], trianguloMarcador[1],
          trianguloMarcador[2], trianguloMarcador[3],
          trianguloMarcador[4], trianguloMarcador[5]
        );
      }

      if (u.tipo === TipoUnidad.GuerreraVoladora) {
        const trianguloGrande = this.verticesTrianguloRotado(base.x, base.y, 22, 26, anguloVisual + Math.PI / 2);
        this.graficoBarrasUnidades.fillStyle(bordeColor, 0.12);
        this.graficoBarrasUnidades.fillTriangle(
          trianguloGrande[0], trianguloGrande[1],
          trianguloGrande[2], trianguloGrande[3],
          trianguloGrande[4], trianguloGrande[5]
        );
        this.graficoBarrasUnidades.lineStyle(1, bordeColor, 0.8);
        this.graficoBarrasUnidades.strokeTriangle(
          trianguloGrande[0], trianguloGrande[1],
          trianguloGrande[2], trianguloGrande[3],
          trianguloGrande[4], trianguloGrande[5]
        );
        const trianguloPequeno = this.verticesTrianguloRotado(base.x, base.y, 11, 13, anguloVisual + Math.PI / 2);
        this.graficoBarrasUnidades.fillStyle(0x111118, 0.55);
        this.graficoBarrasUnidades.fillTriangle(
          trianguloPequeno[0], trianguloPequeno[1],
          trianguloPequeno[2], trianguloPequeno[3],
          trianguloPequeno[4], trianguloPequeno[5]
        );
        this.graficoBarrasUnidades.lineStyle(1, bordeColor, 1); 
        this.graficoBarrasUnidades.strokeTriangle(
          trianguloPequeno[0], trianguloPequeno[1],
          trianguloPequeno[2], trianguloPequeno[3],
          trianguloPequeno[4], trianguloPequeno[5]
        );
      }

      const tieneAgua = u.cargaAgua > 0;
      const aguaDos = u.cargaAgua >= 2;
      const arcillaUno = u.cargaArcilla > 0;
      const arcillaDos = u.cargaArcilla >= 2;
      const cargoOffsetY = u.tipo === TipoUnidad.Voladora || u.tipo === TipoUnidad.GuerreraVoladora ? 7 : 5;
      if (tieneAgua) {
        this.graficoBarrasUnidades.fillStyle(COLOR_CARGA_AGUA, 1);
        this.graficoBarrasUnidades.fillRect(base.x - 7, base.y - 16 - cargoOffsetY, 14, 3);
      }
      if (aguaDos) {
        this.graficoBarrasUnidades.fillStyle(COLOR_CARGA_AGUA, 1);
        this.graficoBarrasUnidades.fillRect(base.x - 7, base.y - 12 - cargoOffsetY, 14, 3);
      }
      if (arcillaUno) {
        this.graficoBarrasUnidades.fillStyle(COLOR_CARGA_ARCILLA, 1);
        this.graficoBarrasUnidades.fillRect(base.x - 7, base.y - 16 - cargoOffsetY, 14, 3);
      }
      if (arcillaDos) {
        this.graficoBarrasUnidades.fillStyle(COLOR_CARGA_ARCILLA, 1);
        this.graficoBarrasUnidades.fillRect(base.x - 7, base.y - 12 - cargoOffsetY, 14, 3);
      }
      if (u.cargaNectar > 0) {
        this.graficoBarrasUnidades.fillStyle(COLOR_CARGA_NECTAR, 1);
        this.graficoBarrasUnidades.fillRect(base.x - 7, base.y - 16 - cargoOffsetY, 14, 3);
      }
    }

    this.actualizarFeedbackDomesticacion();
    this.actualizarBarrasSalud();

    if (this.minimapaTerrenoSucio) {
      this.redibujarMinimapaTerreno();
    }

    const debeActualizarBarrasProgreso = this.colasEdificiosDirty || this.time.now - this.ultimoRefrescoBarrasProgreso >= 100;
    if (debeActualizarBarrasProgreso) {
      this.actualizarBarrasProgresoEdificio();
      this.ultimoRefrescoBarrasProgreso = this.time.now;
    }

    // PERF: the dynamic minimap is a low-priority overlay; redraw it on a throttle instead of every frame.
    if (this.time.now - this.ultimoMinimapaDinamico >= this.MINIMAPA_INTERVALO_MS) {
      this.graficoMinimapa.clear();
      const { x: mmX, y: mmY, w: mmW, h: mmH } = this.rectMinimapa();
      this.graficoMinimapa.fillStyle(0x000000, 0.7);
      this.graficoMinimapa.fillRect(mmX, mmY, mmW, mmH);
      this.graficoMinimapa.lineStyle(1, 0x555555, 1);
      this.graficoMinimapa.strokeRect(mmX, mmY, mmW, mmH);

      const mapa = this.sim.mapa;
      const escalaX = mmW / mapa.ancho;
      const escalaY = mmH / mapa.alto;
      const mundoW = mapa.ancho * TAM;
      const mundoH = mapa.alto * TAM;
      const vx0 = Math.max(0, view.x);
      const vy0 = Math.max(0, view.y);
      const vx1 = Math.min(mundoW, view.right);
      const vy1 = Math.min(mundoH, view.bottom);
      const viewportX = mmX + (vx0 / mundoW) * mmW;
      const viewportY = mmY + (vy0 / mundoH) * mmH;
      const viewportW = ((vx1 - vx0) / mundoW) * mmW;
      const viewportH = ((vy1 - vy0) / mundoH) * mmH;
      this.graficoMinimapa.fillStyle(0x88ccff, 0.25);
      this.graficoMinimapa.fillRect(viewportX, viewportY, viewportW, viewportH);
      this.graficoMinimapa.lineStyle(1, 0x88ccff, 1);
      this.graficoMinimapa.strokeRect(viewportX, viewportY, viewportW, viewportH);

      // Unidades en el minimapa
      for (const u of this.sim.unidades) {
        this.graficoMinimapa.fillStyle(0xffffff, 1);
        this.graficoMinimapa.fillRect(mmX + u.x * escalaX, mmY + u.y * escalaY, 2, 2);
      }
      this.ultimoMinimapaDinamico = this.time.now;
    }

    if (this.time.now - this.ultimoRefrescoCostos >= 250) {
      this.refrescarColoresCosto();
      this.ultimoRefrescoCostos = this.time.now;
    }
    if (this.temporizadorError > 0) {
      this.textoErrorHUD.setText(this.textoMensajeError).setVisible(true);
    } else {
      this.textoErrorHUD.setVisible(false);
    }
    const s = this.sim.stock[0];
    const textoTick = `Tick: ${this.sim.tickActual} ${this.sim.esDeNoche ? "(NOCHE 🌙)" : "(DÍA ☀️)"}   |   Agua: ${s.agua}   Arcilla: ${s.arcilla}   Néctar: ${s.nectar}`;
    if (textoTick !== this.ultimoTextoTick) {
      this.textoTick.setText(textoTick);
      this.ultimoTextoTick = textoTick;
    }
    this.overlayNoche.setVisible(this.sim.esDeNoche);
    this.actualizarFondoHudPorSeleccion();

    // Panel de información (en el HUD inferior)
    if (this.panelDirty || this.time.now - this.ultimoPanelRefreshMs >= 250) {
      this.panelDirty = true;
      const info = this.textoPanel();
      if (info !== this.ultimoTextoPanel) {
        const infoTexto = info ?? "";
        this.textoInfo.setText(infoTexto).setVisible(info !== null);
        this.ultimoTextoPanel = info;
      } else if (info === null && this.textoInfo.visible) {
        this.textoInfo.setVisible(false);
      }
      if (info === null) {
        this.rectSeleccionCelda.setVisible(false);
      } else if (this.celdaInfo) {
        this.rectSeleccionCelda
          .setPosition(this.celdaInfo.x * TAM, this.celdaInfo.y * TAM)
          .setVisible(true);
      }
      this.panelDirty = false;
      this.ultimoPanelRefreshMs = this.time.now;
    }
    this.actualizarColaProduccionHUD();
    this.actualizarIndicadorEnfermedad();
    this.actualizarIndicadorRegen();
    this.actualizarMarcadorRendezvous();
  }
}