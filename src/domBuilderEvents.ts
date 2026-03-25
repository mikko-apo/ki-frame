type EventHandler<TagName extends keyof HTMLElementTagNameMap, EventName extends keyof HTMLElementEventMap> = (params: {
  node: HTMLElementTagNameMap[TagName]
  event: HTMLElementEventMap[EventName]
}) => void

type EventObject<TagName extends keyof HTMLElementTagNameMap> = {
  [EventName in keyof HTMLElementEventMap]?: EventHandler<TagName, EventName>
}

export class Events<TagName extends keyof HTMLElementTagNameMap> {
  constructor(public readonly events: EventObject<TagName>) {}
}

export type EventsInput<TagName extends keyof HTMLElementTagNameMap> =
  | EventObject<TagName>
  | { events: EventObject<TagName> }
  | Events<TagName>

export function events<TagName extends keyof HTMLElementTagNameMap>(events: EventsInput<TagName>): Events<TagName> {
  return new Events(events instanceof Events || 'events' in events ? events.events : events)
}

export function setEvents<TagName extends keyof HTMLElementTagNameMap>(
  node: HTMLElementTagNameMap[TagName],
  arg: EventsInput<TagName>
) {
  const ev = arg instanceof Events ? arg : events(arg)
  Object.entries(ev.events).forEach(([key, fn]) => {
    node.addEventListener(key, (event: any) => {
      fn?.({ node, event })
    })
  })
}
