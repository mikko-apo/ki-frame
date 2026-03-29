type EventHandler<TagName extends keyof HTMLElementTagNameMap, EventName extends keyof HTMLElementEventMap> = (params: {
  node: HTMLElementTagNameMap[TagName]
  event: HTMLElementEventMap[EventName]
}) => void

type EventHandlers<TagName extends keyof HTMLElementTagNameMap> = {
  [EventName in keyof HTMLElementEventMap]?: EventHandler<TagName, EventName>
}

export class EventHandlerObject<TagName extends keyof HTMLElementTagNameMap> {
  constructor(public readonly events: EventHandlers<TagName>) {}
}

export type EventsInput<TagName extends keyof HTMLElementTagNameMap> =
  | EventHandlers<TagName>
  | { events: EventHandlers<TagName> }

export function events<TagName extends keyof HTMLElementTagNameMap>(
  events: EventsInput<TagName>
): EventHandlerObject<TagName> {
  return new EventHandlerObject(events instanceof EventHandlerObject || 'events' in events ? events.events : events)
}

export function setEvents<TagName extends keyof HTMLElementTagNameMap>(
  node: HTMLElementTagNameMap[TagName],
  arg: EventsInput<TagName>
) {
  const ev = arg instanceof EventHandlerObject ? arg : events(arg)
  Object.entries(ev.events).forEach(([key, fn]) => {
    node.addEventListener(key, (event: any) => {
      fn?.({ node, event })
    })
  })
}
