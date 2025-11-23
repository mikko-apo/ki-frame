import { describe, expect, it } from "vitest";
import { p, text } from "../domBuilder";
import { createState } from "../state";
import { setJsdomApp } from "./testUtil";

// DOM structure setup for testing
const createNodes = () => {
  const info = text();
  const root = p("Click to update counter", info);
  return { info, root };
};

function counter(state = createState({ total: 0 })) {
  const nodes = createNodes();
  // connect subscribers
  nodes.root.onclick = () => state.modify((cur) => ({ total: cur.total + 1 }));
  state.onChange((obj) => (nodes.info.nodeValue = `Counter: ${obj.total}`));
  // render content with state.refresh()
  state.refresh();
  return nodes;
}

describe("Example tests", () => {
  it("connected counter() and root.click()", () => {
    setJsdomApp();
    const { root, info } = counter(createState({ total: 0 }));
    expect(root).toMatchSnapshot();
    expect(info.nodeValue).toEqual("Counter: 0");
    root.click();
    expect(root).toMatchSnapshot();
    expect(info.nodeValue).toEqual("Counter: 1");
  });
});
