"use strict";
(() => {
  // src/util.ts
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

  // src/state.ts
  function shallowEqual(a2, b3) {
    return a2 === b3;
  }
  function createController(options) {
    const { name = "state", weakRef = false } = options != null ? options : {};
    const stateId = createId(name);
    const getId = () => stateId;
    let destroyed = false;
    const onChange = new Channel(`${stateId}-onChange`);
    const onDestroy = new Channel(`${stateId}-onDestroy`);
    const destroyables = /* @__PURE__ */ new Set();
    const notifyChange = () => onChange.publish();
    const idTxt = (txt) => `${stateId}: ${txt}`;
    const eventListeners = [];
    const eventSources = [];
    const state = {
      getId,
      isDestroyed() {
        return destroyed;
      },
      describe() {
        return {
          eventListeners,
          name: stateId
        };
      },
      refresh() {
        notifyChange();
      },
      onValueChange(cb) {
        if (destroyed) throw new Error(idTxt("Cannot subscribe to destroyed state"));
        return onChange.subscribe(cb);
      },
      onDestroy(cb) {
        if (destroyed) {
          cb();
          return () => {
          };
        }
        return onDestroy.subscribe(cb);
      },
      addToDestroy(target) {
        if (destroyed) {
          target.destroy();
          return () => {
          };
        }
        destroyables.add(target);
        return () => destroyables.delete(target);
      },
      addToParentDestroy(parent) {
        return state.onDestroy(parent.addToDestroy(state));
      },
      /** Notify onDestroy() subscribers and call .destroy() for all attached states.
       * For an attached state also removes the state from parent.
       * Safe to call multiple times.
       **/
      destroy() {
        if (destroyed) return;
        destroyed = true;
        onDestroy.publish();
        for (const destroyable of Array.from(destroyables)) {
          try {
            destroyable.destroy();
          } catch (err) {
            console.error(idTxt(`Error in state.destroy()`), err);
          }
        }
        destroyables.clear();
        onChange.destroy();
        onDestroy.destroy();
        for (const es of eventSources) {
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
      },
      addDomEvent(name2, node, type, listener, options2) {
        node.addEventListener(type, listener, options2);
        const unsub = () => node.removeEventListener(type, listener, options2);
        if (weakRef) {
          eventSources.push({
            name: `${name2}: <${node.nodeName}>.${type} -> ${stateId}`,
            type: "dom",
            source: new WeakRef(node),
            weakRefUnsub: new WeakRef(unsub)
          });
        } else {
          eventSources.push({
            name: `${name2}: <${node.nodeName}>.${type} -> ${stateId}`,
            type: "dom",
            source: new WeakRef(node),
            unsub
          });
        }
      }
    };
    return state;
  }
  function createState(initialValue, options) {
    const controller = createController(options);
    let value = initialValue;
    const onChange = new Channel(`${controller.getId()}-onChange`);
    const notifyChange = (newV, oldV) => onChange.publish(newV, oldV);
    const idTxt = (txt) => `${controller.getId()}: ${txt}`;
    const state = {
      ...controller,
      get() {
        if (controller.isDestroyed()) throw new Error(idTxt("State destroyed. Cannot get value"));
        return value;
      },
      set(newObj) {
        if (controller.isDestroyed()) throw new Error(idTxt("State destroyed. Cannot set value"));
        const old = value;
        if (shallowEqual(old, newObj)) return;
        value = newObj;
        notifyChange(value, old);
      },
      modify(fn) {
        if (controller.isDestroyed()) throw new Error(idTxt("State destroyed. Cannot modify"));
        const next = fn(value);
        state.set(next);
      },
      refresh() {
        notifyChange(value, value);
      },
      onValueChange(cb) {
        if (controller.isDestroyed()) throw new Error(idTxt("Cannot subscribe to destroyed state"));
        return onChange.subscribe(cb);
      }
    };
    return state;
  }

  // src/ki-frame-demo.ts
  var demo = (title2, fn) => ({ title: title2, fn });
  var demos = [
    demo(
      "counter(), naive 2010 DOM node version",
      function naiveCounter() {
        const state = createState({ total: 0 });
        function infoText(state2) {
          const t = text();
          state2.onValueChange((obj) => t.nodeValue = `${obj.total}`);
          return t;
        }
        state.refresh();
        return p("Total: ", infoText(state), {
          onclick: () => state.modify((cur) => ({ total: cur.total + 1 }))
        });
      }
    ),
    demo("testable counter", function testTableCounter() {
      const createNodes = () => {
        const info = text();
        const root = p("Click to update counter", info);
        return { info, root };
      };
      function counter(state = createState({ total: 0 })) {
        const nodes = createNodes();
        state.addDomEvent("counter", nodes.root, "click", (ev) => state.modify((cur) => ({ total: cur.total + 1 })));
        state.onValueChange((obj) => {
          console.log(state.describe());
          return nodes.info.nodeValue = `Counter: ${obj.total}`;
        });
        state.refresh();
        return nodes;
      }
      return counter().root;
    }),
    demo("onDestroyDemo", function onDestroyTwoNodes() {
      const state = createState({ total: 123 });
      const info = (txt, s2) => {
        const t = text();
        s2.onValueChange((obj) => t.nodeValue = `${txt}: ${obj.total}`);
        s2.onDestroy(() => t.nodeValue = `${txt}: state destroyed`);
        return p(t);
      };
      const root = p(button("Click me!", { onclick: state.destroy }), info("1", state), info("2", state));
      state.refresh();
      return root;
    }),
    demo("onDestroyParentDemo", function onDestroyParentDemo() {
      const parent = createState({});
      const state = createState({ total: 0 });
      state.onDestroy(() => {
        root.replaceChildren(stateInfo, parentInfo);
        stateInfo.nodeValue = "State destroyed!";
      });
      parent.onDestroy(() => {
        parentInfo.nodeValue = "Parent was destroyed!";
      });
      parent.addToDestroy(state);
      state.refresh();
      const stateInfo = text("State ready");
      const parentInfo = text("Parent ready");
      const root = p(p("Not destroyed. Click me!", { onclick: parent.destroy }), stateInfo, parentInfo);
      return root;
    }),
    demo("channelsDemo", function channelsDemo() {
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
      state.refresh();
      const t1 = text("T1");
      const root = p(
        p("Click me to send message!", {
          onclick: () => channel.publish({ num: num++ })
        }),
        t1
      );
      return root;
    }),
    demo("simple form - form handling with state", function naiveForm() {
      const domTextInput = (state, name, node, key, validate) => state.addDomEvent(name, node, "keyup", (ev) => {
        if (validate) {
          if (validate(node.value)) {
            return;
          }
        }
        state.modify((cur) => ({ ...cur, [key]: node.value }));
      });
      function simpleForm(formData = createState({ a: "23", b: "234" })) {
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
        domTextInput(formData, "i2", i2, "b", (v) => v.length % 2 == 0 && log(`b value '${v}' has wrong length ${v.length}`));
        formData.onValueChange(({ a: a2, b: b3 }) => {
          i1.value = a2;
          i2.value = b3;
          log(`Form data: ${a2} ${b3}`);
        });
        const submitController = createController();
        submitController.addDomEvent("submit", root, "submit", (ev) => {
          ev.preventDefault();
          const { a: a2, b: b3 } = formData.get();
          log(`Form submitted ${a2} ${b3}`);
        });
        formData.refresh();
        return root;
      }
      return simpleForm();
    })
  ];
  function demolist(demos2) {
    const rows = demos2.map((demo2) => {
      const target = td();
      const src = td();
      const launchDemo = button(`Launch ${demo2.fn.name}`, {
        onclick: () => {
          target.replaceChildren(demo2.fn());
          src.replaceChildren(pre(demo2.fn.toString()));
        }
      });
      const row = tr(td(launchDemo, br(), demo2.title), src, target);
      row.style = "vertical-align: baseline";
      return row;
    }, demo);
    const demoRowFunctionStringSearchIndex = demos2.map((demo2) => demo2.fn.toString().toLowerCase());
    const state = createState();
    const search2 = input();
    state.addDomEvent("search", search2, "keyup", () => {
      const searchString = search2.value.toLowerCase().trim();
      demoRowFunctionStringSearchIndex.forEach((demoFn, index) => {
        if (searchString.length > 2) {
          rows[index].hidden = demoFn.indexOf(searchString) === -1;
        }
        if (searchString.length == 0) {
          rows[index].hidden = false;
        }
      });
    });
    return div(search2, table(rows));
  }
  setElementToId("app", demolist(demos));
})();
