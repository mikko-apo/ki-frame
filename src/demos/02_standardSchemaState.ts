import { z } from "zod";
import { div, inputText, p, text } from "../domBuilder";
import { events } from "../domBuilderEvents";
import { createState } from "../index";

export function standardSchemaStateDemo() {
  const info = text();
  const state = createState(
    { email: "not set" },
    {
      schema: z.object({ email: z.email() }),
      onValidateFailure: (failure) => {
        console.error("Validation failure", failure);
        info.nodeValue = "Email error";
      },
    },
  );
  state.onValueChange((e) => (info.nodeValue = `Email is: ${e}`));
  const i = inputText(
    events({
      keyup: ({ node }) => {
        state.update({ email: node.value });
      },
    }),
  );
  return div(i, p("Info: ", info));
}
