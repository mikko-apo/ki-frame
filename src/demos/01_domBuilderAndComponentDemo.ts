import { Component } from "../component";
import { {button, div, text}: html } from "../domBuilder";
import { events } from "../domBuilderEvents";
import { styles } from "../domBuilderStyles";
import {html} from "../domBuilder";

export function domBuilderAndComponent() {
  function counter(total = 0) {
    const info = text();
    const setCount = (n: number) => {
      total = n;
      info.textContent = `Counter: ${n}`;
    };
    return new Component(
      {
        info,
        root: div(
          div("Click this text to update counter", {
            styles: {
              color: "red",
            },
            events: {
              click() {
                setCount(total + 1);
              },
            },
          }),
          div(info, styles({ color: "green" })),
          button(
            "Reset",
            events({
              click() {
                setCount(0);
              },
            }),
          ),
        ),
      },
      {
        functions: {
          setCount,
        },
      },
    );
  }

  const c = counter();
  c.functions.setCount(0);
  return c.node;
}
