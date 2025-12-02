<!-- TOC -->
* [How is the code linked to DOM nodes in memory?](#how-is-the-code-linked-to-dom-nodes-in-memory)
  * [Avoid: Top level const/let and setting value to window](#avoid-top-level-constlet-and-setting-value-to-window)
* [GC strategies](#gc-strategies)
* [Work in progress below this topic](#work-in-progress-below-this-topic)
  * [State broadcast events](#state-broadcast-events)
  * [State API](#state-api)
  * [No external dependencies -> automatic clean up with GC](#no-external-dependencies---automatic-clean-up-with-gc)
  * [Registered event sources and automatic cleanup on state.destroy()](#registered-event-sources-and-automatic-cleanup-on-statedestroy)
  * [createState({}, {weakRef: true})) and state.withStrongRefs(strongRefState => {...})](#createstate-weakref-true-and-statewithstrongrefsstrongrefstate--)
  * [Automatic cleanup](#automatic-cleanup)
  * [Event propagation and state data sharing](#event-propagation-and-state-data-sharing)
  * [Linked items](#linked-items)
  * [State and DOM node life cycle events](#state-and-dom-node-life-cycle-events)
    * [Pyramid shape for event propagation](#pyramid-shape-for-event-propagation)
    * [Hierarchy and grouping](#hierarchy-and-grouping)
  * [Sharing state data](#sharing-state-data)
<!-- TOC -->

# How is the code linked to DOM nodes in memory?

```mermaid
flowchart TD
    html["&lt;html>"] --> body["&ltbody>"] --> appDiv["&lt;div id=&quot;app&quot;>"] --> root
    initCode{{"<b>setElementToId('app', counter().root)</b><br>1. counter() creates counter's DOM nodes and attaches listeners<br>2. counter() calls state.refresh() to render initial values to counter's DOM nodes. State sends current value to onValueChange callbacks.<br>3. setElementToId() attaches root node to div with id 'app'"}}
    initCode -.->|" targetElement.replaceChildren(rootNode) "| appDiv
    initCode -.->|" state.refresh() "| state
    style initCode text-align: left

    subgraph "<b>ki-frame counter component: DOM nodes, listeners and state</b>"
        root["Root node: <b>&lt;p/></b><br>p.onclick= ()=> { <b>state</b>.modify(...)"] --> title["&lt;Text node> Click to update counter"]
        style root text-align: left
        root --> info["<b>info</b> &lt;Text node> Counter 0"]
        root -->|" Clicking p triggers state.modify(), which increments total "| state["<b>state</b><br>state.alue: {total: 0}<br>state.onChange[]; [(obj) => info.nodeValue = `Counter: ${obj.total}`]"]
        state -->|" state.modify() and state.refresh() send state.value to onChange callbacks.<br>infoText node's text is updated. "| info
        style state text-align: left
    end
```

When everything linked to the state is attached under a single DOM node, state will get cleaned up by the GC when the
root DOM node is removed from the main DOM tree. ki-frame has tools to support more complex scenarios where state
and events are shared between components, but the above approach should work for most cases.

For long-lived state objects, it might be beneficial to limit the creation of onChange() subscriptions. It's easy to
unsubscribe the onChange() subscriber, but it's difficult to maintain DOM node specific listeners over a complex code
base so leaks can become substantial if the onChange() is subscribed frequently for long-lived state objects.

## Avoid: Top level const/let and setting value to window

Following approaches create references that can't be GCed, avoid:

* top level javascript const/let: `<script> const obj = { foo: 123 }; </script>`
* setting value to window: `window.state = { value: 1 };`
* ES module top level const/let: `<script type="module">const myState = { foo: 1 };</script>` (if module is unloaded, GC
  can work)

# GC strategies

* Local
* Manual
    * manual state.destroy()
* Observer
    * MutationObserver -> state.destroy()
    * support reattach with delayed check
* RefMode
    * createState({..}, {weakRef: true})
        * all links to sources use weakRef and auto-unsubscribe
        * all links to targets use weakRef
        * state.withStrongRef(sameStateButUsesStrongRefs => {}) allows creation of strong refs for sources and targets

# Work in progress below this topic

## State broadcast events

* **valueChange**
    * state: State's value has changed
        * change is propagated to some linked states (pick, copy)
* **destroy**
    * state: state.destroy() has been called
        * State removes stored value
        * State removes all subscribers
        * Destroy is propagated to linked states and destroyable objects
            * destroyable objects can be fetch's abortable promises or any other
* **refreshUI**
    * UI should be refreshed, but state should not change
* **domRemove**
    * All known DOM elements should be removed with node.remove()
    * All listeners attached to known nodes should be unsubscribed

Usecases:

* Developer wants to remove all DOM nodes and state
    * attach all used states to rootState
    * attach rootDiv to state as removable
    * state.remove({dom: true, state: true})
* Developer wants to remove some DOM nodes and some state items

## State API

* state creation
    * shared
*

## No external dependencies -> automatic clean up with GC

For a single function the programming model is straightforward:

- **parameters**: state objects (with types and default value in the signature), channels, functions (subcribe to
  onChange, onDestroy, unsubscribe)
- **body**: DOM structure setup, (initialize state, ) connect subscribers, (render content with state.refresh())
- **return**: root node, newly created state objects (only if someone needs access), relevant nodes from testing

When the returned root node is removed from DOM, all ki-frame listeners and states are removed automatically by GC.

## Registered event sources and automatic cleanup on state.destroy()

ki-frame state can be attached to external event sources like DOM nodes (node.addEventListener()), callback based event
sources and other states. Most sources provide a way to unsubscribe and ki-frame supports automatic unsubscribe on
state.destroy() for many types.

```typescript
state.addDomEventInput("counter", nodes.root, "click", (ev) =>
  state.modify((cur) => ({total: cur.total + 1})),
);
state.destroy()
```

## createState({}, {weakRef: true})) and state.withStrongRefs(strongRefState => {...})

When state is created in weakRef mode, state creates all input (addDomEventInput, ...) and output (onValueChange, ...)
subscriptions with WeakRef and automatic unsubscribe. In strongRef mode, all dependencies are created with strong refs.

This allows the code to decide if the dependency should keep objects alive

|                                                      | createState({total: 0}, {weakRef: false}))                                                                                                | createState({total: 0}, {weakRef: true}))                                                                          |   |   |
|------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|---|---|
| state.addDomEventInput(name, node, event, fn): input | state is strongly attached to node with the subscribed fn -> keeps state and all the objects it refers to in use while the node is in use | state state is weakly referenced by node's listener -> GC can remove state if there are no strong references to it |   |   |
| state.onValueChange(fn: (value) => {...}): output    | state refers to fn strongly and keeps the fn pyramid in use                                                                               | state refers to fn weakly  -> GC can remove fn and the objects it refers to                                        |   |   |
|                                                      |                                                                                                                                           |                                                                                                                    |   |   |
|                                                      |                                                                                                                                           |                                                                                                                    |   |   |

```typescript
function counter(state = createState({total: 0}, {weakRef: true})) {
  const nodes = createNodes();
  // connect subscribers
  state.withStrongRefs(strongRefState => {
    strongRefState.addDomEventInput("counter", nodes.root, "click", (ev) =>
      state.modify((cur) => ({total: cur.total + 1})),
    );
  });
  state.onValueChange((obj) => {
    return (nodes.info.nodeValue = `Counter: ${obj.total}`);
  });
  // render content with state.refresh()
  state.refresh();
  return nodes;
}
```

ki-frame makes it easy to manage apps with complex user interfaces. It's easy to create tested and reusable components.
It's also easy to manage

To support dynamic applications ki-frame supports tree like structures
for states. Tree like structures make it possible to control parts of the tree, for example add or remove a form
separately or the full tree.

Browser garbage collection is able to automatically remove pyramid like shapes

There are also tools that support the automatic removal of the ki-frame run
time parts when UI DOM nodes are removed from the browser document.

ki-frame does most of the heavy lifting on its own, but it's good to understand how the concepts work together.

## Automatic cleanup

In following cases GC is able to remove the classes

```mermaid
flowchart TD
    html --> body --> div["&lt;div id='app'/>"]
    p["p.onclick=[()=> { <b>state</b>.modify(...)]"] --> info["<b>info</b>: Text node"]
    p --> state["<b>state</b><br>state.alue: {total: 0}<br>state.onChange = [(obj) => <b>info</b>.nodeValue = `Counter: ${obj.total}`]"] --> info

```

## Event propagation and state data sharing

Browser event listener based apps that are very fine-grained and functionality is distributed widely in to the DOM
nodes.

Event sources that cause ki-frame application functionality to run by sending **input** to ki-frame app

* User action in browser sends DOM event
* Browser sends event on its own
* Promises
* setTimeout and setInterval
* weakref removal

ki-frame functionality can be:

* change ki-frame configuration / state (internal)
    * change state value
    * add new state objects
    * remove state objects
* modify DOM (output)
    * add new DOM nodes/content
    * remove DOM nodes/content
    * add/remove listeners
    * modify DOM content
* start external process (output)
    * synchronous responds immediately
    * trigger async process (and wait for response): fetch

Graph shows how ki-frame

```mermaid
flowchart LR
    subgraph ki-frame internals
        ki-frame --> onChange["state.onChange()"]
        onChange --> internal{{<b>ki-frame internal</b><br>change state value<br>add new state objects<br>remove state objects}} --> ki-frame
    end
    subgraph Input
        User --> Browser --> domInput[DOM input nodes: onclick] -->|state . addEventListener| ki-frame
        Promises --> ki-frame
        setTimeoutInterval["setTimeout()<br>setInterval()"] --> ki-frame
    end
    subgraph Ouput
        onChange --> domOutput[add, remove or modify DOM nodes/content/listeners]
        onChange --> externalSync[start external synchronous/async process] --> ki-frame
    end

```

Each input event can trigger a chain of events that trigger various actions. A chain can branch to a number of
destinations, actions can form a pyramid where single input triggers various processes and actions and results in
changes in various locations.

ki-frame uses a few mechanisms to manage the complexity:

## Linked items

* stateA -> stateB
    * shared state value object, own linked items
    * shared state value object's path, own linked items
* stateA -> nodeA
* stateA -> stateB -> nodeB
* stateA -> fetchPromise


* DOM node
* Removable items
    * state value
    * linked states
    *

## State and DOM node life cycle events

### Pyramid shape for event propagation

With ki-frame, for many events it's possible to link items in pyramid shape. Pyramid shape makes it possible to easily
remove whole trees by removing for example the hub or root1. Removing root2 does not have an effect on items in root1.

refresh and destroy events are passed to the whole state tree, and the states will trigger refresh and destroy for all
linked states and items. onChange and domRemove can propagate to linked states and their items but by default they
don't.

```mermaid
flowchart TD
    root1 --> A
    root1 --> hub
    hub --> C
    hub --> D
    root2 --> E
    root2 --> F
```

### Hierarchy and grouping

1. State provides state.destroy() to remove the data value and close the state object for modification.
   state.onDestroy() and state.addToDestroy(destroyable) can be used to subscribe code for clean up, aborting and user
   information changes. When state.destroy() is called all destroy subscribers are notified and then subscriber are
   removed from the state.

```typescript
function onDestroyDemo() {
  const state = createState({total: 123})
  const info = (txt: string, s: State<Total>) => {
    const t = text()
    state.onChange(obj => t.nodeValue = `${txt}: ${obj.total}`)
    state.onDestroy(() => t.nodeValue = `${txt}: state destroyed`)
    return p(t);
  }
  const root = p(
    button(
      "Click me!",
      {onclick: state.destroy}
    ),
    info("1", state),
    info("2", state)
  );
  state.refresh(); // render initial data
  return root;
}
```

notes:

- state.destroy() does not send onChange() event
- If you have rootState and childState and you want to possibly destroy the childState separately, use
  childState.addToParentDestroy(rootState) to ensure that childState removes itself from the rootState's destroyable
  list when childState.destroy() is called.

1. In addition to onChange(), state supports channels that can be used to send typed messages to subscribers. Channels
   can be used to implement shared teardown etc functionality.

2. If you need fetch(), use fetchWithState():

3. If you need state with long-lived event listeners, timers, observables, promises, websockets, eventsource, workers,
   global
   caches/registries, object properties on long-lived objects etc use state.destroy() and state.onDestroy() to trigger
   cleanups. If you have different levels of hierarchy and cascading/recursive state.destroy(), use
   state.createAttachedState() and state.destroy() on suitable state.

## Sharing state data

|                     | Description                                    | States connect to shared value                      | Destroy propagates | onChange propagates  |
|---------------------|------------------------------------------------|-----------------------------------------------------|--------------------|----------------------|
| state.copy()        | Creates a copy fr                              |                                                     |                    | default: Both ways   |
| state.pick("field") | Selects a field from the original state.value. | Modifications are reflected on all connected states | By default         | All connected states |
|                     |                                                |                                                     |                    |                      |
