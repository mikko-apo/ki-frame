import {button, div, text} from "../domBuilder";
import {createState} from "../state";

export function stateFetchDemo() {
  const info = text();
  const b = button("Click me to fetch!");

  const state = createState({ text: "Not loaded", counter: 0 });

  function setText(text: string) {
    state.modify(({ counter }) => {
      return { text: `${text}. Count ${counter}`, counter };
    });
  }

  state.addDomEvent("start fetch", b, "click", (ev) => {
    state.fetch("test.json", { timeoutMs: 1000 }).response.then(
      (response) => {
        setText(response.ok ? `Loaded ok.` : `Loading failed. Status code: ${response.status}`);
      },
      (reason) => setText(`Loading failed due error. '${reason}'`),
    );
    state.modify((cur) => ({ text: "Loading", counter: cur.counter + 1 }));
  });

  state.onValueChange((obj) => (info.nodeValue = obj.text));

  state.refresh();

  return div(b, info);
}
