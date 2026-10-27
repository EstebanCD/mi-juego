import Phaser from "phaser";
import { Terreno, Recurso } from "../simulacion/mapa";
import { crearMapaPrueba } from "../simulacion/mapaPrueba";
import { Simulacion, MS_POR_TICK, TipoUnidad } from "../simulacion/simulacion";

const TAM = 32; // tamaño de celda en pantalla (px)

export class EscenaJuego extends Phaser.Scene {
  private teclas!: Phaser.Types.Input.Keyboard.CursorKeys;
  private sim!: Simulacion;
  private acumulador = 0;
  private textoTick!: Phaser.GameObjects.Text;
  private camUI!: Phaser.Cameras.Scene2D.Camera;

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

    // Una obrera de prueba en la celda (10, 12)
    this.sim.crearUnidad(TipoUnidad.Obrera, 10, 12);
    this.dibujarUnidades();
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

  private dibujarUnidades(): void {
    for (const u of this.sim.unidades) {
      const c = this.add.circle(
        u.x * TAM + TAM / 2,
        u.y * TAM + TAM / 2,
        9,
        0xff6a3d
      );
      c.setStrokeStyle(2, 0xffffff);
      this.camUI.ignore(c); // la cámara de interfaz no dibuja el mundo
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

    this.textoTick.setText(`Tick: ${this.sim.tickActual}`);
  }
}