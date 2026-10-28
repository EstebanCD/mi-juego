import Phaser from "phaser";
import { Terreno, Recurso } from "../simulacion/mapa";
import { crearMapaPrueba } from "../simulacion/mapaPrueba";
import {
  Simulacion,
  MS_POR_TICK,
  TICKS_POR_PASO,
  TipoUnidad,
  TipoEdificio,
} from "../simulacion/simulacion";

const TAM = 32; // tamaño de celda en pantalla (px)
// Velocidad visual constante (px/s), ligada a la velocidad real de la simulación.
// El 1.1 evita que el círculo se quede cada vez más rezagado.
const VELOCIDAD_VISUAL = (TAM / (TICKS_POR_PASO * MS_POR_TICK)) * 1000 * 1.1;

export class EscenaJuego extends Phaser.Scene {
  private teclas!: Phaser.Types.Input.Keyboard.CursorKeys;
  private sim!: Simulacion;
  private acumulador = 0;
  private textoTick!: Phaser.GameObjects.Text;
  private camUI!: Phaser.Cameras.Scene2D.Camera;
  private circulos = new Map<number, Phaser.GameObjects.Arc>();
  private seleccionada: number | null = null;

  constructor() {
    super("EscenaJuego");
  }

  create(): void {
    this.sim = new Simulacion(crearMapaPrueba());
    const mapa = this.sim.mapa;
    const g = this.add.graphics();

    for (let y = 0; y < mapa.alto; y++) {
      for (let x = 0; x < mapa.ancho; x++) {
        const px = x * TAM;
        const py = y * TAM;

        // 1. Color base según el terreno
        const t = mapa.getTerreno(x, y);
        let color = 0x1e1e1e;
        if (t === Terreno.Arcilloso) color = 0x4a3526;
        if (t === Terreno.Agua) color = 0x1f4e8c;
        g.fillStyle(color, 1);
        g.fillRect(px, py, TAM, TAM);

        // 2. La altura aclara la celda
        const altura = mapa.getAltura(x, y);
        if (altura > 0) {
          g.fillStyle(0xffffff, 0.12 * altura);
          g.fillRect(px, py, TAM, TAM);
        }

        // 3. Rampa: cuadro naranja en el centro
        if (mapa.esRampa(x, y)) {
          g.fillStyle(0xe0a030, 0.7);
          g.fillRect(px + 8, py + 8, TAM - 16, TAM - 16);
        }

        // 4. Recurso
        const r = mapa.getRecurso(x, y);
        const cx = px + TAM / 2;
        const cy = py + TAM / 2;
        if (r === Recurso.Arcilla) {
          g.fillStyle(0xb5835a, 1);
          g.fillRect(cx - 5, cy - 5, 10, 10);
        } else if (r === Recurso.Flor) {
          g.fillStyle(0xffe14d, 1);
          g.fillCircle(cx, cy, 7);
        } else if (r === Recurso.Planta) {
          g.fillStyle(0x4caf50, 1);
          g.fillCircle(cx, cy, 7);
        }

        // 5. Línea de la cuadrícula
        g.lineStyle(1, 0x333333, 1);
        g.strokeRect(px, py, TAM, TAM);
      }
    }

    this.configurarCamara(mapa.ancho * TAM, mapa.alto * TAM);

    // Interfaz: texto + cámara aparte que no hace zoom ni se desplaza
    this.textoTick = this.add
      .text(10, 10, "", { color: "#ffffff", fontSize: "16px" })
      .setDepth(10);

    this.camUI = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.cameras.main.ignore(this.textoTick); // el mundo no dibuja la interfaz
    this.camUI.ignore(g); // la interfaz no dibuja el mapa

    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      this.camUI.setSize(size.width, size.height);
    });

    // Palacio inicial del jugador 0 (2x2) y una obrera de prueba
    this.sim.crearEdificio(TipoEdificio.Palacio, 0, 8, 14);
    this.dibujarEdificios();
    this.sim.crearUnidad(TipoUnidad.Obrera, 10, 12);
    this.crearCirculos();
    this.configurarRaton();
  }

  private configurarCamara(anchoMundo: number, altoMundo: number): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, anchoMundo, altoMundo);

    // Arrastrar con el botón central del ratón
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.middleButtonDown()) return;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });

    // Zoom con la rueda
    this.input.on(
      "wheel",
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        const zoom = cam.zoom * (dy > 0 ? 0.9 : 1.1);
        cam.setZoom(Phaser.Math.Clamp(zoom, 0.5, 3));
      }
    );

    this.teclas = this.input.keyboard!.createCursorKeys();
  }

  // Un rectángulo por edificio (provisional hasta tener sprites)
  private dibujarEdificios(): void {
    for (const e of this.sim.edificios) {
      const color = e.tipo === TipoEdificio.Palacio ? 0x8a5a3c : 0x6b4a33;
      const r = this.add
        .rectangle(e.x * TAM, e.y * TAM, e.ancho * TAM, e.alto * TAM, color)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xd9b38c);
      this.camUI.ignore(r); // la cámara de interfaz no dibuja el mundo
    }
  }

  // Crea un círculo por cada unidad que aún no tenga uno
  private crearCirculos(): void {
    for (const u of this.sim.unidades) {
      if (this.circulos.has(u.id)) continue;
      const c = this.add.circle(
        u.x * TAM + TAM / 2,
        u.y * TAM + TAM / 2,
        9,
        0xff6a3d
      );
      c.setStrokeStyle(2, 0xffffff);
      this.camUI.ignore(c); // la cámara de interfaz no dibuja el mundo
      this.circulos.set(u.id, c);
    }
  }

  private configurarRaton(): void {
    // Evita el menú contextual del navegador al hacer clic derecho
    this.input.mouse?.disableContextMenu();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const mundo = this.cameras.main.getWorldPoint(p.x, p.y);
      const cx = Math.floor(mundo.x / TAM);
      const cy = Math.floor(mundo.y / TAM);

      if (p.leftButtonDown()) {
        // Selecciona la unidad de esa celda, o deselecciona
        const u = this.sim.unidades.find((v) => v.x === cx && v.y === cy);
        this.seleccionada = u ? u.id : null;
      } else if (p.rightButtonDown() && this.seleccionada !== null) {
        if (this.sim.mapa.dentro(cx, cy)) {
          this.sim.enviarOrden({
            tipo: "mover",
            unidadId: this.seleccionada,
            x: cx,
            y: cy,
          });
          this.mostrarMarcador(cx, cy);
        }
      }
    });
  }

  // Marcador de destino: cuatro "píxeles" que se cierran hacia el centro
  private mostrarMarcador(cx: number, cy: number): void {
    const centroX = cx * TAM + TAM / 2;
    const centroY = cy * TAM + TAM / 2;
    const esquinas = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    for (const [sx, sy] of esquinas) {
      const r = this.add
        .rectangle(centroX + sx * 12, centroY + sy * 12, 4, 4, 0xff3030)
        .setDepth(5);
      this.camUI.ignore(r); // la cámara de interfaz no dibuja el mundo
      this.tweens.add({
        targets: r,
        x: centroX + sx * 4,
        y: centroY + sy * 4,
        alpha: 0,
        duration: 350,
        ease: "Quad.easeIn",
        onComplete: () => r.destroy(),
      });
    }
  }

  update(_tiempo: number, delta: number): void {
    // Cámara
    const cam = this.cameras.main;
    const paso = (600 * delta) / 1000 / cam.zoom;
    if (this.teclas.left.isDown) cam.scrollX -= paso;
    if (this.teclas.right.isDown) cam.scrollX += paso;
    if (this.teclas.up.isDown) cam.scrollY -= paso;
    if (this.teclas.down.isDown) cam.scrollY += paso;

    // Simulación: acumula tiempo y avanza en ticks fijos
    this.acumulador += Math.min(delta, 250); // tope para no "espiralizar" tras una pausa
    while (this.acumulador >= MS_POR_TICK) {
      this.sim.tick();
      this.acumulador -= MS_POR_TICK;
    }

    // Dibujo: cada círculo avanza a velocidad constante hacia su celda
    for (const u of this.sim.unidades) {
      const c = this.circulos.get(u.id);
      if (!c) continue;
      const objetivoX = u.x * TAM + TAM / 2;
      const objetivoY = u.y * TAM + TAM / 2;
      const dx = objetivoX - c.x;
      const dy = objetivoY - c.y;
      const dist = Math.hypot(dx, dy);
      // Si se rezaga demasiado (por ejemplo tras una pausa), acelera para alcanzarla
      const factor = Math.max(1, dist / (TAM * 1.5));
      const maxPaso = (VELOCIDAD_VISUAL * factor * delta) / 1000;
      if (dist <= maxPaso) {
        c.x = objetivoX;
        c.y = objetivoY;
      } else {
        c.x += (dx / dist) * maxPaso;
        c.y += (dy / dist) * maxPaso;
      }
      c.setStrokeStyle(2, u.id === this.seleccionada ? 0xffe14d : 0xffffff);
    }

    const s = this.sim.stock[0];
    this.textoTick.setText(
      `Tick: ${this.sim.tickActual}\nAgua: ${s.agua}  Arcilla: ${s.arcilla}  Glucosa: ${s.glucosa}`
    );
  }
}