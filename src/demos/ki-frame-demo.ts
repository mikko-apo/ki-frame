import { createController, getDefaultContext } from "..";
import { br, button, div, hr, input, pre, setElementToId, table, td, tr } from "../domBuilder";
import { domBuilderWithState } from "./01_domBuilderStateDemo";
import { fetchDemo } from "./02_fetchDemo";
import { createFormStateDemo } from "./03_formDemo";
import { channelsDemo } from "./channelsDemo";
import { basicCounter } from "./simpleDemos";
import { simpleForm } from "./simpleFormDemo";
import { onDestroyParentDemo, onDestroyTwoNodes } from "./stateOnDestroyDemo";
import { stateTimeoutDemo } from "./stateTimeoutDemo";

interface Demo {
  title: string;
  fn: () => HTMLElement;
}

const demo = (title: string, fn: () => HTMLElement) => ({ title, fn });

const demos: Demo[] = [
  demo("testable counter", domBuilderWithState),
  demo("fetch examples", fetchDemo),
  demo("form handling with createFormState", createFormStateDemo),
  demo("counter(), naive 2010 DOM node version", basicCounter),
  demo("onDestroyDemo", onDestroyTwoNodes),
  demo("onDestroyParentDemo", onDestroyParentDemo),
  demo("channelsDemo", channelsDemo),
  demo("simple form - form handling with state", simpleForm),
  demo("timeout example", stateTimeoutDemo),
];

function demolist(demos: Demo[]) {
  const demoRowFunctionStringSearchIndex = demos.map((demo) => demo.fn.toString().toLowerCase());
  const rows = demos.map((demo) => {
    const target = td();
    const src = td();
    const launchDemo = button(`Launch ${demo.fn.name}`, {
      onclick: () => {
        target.replaceChildren(demo.fn());
        src.replaceChildren(pre(demo.fn.toString()));
      },
    });
    const row = tr(td(launchDemo, br(), demo.title), target, src);
    row.style = "vertical-align: baseline";
    return row;
  }, demo);

  function filterDemos(s: string) {
    const searchString = s.toLowerCase().trim();
    demoRowFunctionStringSearchIndex.forEach((demoFn, index) => {
      if (searchString.length > 2) {
        rows[index].hidden = demoFn.indexOf(searchString) === -1;
      }
      if (searchString.length == 0) {
        rows[index].hidden = false;
      }
    });
  }

  const state = createController();
  const search = input({ type: "search", value: location.hash.substring(1) });
  state.addDomEvent("search", search, "keyup", () => {
    const s = search.value;
    location.hash = s;
    filterDemos(s);
  });
  filterDemos(location.hash.substring(1));
  return div(
    search,
    hr(),
    table(rows),
    hr(),
    button("log context", {
      onclick: () => {
        if (window.gc) {
          const original = Array.from(getDefaultContext().controllers.all()).length;
          window.gc();
          console.log(
            `Ran window.gc(). Controller count before ${original} after ${Array.from(getDefaultContext().controllers.all()).length}`,
          );
        }
        console.log(getDefaultContext());
      },
    }),
  );
}

setElementToId("app", demolist(demos));
