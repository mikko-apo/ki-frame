import { ChannelRegistry } from "./channel";
import { button, p, setElementToId, table, td, text, tr } from "./domBuilder";
import { createState } from "./state";
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
  demo("counter", () => {
    const state = createState({ total: 0 });

    function infoText(state: State<Total>) {
      const t = text();
      state.onChange((obj) => (t.nodeValue = `${obj.total}`));
      return t;
    }

    // renders initial content by triggering state.onChange() subscribers
    state.refresh();
    return p("Total: ", infoText(state), {
      onclick: () => state.modify((cur) => ({ total: cur.total + 1 })),
    });
  }),
  demo("onDestroyDemo", () => {
    const state = createState({ total: 123 });
    const info = (txt: string, s: State<Total>) => {
      const t = text();
      s.onChange((obj) => (t.nodeValue = `${txt}: ${obj.total}`));
      s.onDestroy(() => (t.nodeValue = `${txt}: state destroyed`));
      return p(t);
    };
    const root = p(button("Click me!", { onclick: state.destroy }), info("1", state), info("2", state));
    state.refresh();
    return root;
  }),
  demo("onDestroyParentDemo", () => {
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
  demo("channelsDemo", () => {
    const state = createState({ total: 0 });
    const channels = new ChannelRegistry<{ test: { num: number } }>();
    let num = 0;

    state.onDestroy(() => {
      root.replaceChildren(t1);
      t1.nodeValue = "T1, not destroyed!";
    });

    channels.subscribe("test", (payload) => {
      t1.nodeValue = `Counter ${payload.num}`;
    });

    // renders content with with state.onChange()
    state.refresh();
    const t1 = text("T1");
    const root = p(
      p("Click me to send message!", {
        onclick: () => channels.publish("test", { num: num++ }),
      }),
      t1,
    );
    return root;
  }),
];

function demolist(demos: Demo[]) {
  const rows = demos.map((demo) => {
    const target = td();
    const launchDemo = button(demo.title, {
      onclick: () => {
        target.replaceChildren(demo.fn());
      },
    });
    return tr(td(launchDemo), target);
  }, demo);
  console.log("rows", rows);
  return table(rows);
}

setElementToId("app", demolist(demos));
