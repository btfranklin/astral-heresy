import { createGame } from "./core/game.js";

const bgCanvas = document.getElementById("bg");
const gameCanvas = document.getElementById("game");
const startScreen = document.getElementById("start-screen");
const startButton = document.getElementById("start-button");
const endScreen = document.getElementById("end-screen");
const restartButton = document.getElementById("restart-button");

const game = createGame({
  bgCanvas,
  gameCanvas,
  startScreen,
  startButton,
  endScreen,
  restartButton,
  documentRoot: document,
});

if (game) {
  window.__astralHeresy = game;
  window.render_game_to_text = () => game.renderGameToText();
  window.advanceTime = (ms) => game.advanceTime(ms);
  game.init();
}
