# ki-web

Lightweight browser framework for implementing SPAs.

# Features, status and todo per feature

* [domBuilder.ts](src/domBuilder.ts) - _wrapper for document.createElement() to create DOM trees fluently_
    * TODO
        * Configure createElement partial attribute types with JSX.IntrinsicElements[T] to get b
* [state.ts](src/state.ts) - _lightweight state management_
* validator - _lightweight zod clone for validating objects_
    * work has not started
* router - initialize application based on route parameters
    * port of https://github.com/mikko-apo/ki-router.js
    * work has not started
* headless testing
    * testing should be possible without a browser

# How are you supposed to use this?

1. create DOM node trees with the fluent syntax. For each HTMLElement or Text node that you want to read or write later
   on, extract a
   variable and use the HTMLElement's fields and functions as you want. Pass the variable how you like.

```typescript
import {a, p, setElementToId} from "./domBuilder";

const a1 = a("test link", {href: "/pow.html"});
setElementToId('app', p("POW!", a1, {onclick: () => console.log("pow.html")}));
```

2. If you need state, just create it. Everything is attached to DOM, as long as you don't attach to anything long-lived,
   browser GC should clear everything if elements are removed from DOM at some point.

```typescript
import {p, setElementToId, text} from "./domBuilder";
import {createState} from "./state";

function getBody() {
  const state = createState({total: 0})
  const t = text()
  state.onChange(obj => t.nodeValue = `${obj.total}`)
  // renders content with with state.onChange()
  state.refresh();
  return p(
    "Total: ",
    t,
    {onclick: () => state.modify(cur => ({total: cur.total + 1}))}
  );
}

setElementToId('app', getBody());
```

3. If you need state with long-lived event listeners, timers, observables, promises, websockets, eventsource, workers, global
   caches/registries, object properties on long-lived objects etc use state.destroy() and state.onDestroy() to trigger
   cleanups. If you have different levels of hierarchy and cascading/recursive state.destroy(), use
   state.createAttachedState() and state.destroy() on suitable state.
