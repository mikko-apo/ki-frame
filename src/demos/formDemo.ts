import { form, input, pre } from "../domBuilder";
import { createFormState, formEvent } from "../form";

export function createFormStateDemo(init = { a: 23, b: 10 }) {
  // define dom elements
  const i1 = input();
  const i2 = input();
  const info = pre();
  const root = form("Input 1", i1, "Input 2", i2, input({ type: "submit", value: "Submit" }), info);

  const log = (s: string) => info.append(`${s}\n`);

  const isDividable = (prefix: string, divider: number): ((n: number) => boolean) => {
    return (n: number) => {
      const isOk = n % divider === 0;
      if (isOk) {
        return true;
      }
      log(`${prefix} ${n} is not dividable by ${divider}`);
      return false;
    };
  };
  const formData = createFormState(
    {
      a: formEvent(i1, "keyup", (s) => Number(s), isDividable("a", 10)),
      b: formEvent(i2, "keyup", (s) => Number(s), isDividable("b", 5)),
    },
    {
      init,
      validate: ({ a, b }) => {
        const isOk = a + b === 15;
        if (isOk) {
          return true;
        }
        log(`Form full state validation : ${a}0${b}=${a + b} is not 15`);
        return false;
      },
    },
  );
  formData.onValueChange(({ a, b }) => {
    log(`Form data set to: a:${a} b:${b}`);
  });
  formData.onSubmit(root, (ev) => {
    const { a, b } = formData.get();
    log(`Form submitted ${a} ${b}`);
  });

  // renders content with with state.onChange()
  formData.refresh();
  return root;
}
