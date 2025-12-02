import { channelsDemo } from "./demos/channelsDemo";
import { createFormStateDemo } from "./demos/formDemo";
import { basicCounter } from "./demos/simpleDemos";
import { simpleForm } from "./demos/simpleFormDemo";
import { testTableCounter } from "./demos/stateDemo";
import { onDestroyParentDemo, onDestroyTwoNodes } from "./demos/stateOnDestroyDemo";
import { br, button, div, input, pre, setElementToId, table, td, tr } from "./domBuilder";
import { createState } from "./state";

interface Demo {
  title: string;
  fn: () => HTMLElement;
}

const demo = (title: string, fn: () => HTMLElement) => ({ title, fn });

const demos: Demo[] = [
  demo("counter(), naive 2010 DOM node version", basicCounter),
  demo("testable counter", testTableCounter),
  demo("onDestroyDemo", onDestroyTwoNodes),
  demo("onDestroyParentDemo", onDestroyParentDemo),
  demo("channelsDemo", channelsDemo),
  demo("simple form - form handling with state", simpleForm),
  demo("form handling with createFormState", createFormStateDemo),
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
    const row = tr(td(launchDemo, br(), demo.title), src, target);
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

  const state = createState();
  const search = input({ type: "search", value: location.hash.substring(1) });
  state.addDomEvent("search", search, "keyup", () => {
    const s = search.value;
    location.hash = s;
    filterDemos(s);
  });
  filterDemos(location.hash.substring(1));
  return div(search, table(rows));
}

setElementToId("app", demolist(demos));
