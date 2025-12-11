import { createState, type State } from "..";
import { button, p, text } from "../domBuilder";

interface Total {
  total: number;
}

export function onDestroyTwoNodes() {
  const state = createState({ total: 123 });
  const info = (txt: string, s: State<Total>) => {
    const t = text();
    s.onValueChange((obj) => (t.nodeValue = `${txt}: ${obj.total}`));
    s.onDestroy(() => (t.nodeValue = `${txt}: state destroyed`));
    return p(t);
  };
  const root = p(button("Click me!", { onclick: state.destroy }), info("1", state), info("2", state));
  state.updateUi();
  return root;
}

export function onDestroyParentDemo() {
  const parent = createState({});
  const state = createState({ total: 0 });
  state.onDestroy(() => {
    root.replaceChildren(stateInfo, parentInfo);
    stateInfo.nodeValue = "State destroyed!";
  });
  parent.onDestroy(() => {
    parentInfo.nodeValue = "Parent was destroyed!";
  });
  parent.onDestroy(state);
  // renders content with with state.onChange()
  state.updateUi();
  const stateInfo = text("State ready");
  const parentInfo = text("Parent ready");
  const root = p(p("Not destroyed. Click me!", { onclick: parent.destroy }), stateInfo, parentInfo);
  return root;
}
