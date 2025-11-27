import { describe, expect, it } from "vitest";
import { p } from "../domBuilder";
import { createState } from "../state";
import { setJsdomApp } from "./testUtil";

describe(createState, () => {
  it(".get() + .onChange() + .set() + .modify()", () => {
    const state = createState({ c: 0 }, { name: "test" });
    expect(state.get()).toEqual({ c: 0 });
    let c = 0;
    state.onValueChange((obj, old) => {
      c = obj.c;
    });
    state.set({ c: 1 });
    expect(c).toEqual(1);
    state.modify((cur) => ({ c: cur.c + 2 }));
    expect(c).toEqual(3);
  });
});

describe("state", () => {
  it(".addDomEvent()", () => {
    setJsdomApp();
    const node = p();
    const state = createState({ c: 0 }, { name: "test" });
    state.addDomEvent("counter", node, "click", (ev) => {
      state.modify((cur) => ({ c: cur.c + 2 }));
    });
    node.click();
    expect(state.get().c).toEqual(2);
  });
});
