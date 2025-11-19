# ki-web

Lightweight browser framework for implementing SPAs. Code with DOM elements and listeners like it's 2010 again, but with
a functional approach.

# Features, status and todo per feature

* [domBuilder.ts](src/domBuilder.ts) - _wrapper for document.createElement() to create DOM trees fluently_
* [state.ts](src/state.ts) - _lightweight state management_
* validator - _lightweight zod clone for validating objects_
    * might better to use zod
* router - initialize application based on route parameters
    * port of https://github.com/mikko-apo/ki-router.js
    * work has not started
* headless testing
    * testing should be possible without a browser

# How are you supposed to use this?

1. create DOM node trees with the fluent syntax. Extract a variable for each HTMLElement or Text node that you want
   access
   separately. Pass the variables how you want.

```typescript
import {a, p, setElementToId} from "./domBuilder";

const a1 = a("test link", {href: "/pow.html"});
setElementToId('app', p("POW!", a1, {onclick: () => console.log("pow.html")}));
```

2. If you need state, use createState({}) to create a typed state object. It's ok to share the state object
   reference inside the application to other functions and DOM nodes. Use state.onChange() to react to changes in state.

   It's probably a good practice to maintain a pyramid kind of shape for the DOM nodes that use the state. When
   everything linked to the state is attached under a single DOM node, state will get cleaned up by the GC when the root
   DOM node is removed from the main DOM tree.

   For long-lived state objects, it might be beneficial to limit the creation of onChange() subscriptions. It's easy to
   unsubscribe the onChange() subscriber, but it's difficult to maintain DOM node specific listeners over a complex code
   base so leaks can become substantial if the onChange() is subscribed frequently for long-lived state objects.

```typescript
import {p, setElementToId, text} from "./domBuilder";
import {createState} from "./state";

function counter() {
  const state = createState({total: 0})

  function infoText(state: State<Total>) {
    const t = text()
    state.onChange(obj => t.nodeValue = `${obj.total}`)
    return t;
  }

  // renders initial content by triggering state.onChange() subscribers
  state.refresh();
  return p(
    "Total: ",
    infoText(state),
    {onclick: () => state.modify(cur => ({total: cur.total + 1}))}
  )
}

setElementToId('app', counter());
```

State supports following functions for setting and notifying of state change:

- state.set(cur)
- state.modify(fn: (old) => cur)
- state.onChange(fn: (cur, old) => void): () => void

3. State provides state.destroy() to remove the data value and close the state object for modification.
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
- If you have rootState and childState and you want to possible destroy the childState separately, use
  childState.addToParentDestroy(rootState) to ensure that childState removes itself from the rootState's destroyable
  list when childState.destroy() is called.

3. In addition to onChange(), state supports channels that can be used to send typed messages to subscribers. Channels
   can be used to implement shared teardown etc functionality.

3. If you need fetch(), use fetchWithState():

3. If you need state with long-lived event listeners, timers, observables, promises, websockets, eventsource, workers,
   global
   caches/registries, object properties on long-lived objects etc use state.destroy() and state.onDestroy() to trigger
   cleanups. If you have different levels of hierarchy and cascading/recursive state.destroy(), use
   state.createAttachedState() and state.destroy() on suitable state.

# TODO

* state: generic channels
* promiseToState: should unattach from parentState once promise fulfills or rejects
* state: Example for onclick -> fetch -> display
* state: Example for form
* Create a diagram to explain how to changes and destroys work together
* domBuilder: Add support for WrappedNode.getNode to enable helper apis for elements
* domBuilder: separate classic and extended api. extend text()
* domBuilder: Configure createElement partial attribute types with JSX.IntrinsicElements[T] to get props for
  HtmlElements
