"use strict";
(() => {
  // src/util/objectIdCounter.ts
  var runningId = 0;
  function createId(id) {
    return `${id}-${runningId++}`;
  }

  // src/channel.ts
  var Channel = class {
    constructor(name) {
      this.subs = /* @__PURE__ */ new Set();
      this.idTxt = (txt) => `${this.id}: ${txt}`;
      this.id = createId(name);
    }
    subscribe(fn) {
      this.subs.add(fn);
      return () => {
        this.unsubscribe(fn);
      };
    }
    subscribeFn() {
      return (fn) => this.subscribe(fn);
    }
    // subscribe once: handler auto-unsubscribe after first invocation
    once(fn) {
      const unsub = () => this.unsubscribe(wrapper);
      const wrapper = (...args) => {
        unsub();
        fn(...args);
      };
      this.subs.add(wrapper);
      return unsub;
    }
    unsubscribe(fn) {
      this.subs.delete(fn);
    }
    // synchronous publish — invokes handlers and doesn't wait for Promises
    publish(...args) {
      for (const fn of Array.from(this.subs)) {
        try {
          fn(...args);
        } catch (err) {
          console.error(this.idTxt(`Error in channel.publish() for '${this.id}':`), err);
        }
      }
    }
    // asynchronous publish — waits for all subscribers; rejects if any rejects
    async publishAsync(...args) {
      const promises = Array.from(this.subs).map(async (fn) => fn(...args));
      const settled = await Promise.allSettled(promises);
      const rejections = settled.filter((s2) => s2.status === "rejected");
      if (rejections.length) {
        const err = new Error(`${rejections.length} subscriber(s) failed`);
        err.details = rejections.map((r) => r.reason);
        throw err;
      }
    }
    destroy() {
      this.subs.clear();
    }
  };
  var ChannelRegistry = class {
    constructor() {
      this.map = /* @__PURE__ */ new Map();
    }
    get(name) {
      let ch = this.map.get(name);
      if (!ch) {
        ch = new Channel(String(name));
        this.map.set(name, ch);
      }
      return ch;
    }
    destroy() {
      for (const ch of this.map.values()) ch.destroy();
      this.map.clear();
    }
  };

  // src/form.ts
  var FormsInput = class {
    constructor(node, key, map2, validate) {
      this.node = node;
      this.key = key;
      this.map = map2;
      this.validate = validate;
    }
  };
  function formEvent(node, key, map2, validate) {
    return new FormsInput(node, key, map2, validate);
  }
  function collectFormsInputs(root) {
    const out = [];
    function visit(node, pathParts) {
      if (node == null) return;
      if (node instanceof FormsInput) {
        const path = pathParts.map((p2) => String(p2)).join(".");
        out.push([path, node]);
        return;
      }
      if (Array.isArray(node)) {
        for (let i2 = 0; i2 < node.length; i2++) {
          visit(node[i2], [...pathParts, i2]);
        }
        return;
      }
      if (typeof node === "object") {
        for (const key of Object.keys(node)) {
          visit(node[key], [...pathParts, key]);
        }
        return;
      }
    }
    visit(root, []);
    return out;
  }
  function readRaw(node) {
    var _a2;
    const anyNode = node;
    if ("value" in anyNode && typeof anyNode.value === "string") return anyNode.value;
    return String((_a2 = node.textContent) != null ? _a2 : "");
  }

  // src/promiseDestroy.ts
  var PromiseDestroy = class _PromiseDestroy {
    constructor(promise, destroy = () => {
    }) {
      this.promise = promise;
      this.destroy = destroy;
    }
    /**
     * Promise.then implementation. Can be used to map the response to another value
     *
     * - Delegates to the internal `response` promise.
     * - Returns a NEW FetchReturn whose `response` is the mapped promise.
     * - If no handlers are provided, returns `this` (typed via cast).
     */
    then(onfulfilled, onrejected) {
      if (!onfulfilled && !onrejected) {
        return this.promise;
      }
      return this.promise.then(onfulfilled, onrejected);
    }
    catch(onrejected) {
      if (!onrejected) {
        return this;
      }
      return this.promise.catch(onrejected);
    }
    finally(onfinally) {
      return this.promise.finally(onfinally);
    }
    get [Symbol.toStringTag]() {
      return _PromiseDestroy.name;
    }
    /**
     * Optional: explicit toString which mirrors Object.prototype.toString
     */
    toString() {
      return Object.prototype.toString.call(this);
    }
  };
  var _a;
  var TimeoutDestroyable = class {
    constructor(fn, timeout) {
      this.fn = fn;
      this.timeout = timeout;
      this.at = Date.now() + ((_a = this.timeout) != null ? _a : 0);
      this.id = setTimeout(this.fn, this.timeout);
    }
    destroy() {
      clearTimeout(this.id);
    }
  };
  var FetchDestroyable = class extends PromiseDestroy {
    constructor(url, timeoutMs, promise, destroy) {
      super(promise, destroy);
      this.url = url;
      this.timeoutMs = timeoutMs;
      this.promise = promise;
      this.destroy = destroy;
    }
  };

  // src/util/setByPath.ts
  function copyAndSet(obj, path, value) {
    const segments = Array.isArray(path) ? path.map((p2) => typeof p2 === "string" && /^\d+$/.test(p2) ? Number(p2) : p2) : path === "" ? [] : path.split(".").map((seg) => /^\d+$/.test(seg) ? Number(seg) : seg);
    if (segments.length === 0) return value;
    const parents = [];
    let cur = obj;
    parents.push(cur);
    for (const seg of segments) {
      cur = cur !== null && typeof cur === "object" ? cur[seg] : void 0;
      parents.push(cur);
    }
    let newChild = value;
    for (let i2 = segments.length - 1; i2 >= 0; i2--) {
      const key = segments[i2];
      const origParent = parents[i2];
      let newParent;
      if (Array.isArray(origParent)) {
        newParent = origParent.slice();
      } else if (origParent !== null && typeof origParent === "object") {
        newParent = { ...origParent };
      } else {
        newParent = typeof key === "number" ? [] : {};
      }
      if (Array.isArray(newParent) && typeof key === "number") {
        if (key >= newParent.length) {
          newParent.length = key + 1;
        }
      }
      newParent[key] = newChild;
      newChild = newParent;
    }
    return newChild;
  }

  // src/util/strongOrWeakSet.ts
  var StrongOrWeakSet = class {
    constructor(mode) {
      this.coerce = mode;
    }
    *all() {
      if (this.items) {
        for (const i2 of this.items) {
          if (i2 instanceof WeakRef) {
            const deref = i2.deref();
            if (deref === void 0) {
              this.items.delete(i2);
            } else {
              yield deref;
            }
          } else {
            yield i2;
          }
        }
      }
    }
    add(item, itemMode = this.coerce) {
      const weakRef = new WeakRef(item);
      const unsub = () => {
        const deref = weakRef.deref();
        if (deref) {
          this.delete(deref);
        }
      };
      for (const i2 of this.all()) {
        if (i2 === item) {
          return unsub;
        }
      }
      const newItem = itemMode === "weak" ? weakRef : item;
      if (!this.items) {
        this.items = /* @__PURE__ */ new Set();
      }
      this.items.add(newItem);
      return unsub;
    }
    delete(item) {
      if (this.items) {
        for (const i2 of this.items) {
          if (i2 instanceof WeakRef) {
            const deref = i2.deref();
            if (deref === void 0 || deref === item) {
              this.items.delete(i2);
            }
          } else {
            if (i2 === item) {
              this.items.delete(i2);
            }
          }
        }
        if (this.items.size === 0) {
          this.destroy();
        }
      }
    }
    destroy() {
      if (this.items) {
        this.items.clear();
        this.items = void 0;
      }
    }
  };
  var DestroyableSet = class extends StrongOrWeakSet {
    destroy() {
      for (const destroyable of this.all()) {
        try {
          destroyable.destroy();
        } catch (err) {
          console.error(`Error in destroying item`, err);
        }
      }
      super.destroy();
    }
  };

  // src/util/typeUtils.ts
  function isDefined(item) {
    return item !== void 0 && item !== null;
  }

  // src/state.ts
  function shallowEqual(a2, b2) {
    return a2 === b2;
  }
  var Context = class {
    constructor(parent, controllers = new DestroyableSet("weak")) {
      this.parent = parent;
      this.controllers = controllers;
    }
    createController(options) {
      const controller = new Controller(this, options);
      this.controllers.add(controller);
      return controller;
    }
    createState(initialValue, options) {
      const state = new State(this, initialValue, options);
      this.controllers.add(state);
      return state;
    }
    createForm(t, init, options) {
      const form2 = new FormState(this, t, init, options);
      this.controllers.add(form2);
      return form2;
    }
    destroy() {
      var _a2;
      (_a2 = this.parent) == null ? void 0 : _a2.controllers.delete(this);
      this.controllers.destroy();
    }
  };
  var Controller = class extends Context {
    constructor(parent, options) {
      super(parent, new DestroyableSet());
      this._destroyed = false;
      this.registeredSources = new DestroyableSet();
      this.onDestroyListeners = new DestroyableSet();
      this.linkedStates = /* @__PURE__ */ new Set();
      this.eventSources = [];
      const { name = "state", weakRef = false } = options != null ? options : {};
      this.options = { name, weakRef };
      this._stateId = createId(name);
    }
    getOutputChannel() {
      if (!isDefined(this.outputChannel)) {
        this.outputChannel = new Channel(`${this.stateId}-onChange`);
      }
      return this.outputChannel;
    }
    get stateId() {
      return this._stateId;
    }
    get destroyed() {
      return this._destroyed;
    }
    idTxt(txt) {
      return `${this.stateId}: ${txt}`;
    }
    describe() {
      return {
        name: this.stateId
      };
    }
    updateUi() {
      if (this.outputChannel) {
        this.outputChannel.publish({ type: "updateUi" });
      }
    }
    subscribe(cb) {
      if (this.destroyed) throw new Error(this.idTxt("Cannot subscribe to destroyed state"));
      return this.getOutputChannel().subscribe(cb);
    }
    addLinkedState(controller, options) {
      this.linkedStates.add({ controller, ...options || {} });
    }
    onDestroy(target) {
      if (typeof target === "function") {
        if (this.destroyed) {
          target();
          return () => {
          };
        }
        const info = {
          type: "function",
          destroy: target
        };
        return this.onDestroyListeners.add(info);
      } else {
        if (this.destroyed) {
          target.destroy();
          return () => {
          };
        }
        return this.onDestroyListeners.add(target);
      }
    }
    /** Notify onDestroy() subscribers and call .destroy() for all attached states.
     * For an attached state also removes the state from parent.
     * Safe to call multiple times.
     **/
    destroy() {
      var _a2, _b;
      super.destroy();
      if (this.destroyed) return;
      this._destroyed = true;
      for (const linkedState of Array.from(this.linkedStates)) {
        if (!isDefined((_a2 = linkedState == null ? void 0 : linkedState.events) == null ? void 0 : _a2.destroy) || linkedState.events.destroy) {
          linkedState.controller.destroy();
        }
      }
      this.registeredSources.destroy();
      this.onDestroyListeners.destroy();
      for (const es of this.eventSources) {
        if (es.weakRefUnsub) {
          const unsub = es.weakRefUnsub.deref();
          if (unsub) unsub();
          es.weakRefUnsub = void 0;
        }
        if (es.unsub) {
          es.unsub();
        }
        es.source = void 0;
      }
      (_b = this.outputChannel) == null ? void 0 : _b.destroy();
      this.eventSources.length = 0;
    }
    addDomEvent(name, node, type, listener, options) {
      node.addEventListener(type, listener, options);
      const unsub = () => node.removeEventListener(type, listener, options);
      if (this.options.weakRef) {
        this.eventSources.push({
          name: `${name}: <${node.nodeName}>.${type} -> ${this.stateId}`,
          type: "dom",
          source: new WeakRef(node),
          weakRefUnsub: new WeakRef(unsub)
        });
      } else {
        this.eventSources.push({
          name: `${name}: <${node.nodeName}>.${type} -> ${this.stateId}`,
          type: "dom",
          source: new WeakRef(node),
          unsub
        });
      }
      return unsub;
    }
    timeout(fn, at = 0) {
      const unregisterDestroyableAndCallItsDestroy = this.registeredSources.add(
        new TimeoutDestroyable(() => {
          unregisterDestroyableAndCallItsDestroy();
          fn();
        }, at)
      );
      return unregisterDestroyableAndCallItsDestroy;
    }
    fetch(url, fetchOptions) {
      const { timeoutMs, map: map2, assertOk = true, ...fetchInit } = fetchOptions != null ? fetchOptions : {};
      const createAbortController = (destroy) => {
        const abortController2 = new AbortController();
        const destroyAbortController2 = () => {
          timeoutUnsub();
          abortController2.abort();
          destroy();
        };
        const timeoutUnsub = this.timeout(destroyAbortController2, timeoutMs);
        return [abortController2, destroyAbortController2];
      };
      const [abortController, destroyAbortController] = isDefined(timeoutMs) ? createAbortController(() => unregisterDestroyableAndCallItsDestroy()) : [];
      const response = fetch(url, { ...fetchInit, signal: abortController == null ? void 0 : abortController.signal });
      const maybeOkResponse = assertOk ? response.then((response2) => {
        if (typeof assertOk === "function" && assertOk(response2) === false || !response2.ok) {
          const cause = { errorResponse: response2 };
          throw cause;
        }
        return response2;
      }) : response;
      const unregisterDestroyableAndCallItsDestroy = this.registeredSources.add(
        new FetchDestroyable(url, timeoutMs, maybeOkResponse, () => {
          unregisterDestroyableAndCallItsDestroy();
          destroyAbortController == null ? void 0 : destroyAbortController();
        })
      );
      maybeOkResponse.finally(unregisterDestroyableAndCallItsDestroy);
      if (map2) {
        const mappedPromise = (async () => {
          return map2(maybeOkResponse);
        })();
        return new PromiseDestroy(mappedPromise, unregisterDestroyableAndCallItsDestroy);
      }
      return new PromiseDestroy(maybeOkResponse, unregisterDestroyableAndCallItsDestroy);
    }
  };
  var State = class extends Controller {
    constructor(parent, initialValue, options) {
      super(parent, options);
      this.value = initialValue;
    }
    get() {
      if (this.destroyed) throw new Error(this.idTxt("State destroyed. Cannot get value"));
      return this.value;
    }
    getOnChange() {
      if (!isDefined(this.onChange)) {
        this.onChange = new Channel(`${this.stateId}-onChange`);
      }
      return this.onChange;
    }
    set(newObj) {
      if (this.destroyed) throw new Error(this.idTxt("State destroyed. Cannot set value"));
      const old = this.value;
      if (shallowEqual(old, newObj)) return;
      this.value = newObj;
      this.getOnChange().publish(newObj, old);
    }
    modify(fn) {
      if (this.destroyed) throw new Error(this.idTxt("State destroyed. Cannot modify"));
      const next = fn(this.value);
      this.set(next);
    }
    onValueChange(cb) {
      if (this.destroyed) throw new Error(this.idTxt("Cannot subscribe to destroyed state"));
      return this.getOnChange().subscribe(cb);
    }
    destroy() {
      var _a2;
      super.destroy();
      (_a2 = this.onChange) == null ? void 0 : _a2.destroy();
    }
  };
  var FormState = class extends State {
    constructor(parent, t, init, options) {
      const { validate, ...stateOptions } = options || {};
      super(parent, init, stateOptions);
      const inputs = collectFormsInputs(t);
      if (validate) {
        const validInputValuesState = this.createState(init, { name: "valid input values" });
        validInputValuesState.onValueChange((newState) => {
          if (!validate(newState)) {
            return;
          }
          this.set(newState);
        });
        this.attachListeners(validInputValuesState, inputs);
      } else {
        this.attachListeners(this, inputs);
      }
    }
    attachListeners(inputState, inputs) {
      for (const [path, input2] of inputs) {
        inputState.addDomEvent(path, input2.node, input2.key, (ev) => {
          const value = input2.map ? input2.map(readRaw(input2.node)) : readRaw(input2.node);
          if (input2.validate && !input2.validate(value, input2.node, ev)) {
            return;
          }
          const newState = copyAndSet(inputState.get(), path, value);
          inputState.set(newState);
        });
      }
    }
    onsubmit(root, listener, options) {
      return this.addDomEvent(
        "submit",
        root,
        "submit",
        (ev) => {
          ev.preventDefault();
          listener(ev);
        },
        options
      );
    }
  };

  // src/index.ts
  var defaultContext = new Context();
  var getDefaultContext = () => defaultContext;
  var createController = defaultContext.createController.bind(defaultContext);
  var createState = defaultContext.createState.bind(defaultContext);
  var createForm = defaultContext.createForm.bind(defaultContext);

  // src/types.ts
  var WrappedNode = class {
    constructor(node) {
      this._node = node;
    }
    get node() {
      return this._node;
    }
  };

  // src/domBuilder.ts
  function addItems(element, ...args) {
    args.forEach((arg) => {
      if (Array.isArray(arg)) {
        addItems(element, ...arg);
      } else if (isNode(arg)) {
        element.appendChild(arg);
      } else if (arg instanceof WrappedNode) {
        element.appendChild(arg.node);
      } else if (typeof arg === "string") {
        element.appendChild(getDocument().createTextNode(arg));
      } else if (typeof arg === "object") {
        Object.keys(arg).forEach((key) => {
          const argValue = arg[key];
          if (key.startsWith("on") && typeof argValue === "function") {
            const event = key.substring(2).toLowerCase();
            element.addEventListener(event, argValue);
          } else {
            element.setAttribute(key, argValue);
          }
        });
      }
    });
  }
  var doc = typeof document !== "undefined" ? document : void 0;
  var isNode = (e) => {
    return typeof document !== "undefined" && !![HTMLElement, Text].find((value) => e instanceof value);
  };
  function getDocument() {
    if (doc) {
      return doc;
    }
    throw new Error("document is undefined");
  }
  function createElement(tagNameOrElement, ...args) {
    const element = getDocument().createElement(tagNameOrElement);
    addItems(element, ...args);
    return element;
  }
  var createElementFn = (tagName) => (...args) => createElement(tagName, ...args);
  var a = createElementFn("a");
  var abbr = createElementFn("abbr");
  var address = createElementFn("address");
  var area = createElementFn("area");
  var article = createElementFn("article");
  var aside = createElementFn("aside");
  var audio = createElementFn("audio");
  var b = createElementFn("b");
  var base = createElementFn("base");
  var bdi = createElementFn("bdi");
  var bdo = createElementFn("bdo");
  var blockquote = createElementFn("blockquote");
  var body = createElementFn("body");
  var br = createElementFn("br");
  var button = createElementFn("button");
  var canvas = createElementFn("canvas");
  var caption = createElementFn("caption");
  var cite = createElementFn("cite");
  var code = createElementFn("code");
  var col = createElementFn("col");
  var colgroup = createElementFn("colgroup");
  var data = createElementFn("data");
  var datalist = createElementFn("datalist");
  var dd = createElementFn("dd");
  var del = createElementFn("del");
  var details = createElementFn("details");
  var dfn = createElementFn("dfn");
  var dialog = createElementFn("dialog");
  var div = createElementFn("div");
  var dl = createElementFn("dl");
  var dt = createElementFn("dt");
  var em = createElementFn("em");
  var embed = createElementFn("embed");
  var fieldset = createElementFn("fieldset");
  var figcaption = createElementFn("figcaption");
  var figure = createElementFn("figure");
  var footer = createElementFn("footer");
  var form = createElementFn("form");
  var h1 = createElementFn("h1");
  var h2 = createElementFn("h2");
  var h3 = createElementFn("h3");
  var h4 = createElementFn("h4");
  var h5 = createElementFn("h5");
  var h6 = createElementFn("h6");
  var head = createElementFn("head");
  var header = createElementFn("header");
  var hgroup = createElementFn("hgroup");
  var hr = createElementFn("hr");
  var html = createElementFn("html");
  var i = createElementFn("i");
  var iframe = createElementFn("iframe");
  var img = createElementFn("img");
  var input = createElementFn("input");
  var ins = createElementFn("ins");
  var kbd = createElementFn("kbd");
  var label = createElementFn("label");
  var legend = createElementFn("legend");
  var li = createElementFn("li");
  var link = createElementFn("link");
  var main = createElementFn("main");
  var map = createElementFn("map");
  var mark = createElementFn("mark");
  var menu = createElementFn("menu");
  var meta = createElementFn("meta");
  var meter = createElementFn("meter");
  var nav = createElementFn("nav");
  var noscript = createElementFn("noscript");
  var object = createElementFn("object");
  var ol = createElementFn("ol");
  var optgroup = createElementFn("optgroup");
  var option = createElementFn("option");
  var output = createElementFn("output");
  var p = createElementFn("p");
  var picture = createElementFn("picture");
  var pre = createElementFn("pre");
  var progress = createElementFn("progress");
  var q = createElementFn("q");
  var rp = createElementFn("rp");
  var rt = createElementFn("rt");
  var ruby = createElementFn("ruby");
  var s = createElementFn("s");
  var samp = createElementFn("samp");
  var script = createElementFn("script");
  var search = createElementFn("search");
  var section = createElementFn("section");
  var select = createElementFn("select");
  var slot = createElementFn("slot");
  var small = createElementFn("small");
  var source = createElementFn("source");
  var span = createElementFn("span");
  var strong = createElementFn("strong");
  var style = createElementFn("style");
  var sub = createElementFn("sub");
  var summary = createElementFn("summary");
  var sup = createElementFn("sup");
  var table = createElementFn("table");
  var tbody = createElementFn("tbody");
  var td = createElementFn("td");
  var template = createElementFn("template");
  var textarea = createElementFn("textarea");
  var tfoot = createElementFn("tfoot");
  var th = createElementFn("th");
  var thead = createElementFn("thead");
  var time = createElementFn("time");
  var title = createElementFn("title");
  var tr = createElementFn("tr");
  var track = createElementFn("track");
  var u = createElementFn("u");
  var ul = createElementFn("ul");
  var varE = createElementFn("var");
  var video = createElementFn("video");
  var wbr = createElementFn("wbr");
  var text = (arg = "") => getDocument().createTextNode(String(arg));
  function setElementToId(targetId, element) {
    const targetElement = getDocument().getElementById(targetId);
    if (targetElement) {
      targetElement.replaceChildren(element);
    } else {
      console.error(`Target element with ID "${targetId}" not found!`);
    }
  }

  // src/demos/01_domBuilderStateDemo.ts
  function domBuilderWithState() {
    const createNodes = () => {
      const info = text();
      const root = p("Click to update counter", info);
      return { info, root };
    };
    function counter(state = createState({ total: 0 })) {
      const nodes = createNodes();
      state.addDomEvent("counter", nodes.root, "click", (ev) => state.modify((cur) => ({ total: cur.total + 1 })));
      state.onValueChange((obj) => {
        nodes.info.nodeValue = `Counter: ${obj.total}`;
      });
      state.updateUi();
      return nodes;
    }
    return counter().root;
  }

  // src/fetch.ts
  function isErrorResponse(item) {
    return "errorResponse" in item;
  }

  // src/demos/02_fetchDemo.ts
  function fetchDemo() {
    const info = text("Not loaded");
    const b2 = button("Click me to fetch!");
    let counter = 0;
    const setText = (s2) => info.nodeValue = s2;
    const handleError = (reason) => setText(
      isErrorResponse(reason) ? `There was an error, response.status is ${reason.errorResponse.status}` : `There was an error, response.status is ${reason}`
    );
    const state = createController();
    state.addDomEvent("start fetch", b2, "click", () => {
      counter++;
      setText("Loading...");
      state.fetch("test.json", { timeoutMs: 1e3 }).then(() => setText(`Loaded ok.`), handleError);
    });
    return div(b2, info);
  }

  // src/demos/03_formDemo.ts
  function createFormStateDemo(init = { a: 23, b: 10 }) {
    const i1 = input();
    const i2 = input();
    const info = pre();
    const root = form("Input 1", i1, "Input 2", i2, input({ type: "submit", value: "Submit" }), info);
    const log = (s2) => info.append(`${s2}
`);
    const isDividable = (prefix, divider) => {
      return (n) => {
        const isOk = n % divider === 0;
        if (isOk) {
          return true;
        }
        log(`${prefix} ${n} is not dividable by ${divider}`);
        return false;
      };
    };
    const formData = createForm(
      {
        a: formEvent(i1, "keyup", (s2) => Number(s2), isDividable("a", 10)),
        b: formEvent(i2, "keyup", (s2) => Number(s2), isDividable("b", 5))
      },
      init,
      {
        validate: ({ a: a2, b: b2 }) => {
          const isOk = a2 + b2 === 15;
          if (isOk) {
            log(`Form full state validation: ${a2} + ${b2}=${a2 + b2} is 15!`);
            return true;
          }
          log(`Form full state validation : ${a2} + ${b2}=${a2 + b2} is not 15`);
          return false;
        }
      }
    );
    formData.onValueChange(({ a: a2, b: b2 }) => {
      log(`Form data set to: a:${a2} b:${b2}`);
    });
    formData.onsubmit(root, (ev) => {
      const { a: a2, b: b2 } = formData.get();
      log(`Form submitted ${a2} ${b2}`);
    });
    formData.updateUi();
    return root;
  }

  // src/demos/channelsDemo.ts
  function channelsDemo() {
    const state = createState({ total: 0 });
    const channels = new ChannelRegistry();
    const channel = channels.get("test");
    let num = 0;
    state.onDestroy(() => {
      root.replaceChildren(t1);
      t1.nodeValue = "T1, not destroyed!";
    });
    channel.subscribe((payload) => {
      t1.nodeValue = `Counter ${payload.num}`;
    });
    state.updateUi();
    const t1 = text("T1");
    const root = p(
      p("Click me to send message!", {
        onclick: () => channel.publish({ num: num++ })
      }),
      t1
    );
    return root;
  }

  // src/demos/simpleDemos.ts
  function basicCounter() {
    const state = createState({ total: 0 });
    function infoText(state2) {
      const t = text();
      state2.onValueChange((obj) => t.nodeValue = `${obj.total}`);
      return t;
    }
    state.updateUi();
    return p("Total: ", infoText(state), {
      onclick: () => state.modify((cur) => ({ total: cur.total + 1 }))
    });
  }

  // src/demos/simpleFormDemo.ts
  function simpleForm() {
    const domTextInput = (state, name, node, key, validate) => state.addDomEvent(name, node, "keyup", (ev) => {
      if (validate) {
        if (validate(node.value)) {
          return;
        }
      }
      state.modify((cur) => ({ ...cur, [key]: node.value }));
    });
    function simpleForm2(formData = createState({ a: "23", b: "234" })) {
      const i1 = input();
      const i2 = input();
      const info = pre();
      const root = form("Input 1", i1, "Input 2", i2, input({ type: "submit", value: "Submit" }), info);
      const log = (s2) => {
        info.append(`${s2}
`);
        return true;
      };
      domTextInput(formData, "i1", i1, "a");
      domTextInput(
        formData,
        "i2",
        i2,
        "b",
        (v) => v.length % 2 == 0 && log(`b value '${v}' has wrong length ${v.length}`)
      );
      formData.onValueChange(({ a: a2, b: b2 }) => {
        i1.value = a2;
        i2.value = b2;
        log(`Form data: ${a2} ${b2}`);
      });
      const submitController = createController();
      submitController.addDomEvent("submit", root, "submit", (ev) => {
        ev.preventDefault();
        const { a: a2, b: b2 } = formData.get();
        log(`Form submitted ${a2} ${b2}`);
      });
      formData.updateUi();
      return root;
    }
    return simpleForm2();
  }

  // src/demos/stateOnDestroyDemo.ts
  function onDestroyTwoNodes() {
    const state = createState({ total: 123 });
    const info = (txt, s2) => {
      const t = text();
      s2.onValueChange((obj) => t.nodeValue = `${txt}: ${obj.total}`);
      s2.onDestroy(() => t.nodeValue = `${txt}: state destroyed`);
      return p(t);
    };
    const root = p(button("Click me!", { onclick: state.destroy }), info("1", state), info("2", state));
    state.updateUi();
    return root;
  }
  function onDestroyParentDemo() {
    const parent = createState({});
    const state = createState({ total: 0 });
    state.onDestroy(() => {
      root.replaceChildren(stateInfo, parentInfo);
      stateInfo.nodeValue = "State destroyed!";
    });
    parent.onDestroy(() => {
      parentInfo.nodeValue = "Parent was destroyed!";
    });
    parent.onDestroy(state);
    state.updateUi();
    const stateInfo = text("State ready");
    const parentInfo = text("Parent ready");
    const root = p(p("Not destroyed. Click me!", { onclick: parent.destroy }), stateInfo, parentInfo);
    return root;
  }

  // src/demos/stateTimeoutDemo.ts
  function stateTimeoutDemo() {
    const b1 = button("Click me!");
    const state = createController();
    state.addDomEvent("start timeout", b1, "click", (ev) => {
      b1.textContent = "Waiting...";
      state.timeout(() => b1.textContent = "Ready!", 1e3);
    });
    return div(b1);
  }

  // src/demos/ki-frame-demo.ts
  var demo = (title2, fn) => ({ title: title2, fn });
  var demos = [
    demo("testable counter", domBuilderWithState),
    demo("fetch examples", fetchDemo),
    demo("form handling with createFormState", createFormStateDemo),
    demo("counter(), naive 2010 DOM node version", basicCounter),
    demo("onDestroyDemo", onDestroyTwoNodes),
    demo("onDestroyParentDemo", onDestroyParentDemo),
    demo("channelsDemo", channelsDemo),
    demo("simple form - form handling with state", simpleForm),
    demo("timeout example", stateTimeoutDemo)
  ];
  function demolist(demos2) {
    const demoRowFunctionStringSearchIndex = demos2.map((demo2) => demo2.fn.toString().toLowerCase());
    const rows = demos2.map((demo2) => {
      const target = td();
      const src = td();
      const launchDemo = button(`Launch ${demo2.fn.name}`, {
        onclick: () => {
          target.replaceChildren(demo2.fn());
          src.replaceChildren(pre(demo2.fn.toString()));
        }
      });
      const row = tr(td(launchDemo, br(), demo2.title), target, src);
      row.style = "vertical-align: baseline";
      return row;
    }, demo);
    function filterDemos(s2) {
      const searchString = s2.toLowerCase().trim();
      demoRowFunctionStringSearchIndex.forEach((demoFn, index) => {
        if (searchString.length > 2) {
          rows[index].hidden = demoFn.indexOf(searchString) === -1;
        }
        if (searchString.length == 0) {
          rows[index].hidden = false;
        }
      });
    }
    const state = createController();
    const search2 = input({ type: "search", value: location.hash.substring(1) });
    state.addDomEvent("search", search2, "keyup", () => {
      const s2 = search2.value;
      location.hash = s2;
      filterDemos(s2);
    });
    filterDemos(location.hash.substring(1));
    return div(
      search2,
      hr(),
      table(rows),
      hr(),
      button("log context", {
        onclick: () => {
          if (window.gc) {
            const original = Array.from(getDefaultContext().controllers.all()).length;
            window.gc();
            console.log(
              `Ran window.gc(). Controller count before ${original} after ${Array.from(getDefaultContext().controllers.all()).length}`
            );
          }
          console.log(getDefaultContext());
        }
      })
    );
  }
  setElementToId("app", demolist(demos));
})();
