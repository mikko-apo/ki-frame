import {z} from "zod";
import {createForm} from "..";
import {ExtendedFormAttributes, form, input, inputNumber, pre} from "../domBuilder";

const divisibleBy = (divisor: number) =>
  z.coerce.number().refine(
    (n) => {
      console.log("divisibleBy", divisor, n, Number.isInteger(n) && n % divisor === 0)
      return Number.isInteger(n) && n % divisor === 0;
    },
    {
      message: `Must be a number divisible by ${divisor}`,
    },
  );

export function createFormStateDemo(init = {a: 23, b: 10}) {
  // define dom elements
  const logError: ExtendedFormAttributes = {onError: ({isOk, node}) => log(`${node?.name} is ok: ${isOk}`)};
  const a = inputNumber(logError);
  const b = inputNumber(logError);
  const info = pre();
  const root = form("Input 1", a, "Input 2", b, input({type: "submit", value: "Submit"}), info);

  const log = (s: string) => info.append(`${s}\n`);

  const formData = createForm(
    {
      a,
      b,
    },
    init,
    {
      schema: z.object({a: divisibleBy(10), b: divisibleBy(5)}).superRefine((data, ctx) => {
        if (data.a + data.b !== 15) {
          ctx.addIssue({code: "invalid_value", values: [data.a, data.b, 15], path: [""]});
        }
      }),
      onError: ({isOk}) => log(`Main object validate is ok: ${isOk}`)
    },
  );
  formData.onValueChange(({a, b}) => {
    log(`Form data set to: a:${a} b:${b}`);
  });
  formData.onsubmit(root, () => {
    const {a, b} = formData.get();
    log(`Form submitted ${a} ${b}`);
  });

  // renders content with with state.onChange()
  formData.updateUi();
  return root;
}
