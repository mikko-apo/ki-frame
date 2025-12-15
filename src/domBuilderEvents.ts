import {typedEntries} from "./util/typeUtils";

type EventHandler<TagName extends keyof HTMLElementTagNameMap, EventName extends keyof HTMLElementEventMap> =
  (params: { node: HTMLElementTagNameMap[TagName], event: HTMLElementEventMap[EventName] }) => void;

type EventObject<TagName extends keyof HTMLElementTagNameMap> = {
  [EventName in keyof HTMLElementEventMap]?: EventHandler<TagName, EventName>;
};

export class Events<TagName extends keyof HTMLElementTagNameMap> {
  constructor(public readonly events: EventObject<TagName>) {
  }
}

export type EventsInput<TagName extends keyof HTMLElementTagNameMap> =
  | EventObject<TagName>
  | { events: EventObject<TagName> }
  | Events<TagName>
  | EventsInput<TagName>[];

export function events<TagName extends keyof HTMLElementTagNameMap>(...inputs: EventsInput<TagName>[]): Events<TagName> {
  const out: EventObject<TagName> = {};

  const visit = <NK extends keyof HTMLElementTagNameMap>(input: EventsInput<NK>) => {
    if (Array.isArray(input)) {
      for (const i of input) visit(i);
    } else if (input instanceof Events || "events" in input) {
      Object.assign(out, input.events);
    } else {
      Object.assign(out, input);
    }
  };

  for (const input of inputs) visit(input);

  return new Events(out);
}

export function applyEvents<TagName extends keyof HTMLElementTagNameMap>(node: HTMLElementTagNameMap[TagName], arg: Events<TagName>) {
  typedEntries(arg.events).forEach(([key, fn]) => {
    node.addEventListener(key, (event: any) => {
      fn!!({node, event})
    });
  })
}
