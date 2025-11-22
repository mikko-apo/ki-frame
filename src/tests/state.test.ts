import {describe, expect, it} from "vitest";
import {createState} from "../state";

describe(createState, () => {
  it(".get() + .onChange() + .set() + .modify()", () => {
    const state = createState({c: 0}, {name: "test"})
    expect(state.get()).toEqual({c: 0})
    let c = 0;
    state.onChange((obj, old) => {c = obj.c})
    state.set({c: 1})
    expect(c).toEqual(1);
    state.modify(cur => ({c: cur.c+2}))
    expect(c).toEqual(3);
  });
});
