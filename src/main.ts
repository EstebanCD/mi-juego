import Phaser from "phaser";
import { EscenaJuego } from "./cliente/EscenaJuego";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 1024,
  height: 1024,
  backgroundColor: "#000000",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [EscenaJuego],
});