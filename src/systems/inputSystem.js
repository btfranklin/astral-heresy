const controlKeys = new Set([
  "ShiftLeft",
  "ShiftRight",
  "KeyZ",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyM",
]);

export function createInputSystem(state, gameCanvas) {
  let attached = false;

  function setPointerPosition(event) {
    const rect = gameCanvas.getBoundingClientRect();
    state.input.pointerX = event.clientX - rect.left;
    state.input.pointerY = event.clientY - rect.top;
  }

  function onKeyDown(event) {
    if (controlKeys.has(event.code)) event.preventDefault();
    if (event.code === "KeyM") {
      state.input.pointerEnabled = state.input.pointerEnabled === false;
      return;
    }
    state.input[event.code] = true;
  }

  function onKeyUp(event) {
    if (controlKeys.has(event.code)) event.preventDefault();
    state.input[event.code] = false;
  }

  function onPointerMove(event) {
    setPointerPosition(event);
  }

  function onPointerDown(event) {
    setPointerPosition(event);
    state.input.PointerFire = true;
  }

  function onPointerUp() {
    state.input.PointerFire = false;
  }

  function attach() {
    if (attached) return;
    attached = true;
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    gameCanvas.addEventListener("pointermove", onPointerMove);
    gameCanvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function detach() {
    if (!attached) return;
    attached = false;
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    gameCanvas.removeEventListener("pointermove", onPointerMove);
    gameCanvas.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  return { attach, detach };
}
