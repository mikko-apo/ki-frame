import { ChannelRegistry } from "./channel";
import {b, br, button, div, form, input, p, pre, setElementToId, table, td, text, textarea, tr} from "./domBuilder";
import { createController,createState } from "./state";
import type { State } from "./types";

interface Total {
  total: number;
}

interface Demo {
  title: string;
  fn: () => HTMLElement;
}

const demo = (title: string, fn: () => HTMLElement) => ({ title, fn });

const demos: Demo[] = [
  demo("counter(), naive 2010 DOM node version", function naiveCounter() {
      const state = createState({total: 0});

      function infoText(state: State<Total>) {
        const t = text();
        state.onValueChange((obj) => (t.nodeValue = `${obj.total}`));
        return t;
      }

      // renders initial content by triggering state.onChange() subscribers
      state.refresh();
      return p("Total: ", infoText(state), {
        onclick: () => state.modify((cur) => ({total: cur.total + 1})),
      });
    }
  ),
  demo("testable counter", function testTableCounter() {
    // DOM structure setup for testing
    const createNodes = () => {
      const info = text();
      const root = p("Click to update counter", info);
      return {info, root};
    };

    function counter(state = createState({total: 0})) {
      const nodes = createNodes();
      // connect subscribers
      state.addDomEvent("counter", nodes.root, "click", (ev) => state.modify((cur) => ({total: cur.total + 1})));
      state.onValueChange((obj) => {
        console.log(state.describe());
        return (nodes.info.nodeValue = `Counter: ${obj.total}`);
      });
      // render content with state.refresh()
      state.refresh();
      return nodes;
    }

    return counter().root;
  }),
  demo("onDestroyDemo", function onDestroyTwoNodes() {
    const state = createState({total: 123});
    const info = (txt: string, s: State<Total>) => {
      const t = text();
      s.onValueChange((obj) => (t.nodeValue = `${txt}: ${obj.total}`));
      s.onDestroy(() => (t.nodeValue = `${txt}: state destroyed`));
      return p(t);
    };
    const root = p(button("Click me!", {onclick: state.destroy}), info("1", state), info("2", state));
    state.refresh();
    return root;
  }),
  demo("onDestroyParentDemo", function onDestroyParentDemo() {
    const parent = createState({});
    const state = createState({ total: 0 });
    state.onDestroy(() => {
      root.replaceChildren(stateInfo, parentInfo);
      stateInfo.nodeValue = "State destroyed!";
    });
    parent.onDestroy(() => {
      parentInfo.nodeValue = "Parent was destroyed!";
    });
    parent.addToDestroy(state);
    // renders content with with state.onChange()
    state.refresh();
    const stateInfo = text("State ready");
    const parentInfo = text("Parent ready");
    const root = p(p("Not destroyed. Click me!", { onclick: parent.destroy }), stateInfo, parentInfo);
    return root;
  }),
  demo("channelsDemo", function channelsDemo() {
    const state = createState({ total: 0 });
    const channels = new ChannelRegistry<{ test: { num: number } }>();
    const channel = channels.get("test");
    let num = 0;

    state.onDestroy(() => {
      root.replaceChildren(t1);
      t1.nodeValue = "T1, not destroyed!";
    });

    channel.subscribe((payload) => {
      t1.nodeValue = `Counter ${payload.num}`;
    });

    // renders content with with state.onChange()
    state.refresh();
    const t1 = text("T1");
    const root = p(
      p("Click me to send message!", {
        onclick: () => channel.publish({ num: num++ }),
      }),
      t1,
    );
    return root;
  }),
  demo("simple form - form handling with state", function naiveForm() {
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
        info.append(`${s}\n`)
        return true
      }
      domTextInput(formData, "i1", i1, "a");
      domTextInput(formData, "i2", i2, "b", v => (v.length % 2 == 0) && log(`b value '${v}' has wrong length ${v.length}`));
      formData.onValueChange(({ a, b }) => {
        i1.value = a;
        i2.value = b;
        log(`Form data: ${a} ${b}`);
      });
      // submitState listens to submit button and
      const submitController = createController();
      submitController.addDomEvent("submit", root, "submit", (ev) => {
        ev.preventDefault()
        const {a,b} = formData.get();
        log(`Form submitted ${a} ${b}`);
      });

      // renders content with with state.onChange()
      formData.refresh();
      return root;
    }

    return simpleForm();
  }),
];

function demolist(demos: Demo[]) {
  const rows = demos.map(demo => {
    const target = td();
    const src = td()
    const launchDemo = button(`Launch ${demo.fn.name}`, {
      onclick: () => {
        target.replaceChildren(demo.fn());
        src.replaceChildren(pre(demo.fn.toString()));
      },
    });
    const row = tr(td(launchDemo, br(), demo.title), src, target);
    row.style = "vertical-align: baseline"
    return row;
  }, demo);

  const demoRowFunctionStringSearchIndex = demos.map(demo => demo.fn.toString().toLowerCase())
  const state= createState();
  const search = input();
  state.addDomEvent("search", search, "keyup", ()=> {
    const searchString = search.value.toLowerCase().trim();
    demoRowFunctionStringSearchIndex.forEach((demoFn, index) => {
      if(searchString.length > 2) {
        rows[index].hidden = demoFn.indexOf(searchString) === -1;
      }
      if(searchString.length == 0) {
        rows[index].hidden = false;
      }
    });
  })
  return div(search, table(rows));
}

setElementToId("app", demolist(demos));
