import { describe, expect, it } from "vitest";
import { createState } from "..";
import { p } from "../domBuilder";
import { setJsdomApp } from "./testUtil";

describe(createState, () => {
  it(".get() + .onChange() + .set() + .update()", () => {
    const state = createState({ c: 0 }, { name: "test" });
    expect(state.get()).toEqual({ c: 0 });
    let c = 0;
    state.onValueChange((obj, old) => {
      c = obj.c;
    });
    state.set({ c: 1 });
    expect(c).toEqual(1);
    state.set((cur) => ({ c: cur.c + 2 }));
    expect(c).toEqual(3);
    state.set(() => ({ c: 5 }));
    expect(c).toEqual(5);
    state.update({ c: 6 });
    expect(c).toEqual(6);
    const statePartialUpdate = createState({ a: 1, b: 2 });
    statePartialUpdate.update(() => ({ a: 5 }));
    expect(statePartialUpdate.get().a).toEqual(5);
  });
});

describe("state", () => {
  it(".addDomEvent()", () => {
    setJsdomApp();
    const node = p();
    const state = createState({ c: 0 }, { name: "test" });
    state.addDomEvent("counter", node, "click", (ev) => {
      state.set((cur) => ({ c: cur.c + 2 }));
    });
    node.click();
    expect(state.get().c).toEqual(2);
  });
});
