import {createState, State} from "..";
import {styles} from "../domBuilderStyles";
import {button, div, p, text} from "../domBuilder";
import {events} from "../domBuilderEvents";

export function domBuilderWithState() {
  // DOM structure setup for testing
  const createNodes = (state: State<{ total: number }>) => {
    const info = text();
    const root = p("Click this text to update counter", {
        styles: {
          color: "red",
        },
        events: {
          click() {
            state.set((cur) => ({total: cur.total + 1}))
          }
        }
      },
      div(info, styles({color: "green"}))
    )
    state.onValueChange((obj) => {
      info.nodeValue = `Counter: ${obj.total}`;
    });
    return root;
  };

  function counter(state = createState({total: 0})) {
    const root = createNodes(state);
    // unmanaged click listener, will be removed when <div> returned counter() is removed from DOM tree
    const reset = button("Reset", events({
        click() {
          state.set({total: 0})
        }
      })
    );
    // connect subscribers
    // render content with state.refresh()
    state.updateUi();
    return div(root, reset);
  }

  return counter();
}
