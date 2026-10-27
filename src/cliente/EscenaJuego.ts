import Phaser from "phaser";
import { Terreno, Recurso } from "../simulacion/mapa";
import { crearMapaPrueba } from "../simulacion/mapaPrueba";

const TAM = 32; // tamaño de celda en pantalla (px)

export class EscenaJuego extends Phaser.Scene {
  constructor() {
    super("EscenaJuego");
  }

  create(): void {
    const mapa = crearMapaPrueba();
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
  }
}