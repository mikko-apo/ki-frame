import type { State } from "..";
import { p, text } from "../domBuilder";
import { createState } from "../index";

interface Total {
  total: number;
}

export function basicCounter() {
  const state = createState({ total: 0 });

  function infoText(state: State<Total>) {
    const t = text();
    state.onValueChange((obj) => (t.nodeValue = `${obj.total}`));
    return t;
  }

  // renders initial content by triggering state.onChange() subscribers
  state.updateUi();
  return p("Total: ", infoText(state), {
    onclick: () => state.modify((cur) => ({ total: cur.total + 1 })),
  });
}
