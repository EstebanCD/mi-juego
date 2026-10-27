import Phaser from "phaser";
import { EscenaJuego } from "./cliente/EscenaJuego";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#000000",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  scene: [EscenaJuego],
});