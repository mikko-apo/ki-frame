**ki-frame**

ki-frame is a lightweight, all-in-one framework for building browser applications without abstracting the DOM away.
It provides an API layer that works with native browser APIs, offering structure where needed while keeping the platform
fully accessible. It simplifies common patterns while maintaining direct interaction with native features.

**note**: ki-frame is in active development and very unstable, so don't use it yet.

<!-- TOC -->

* [Sponsors](#sponsors)
* [Overview](#overview)
    * [domBuilder](#dombuilder)
    * [State](#state)
    * [Form](#form)
    * [Testing](#testing)
* [Roadmap](#roadmap)
* [How are you supposed to use this?](#how-are-you-supposed-to-use-this)
    * [Use fluent syntax for DOM trees](#use-fluent-syntax-for-dom-trees)
    * [Use createState()](#use-createstate)
    * [How to structure code?](#how-to-structure-code)
        * [Example: counter](#example-counter)
    * [Use state.fetch(url)](#use-statefetchurl)
    * [Use createFormState()](#use-createformstate)
    * [How to test?](#how-to-test)
* [What next?](#what-next)
* [Legend for icons](#legend-for-icons)

<!-- TOC -->

# Sponsors

# Overview

## domBuilder

A concise, expressive utility for constructing and managing DOM trees:

- Simple syntax for creating DOM nodes and hierarchies
- Optional extended API for common attributes and patterns

More information:

- documentation: [Use fluent syntax for DOM trees](#use-fluent-syntax-for-dom-trees)
- code: [domBuilder.ts](src/domBuilder.ts)

## State

**State** is the central mechanism of ki-frame. It unifies application logic and resource, state and event management
into a coherent model.

**State connects all the browser side components and app logic together**:

- Manages dom node event listeners, fetches, ...
- Maintains application structure and supports inspection and monitoring
- Provides a unified model for:
    - Working with DOM and browser APIs
    - Sharing state value and events across components/states (wip 🛠️)
        - States can be connected by hierarchy, state value and/or event propagation
        - Dispatching lifecycle events (`updateUi`, `destroy`, `stateChanged`)
        - Working with multiple connected states.

**State provides multiple strategies and tools for cleanup and lifecycle control**

- Local lifetimes
    - When a state is connected with a root DOM node and not shared externally, garbage collection can reclaim resources
      automatically
- Resource registration
    - DOM nodes, event listeners, fetches, and timeouts can be registered; all associated resources are released when
      `state.destroy()` is invoked
- Manual destruction
    - `state.destroy()` can be called by any code with refence to the state
- Linked states & cascading destruction
    - states can be linked together, when rootState.destroy() is called all linked states are destroyed
- `state.onRemoveDestroy(node)`
    - Automatically triggers `state.destroy()` when a linked DOM node is removed from DOM tree
- WeakRef-based fine-grained resource and link management

More information:

- source code: [state.ts](src/state.ts)
- createState
    - documentation: [Use createState()](#use-createstate)
    - demo: https://mikko-apo.github.io/ki-frame/#domBuilderWithState
- state.fetch()
    - documentation: [Use state.fetch(url)](#use-statefetchurl)
    - demo: https://mikko-apo.github.io/ki-frame/#fetch

## Form

A structured approach to form handling built on top of state:

- Per-input validation and type handling
- Collects input values into a typed state object
- Full-form validation supported by the same state infrastructure

More information::

- documentation: [Use createFormState()](#use-createformstate)
- source code: [form.ts](src/form.ts)
- demo: https://mikko-apo.github.io/ki-frame/#createFormState

## Testing

ki-frame supports various levels of testing in addition to automated browser tests:

- unit testing
    - ki-frame is composed with listener functions which can be easily unit tested
- snapshot tests
    - generated DOM tree
    - updated DOM tree
- headless integration testing with jsdom
    - components and even apps can be tested with jsdom.
    - DOM events can be triggered to simulate user actions in a browser

More information:

- documentation: [How to test?](#how-to-test)

# How are you supposed to use this?

## Use fluent syntax for DOM trees

1. Create DOM node trees with the fluent syntax
2. Extract a variable for each HTMLElement or Text node that you want access separately. Pass the nodes as variables how
   you want.
3. Each builder function creates the specified dom object and takes a list of parameters. Supported parameters are:
    * dom **HTMLElement** or **Text** instance is added with `.appendChild()`
    * **string** is added with `.appendChild(getDocument().createTextNode(arg))`
    * **arrays** are iterated recursively and each item is added to the object
    * **WrappedNode** is used by dom extension APIs and contains the resulting dom Node instance. Is added to the object
      with .appendChild(arg.node)
    * **object** which contains fields from HTMLElement and Text
        * fields containing a function and starting with "on" are added with `.addEventListener(event, value)`
        * otherwise the key and value is set with `.setAttribute(key, value)`

```typescript
import {a, p, setElementToId} from "./domBuilder";

const a1 = a("test link", {href: "/pow.html"});
setElementToId('app', p("POW!", a1, {onclick: () => console.log("pow!")}));
```

Checkout

* the more indepth demo at the demo site: https://mikko-apo.github.io/ki-frame#domBuilder
* source code [domBuilder.ts](src/domBuilder.ts)

## Use createState()

If you need state, use `createState({...})` to create a typed state object. It's ok to share the state object
reference inside the application to other functions and DOM nodes. Use `state.onChange()` to react to changes in state.

State supports following functions for setting and notifying of state change:

- `state.set(cur)` sets new state value
- `state.modify(fn: (old: ReadOnly<T>) => T)` fn() can create new state based on the old state
- `state.onChange(fn: (cur: ReadOnly<T>, old: ReadOnly<T>) => void): () => void` fn() can react to changes.
  `.onChange()`
  returns the unsubscribe function

Example component using domBuilder and `element.onclick`, see [example for state.addDomEvent](#example-counter)  for
more indepth
approach:

```typescript
const createNodes = () => {
  const info = text();
  const root = p("Click to update counter", info);
  return {info, root};
};

function counter(state = createState({total: 0})) {
  const nodes = createNodes();
  nodes.root.onclick = () => state.modify((cur) => ({total: cur.total + 1}));
  state.onValueChange((obj) => (nodes.info.nodeValue = `Counter: ${obj.total}`));
  state.refresh();
  return nodes;
}

setElementToId('app', counter().root);
```

Example above forms following DOM nodes:

- &lt;p/> with onclick
    - Text node: "Click to update counter"
    - Text node: ""

In the initialization code, state.refresh() calls state's onChange listeners and text is included in to the Text node:

- &lt;p/> with onclick
    - Text node: "Click to update counter"
    - Text node: "Counter: 0"

&lt;p/> is attached to page DOM as a child of element with id 'app'.

Clicking on p increments counter with the help of the state:

- &lt;p/> with onclick
    - Text node: "Click to update counter"
    - Text node: "Counter: 1"

Checkout

* the more indepth demos at the demo site: https://mikko-apo.github.io/ki-frame#createStateDemo
* source code [state.ts](src/state.ts)

## How to structure code?

There are two ways to create components with ki-frame:

* Dom tree first
    1. Define dom nodes that are going to be connected somehow
    2. **Define DOM tree with non-connected and connected nodes**
    3. Use states and forms to connect functionality to nodes
* Dom tree last
    1. Define dom nodes that are going to be connected somehow
    2. Use states and forms to connect functionality to nodes
    3. **Define DOM tree with non-connected and connected nodes**

**Dom structure** last might produce less code if the state and form APIs contain domBuilder functions for nodes that
are already attached to the state / form. Currently they don't, so both approaches are fairly equal in DX.
For [testing](#how-to-test) test granularity might benefit from either approach.

### Example: counter

For a single component:

- **parameters**: state objects (with types and default value in the signature), channels, functions (subcribe to
  onChange, onDestroy, unsubscribe)
- **body**: DOM structure setup, (initialize state,) connect subscribers, (render content with state.refresh())
- **return**: root node, newly created state objects (only if someone needs access), relevant nodes from testing

For reuse:

- extract DOM structure setup to its own function
- pass in state as parameter. other shared things can be given as parameters

For testing:

- extract subscribers to own functions and unit test each function separately
- snapshot DOM structure

Example:

```typescript
// DOM structure setup for testing
const createNodes = () => {
  const info = text();
  const root = p("Click to update counter", info);
  return {info, root};
};

function counter(state = createState({total: 0})) {
  const nodes = createNodes();
  // connect subscribers
  state.addDomEvent("counter", nodes.root, "click", () => state.modify((cur) => ({total: cur.total + 1})));
  state.onChange((obj) => (nodes.info.nodeValue = `Counter: ${obj.total}`));
  // render content with state.refresh()
  state.refresh();
  return nodes;
}
```

Check out the live demos at https://mikko-apo.github.io/ki-frame/#createFormState

## Use state.fetch(url)

state.fetch(url)

* by default assertOk option is true: return code needs to be 200-299. Promise handling raises an error is return code
  is something else
* it's good to define both ok and error handler with .then() `state.fetch(url).then(okCase, errorCase)`
* is attached to state for state.destroy() and is detached after fetch promise completes
* returns an object with {destroy: () => void} function that aborts the fetch
* supports timeout

**note**: example doesn't use state to store value. regular `let`is fine until you need to pass it to other components
or
return it for parent.

```typescript
export function fetchDemo() {
  const info = text("Not loaded");
  const b = button("Click me to fetch!");
  let counter = 0;

  const setText = (text: string) => (info.nodeValue = text);
  const handleError = (reason: unknown) =>
    setText(
      isErrorResponse(reason)
        ? `There was an error, response.status is ${reason.errorResponse.status}`
        : `There was an error, response.status is ${reason}`,
    );

  const state = createController();
  state.addDomEvent("start fetch", b, "click", () => {
    counter++;
    setText("Loading...");
    state.fetch("test.json", {timeoutMs: 1000}).then(() => setText(`Loaded ok.`), handleError);
  });

  return div(b, info);
}
```

Check out the live demos at https://mikko-apo.github.io/ki-frame/#fetch

## Use createFormState()

Check out the live demos at https://mikko-apo.github.io/ki-frame/#createFormState

## How to test?

[jsdom](https://github.com/jsdom/jsdom) makes it very easy to test ki-frame applications.

setJsdomApp() configures ki-frame to use jsdom for rendering DOM nodes and it setups a document
with "<div id='app'></div>". After calling ki-frame creates nodes works straight away and snapshots look like clean
HTML. .click() and its subscribers are processed synchronously in the background, so no need for awaits.

```typescript
describe("Example tests", () => {
  it("connected counter() and root.click()", () => {
    setJsdomApp();
    const {root, info} = counter(createState({total: 0}));
    expect(root).toMatchSnapshot();
    expect(info.nodeValue).toEqual("Counter: 0");
    root.click();
    expect(root).toMatchSnapshot();
    expect(info.nodeValue).toEqual("Counter: 1");
  });
});
```

Snapshot file contains the rendered HTML:

```javascript
// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

exports[`Example tests > connected counter() and root.click() 1`] = `
<p>
  Click to update counter
  Counter: 0
</p>
`;

exports[`Example tests > connected counter() and root.click() 2`] = `
<p>
  Click to update counter
  Counter: 1
</p>
`;
```

# Roadmap

- 0.0.1 <- Development is at this stage
- 0.1 First npm release
- 1.0
    - All planned items below:
    - Stable APIs
        - state, controller
            - state linking: events and data
            - event propagation
            - resource management
              - fetch, timeout
              - promise
        - context
          - defaults
          - states and app structure
          - logging
        - form
- 2.0 SSR

**Planned**

* state
    * logging of relevant things via context
    * unified model for sharing data, event signalling
        * to linked/child states
        * events (updateUi, destroy, stateChanged):
            * do/ignore
            * passthrough / prevent
        * linked state value:
            * share full original data, lens of original data, own data
            * state value from merged children
    * unified model for cleanup
        * owned resources: listeners, fetches, timeouts, ...
        * destroy event sent by default to child states
        * weakref/regular ref
    * gc/cleanup
        * weakReff️
        * onRemoveDestroy(node) - MutationObserver 
            * MutationObserver and WeakRef + FinalizationRegistry
        * assertions
            * allowedSources
                * limits the sources the state can be attached to
                * optional safety check that prevents errors
            * allowedTargets
            * state used after destroy()
                * error logging
                * return error
        * tooling
    * convert to class
    * root node event listener & delegation directly to listener
    * state.link() for attaching existing states together
        * prevent state circles
* context 🛠️
    * context contains
        * default configurations for created objects
        * document reference for domBuilder
        * links to created states
        * root id + main counter
        * centralized logging
    * provides connection point for improved developer tooling
        * tooling for inspecting created states and the related state values
            * whole app vs section vs component
        * monitoring
        * runtime configuration
        * send reports to server
* form
    * **bugs**
        * race condition when pressing enter on input field, submit handling is triggered before onkeyup
    * render initial values
        * createForm is not able to work without init state
        * initial state with partially set and non-set values with no visible errors
    * dynamic array of items
    * disable / exclude / remove field/group from state temporarily
    * reset to initial value
    * undo / redo for state
    * input id and name generation
    * two-way mapping, from init value to input string, from input string to state
    * simplify domEvent with domInput
        * default event and mapper based on input type
    * auto disable for fields when submit is being processed
    * improved validation API
        * prevent submit if validations are failing
        * async validators
        * read validation specification from dom node
        * composable validations
        * separate handling of validation success & failure, expose validation handling to root level
            * return value more understandable
        * state/group state available to field level
        * field validation issues available to root level
        * mapping errors as validation issues
* external event sources
    * fetch
        * retry strategy: retries, delay
        * does ki-frame need these both to work:
            * state.fetch(url).then(mapper)
            * state.fetch(url, {map: mapper})
    * timeout
        * execute fn and remove timeout before it triggers
    * XHR integration
        * abort
* router
    * tigher integration with browser urls
    * initialize application based on route parameters
    * control application url and actions based on user actions
    * port of https://github.com/mikko-apo/ki-router.js
* Standard Schema support
  * form validation
  * state validation
* classes and styles

**Bubbling under**

* state
    * propagation of refresh() and destroy() using a similar mechanism, maybe runtime parameter
        * state.refresh("all"|"linked"|"this")
        * state.destroy("all"|"linked"|"this")
        * maybe when linking parent and child state, the accepted events should be listed: {destroy: true, refresh:
          true,
          onchange: (state) => {...}}
            * default should be: {destroy: true, refresh: true}
        * maybe onChange should include onDestory subscription too
        * Create a diagram to explain how to changes and destroys work together
    * state operations
        * state.reducer()
        * state.pick()
        * state.merge()
    * generic promise support
        * should unattach from parentState once promise fulfills or rejects
* domBuilder
    * separate classic and extended api
        * better ways to add class, style, event handlers etc
            * Partial<HTMLElement> and Partial<Text> pollute builder function apis CreateElementArg, extended API can
              provide have more straightforward DX
    * Configure createElement partial attribute types with JSX.IntrinsicElements[T] to get props for HtmlElements
* form
    * group level validation: support for grouping inputs in to groups
    * Standard Schema support
* Advanced stuff
  * requestAnimationFrame - queue DOM reads and writes
  * Virtualize long lists - Provide or recommend a tiny virtualization helper for lists (windowing) to render only visible items.
  * IntersectionObserver - Lazy-load images/components when entering viewport.
  * Avoid heavy synchronous work on first paint - Defer non-essential JS until after interactive. Hydrate progressively or lazy-load components.
  * Use documentFragment and off-DOM construction for big updates - Build node trees in fragments and append once.
  * 
  * SSR
      * Not yet
      * domBuilder and state resource registration and jsdom can be used to collect data for SSR
      * the client side needs to be able to hydrate in place

# What next?

- [kiFrameprogrammingModel.md](doc/kiFrameprogrammingModel.md) documents the programming model more thoroughly
- [domCheatSheet.md](doc/browserApiCheatSheet.md) contains notes about the browser API, elements and events

# Legend for icons

| Icon | Description         |
|------|---------------------|
| ✅    | Done                |
| 🛠️  | Work in Progress    |
| 📅   | Planned             |
| 🤔   | Possible            |
| 🚫   | Not Going to Happen |
| 🔥   | Top priority        |
| ⭐    | Medium priority     |
| 🐢   | Low priority        |
