import {button, div, text} from "../domBuilder";
import {createController} from "../state";

export function stateTimeoutDemo() {
  const b1 = button("Click me!");
  const state = createController();

  state.addDomEvent("start timeout", b1, "click", (ev) => {
    b1.textContent = "Waiting...";
    state.timeout(() => b1.textContent = "Ready!", 1000)
  });

  return div(b1);
}
