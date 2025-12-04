import { p, text } from "../domBuilder";
import { createState } from "../state";

export function testTableCounter() {
  // DOM structure setup for testing
  const createNodes = () => {
    const info = text();
    const root = p("Click to update counter", info);
    return { info, root };
  };

  function counter(state = createState({ total: 0 })) {
    const nodes = createNodes();
    // connect subscribers
    state.addDomEvent("counter", nodes.root, "click", (ev) => state.modify((cur) => ({ total: cur.total + 1 })));
    state.onValueChange((obj) => {
      console.log(state.describe());
      nodes.info.nodeValue = `Counter: ${obj.total}`;
    });
    // render content with state.refresh()
    state.refresh();
    return nodes;
  }

  return counter().root;
}
