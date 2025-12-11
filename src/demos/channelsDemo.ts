import { createState } from "..";
import { ChannelRegistry } from "../channel";
import { p, text } from "../domBuilder";

export function channelsDemo() {
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
  state.updateUi();
  const t1 = text("T1");
  const root = p(
    p("Click me to send message!", {
      onclick: () => channel.publish({ num: num++ }),
    }),
    t1,
  );
  return root;
}
