import { button, div, text } from "../domBuilder";
import { isErrorResponse } from "../fetch";
import { createController } from "../state";

export function fetchDemo() {
  const info = text("Not loaded");
  const b = button("Click me to fetch!");
  let counter = 0;

  const setText = (text: string) => (info.nodeValue = text);
  const handleError = (reason: unknown) =>
    setText(
      isErrorResponse(reason)
        ? `There was an error, response.status is ${reason.errorResponse.status}`
        : `There was an error, response.status is ${reason}`,
    );

  const state = createController();
  state.addDomEvent("start fetch", b, "click", () => {
    counter++;
    setText("Loading...");
    state.fetch("test.json", { timeoutMs: 1000 }).then(() => setText(`Loaded ok.`), handleError);
  });

  return div(b, info);
}
