import { form, input, pre } from "../domBuilder";
import { createController, createState, type State } from "../state";

export function simpleForm() {
  // generic helper function
  const domTextInput = <T, K extends keyof T>(
    state: State<T>,
    name: string,
    node: HTMLInputElement,
    key: K,
    validate?: (v: string) => boolean,
  ) =>
    state.addDomEvent(name, node, "keyup", (ev) => {
      if (validate) {
        if (validate(node.value)) {
          return;
        }
      }
      state.modify((cur) => ({ ...cur, [key]: node.value }));
    });

  // since there is no form api, here's an example on how to do that with the basic ki-frame api
  function simpleForm(formData = createState({ a: "23", b: "234" })) {
    // define dom elements
    const i1 = input();
    const i2 = input();
    const info = pre();
    const root = form("Input 1", i1, "Input 2", i2, input({ type: "submit", value: "Submit" }), info);

    // formData contains state for the form, attach listeners
    const log = (s: string) => {
      info.append(`${s}\n`);
      return true;
    };
    domTextInput(formData, "i1", i1, "a");
    domTextInput(
      formData,
      "i2",
      i2,
      "b",
      (v) => v.length % 2 == 0 && log(`b value '${v}' has wrong length ${v.length}`),
    );
    formData.onValueChange(({ a, b }) => {
      i1.value = a;
      i2.value = b;
      log(`Form data: ${a} ${b}`);
    });
    // submitState listens to submit button and
    const submitController = createController();
    submitController.addDomEvent("submit", root, "submit", (ev) => {
      ev.preventDefault();
      const { a, b } = formData.get();
      log(`Form submitted ${a} ${b}`);
    });

    // renders content with with state.onChange()
    formData.updateUi();
    return root;
  }

  return simpleForm();
}
