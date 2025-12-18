import { Events, type EventsInput, setEvents } from "./domBuilderEvents";
import { type StyleObject, Styles, setClass, setStyle } from "./domBuilderStyles";
import { WrappedNode } from "./types";

type CreateElementTypes<K extends keyof HTMLElementTagNameMap> =
  | HTMLElement
  | Text
  | string
  | WrappedNode
  | Styles
  | Events<K>;
type ExtendedCreateElementAttributes<K extends keyof HTMLElementTagNameMap> = {
  class: string | string[];
  styles: StyleObject;
  events: EventsInput<K>;
};
type CreateElementArg<K extends keyof HTMLElementTagNameMap> =
  | CreateElementTypes<K>
  | CreateElementTypes<K>[]
  | Partial<HTMLElementTagNameMap[K] & ExtendedCreateElementAttributes<K>>;
export type CreateElementArgs<K extends keyof HTMLElementTagNameMap> = CreateElementArg<K>[];

function addItems<K extends keyof HTMLElementTagNameMap>(element: HTMLElement, ...args: CreateElementArgs<K>) {
  args.forEach((arg) => {
    if (Array.isArray(arg)) {
      addItems(element, ...arg);
    } else if (isNode(arg)) {
      element.appendChild(arg);
    } else if (arg instanceof WrappedNode) {
      element.appendChild(arg.node);
    } else if (arg instanceof Styles) {
      setStyle(element, arg.styles);
    } else if (arg instanceof Events) {
      setEvents(element, arg as any);
    } else if (typeof arg === "string") {
      element.appendChild(getDocument().createTextNode(arg));
    } else if (typeof arg === "object") {
      Object.entries(arg).forEach(([key, argValue]) => {
        if (key === "class") {
          setClass(element, argValue);
        } else if (key === "styles") {
          setStyle(element, argValue);
        } else if (key === "events") {
          setEvents(element, argValue);
        } else if (key.startsWith("on") && typeof argValue === "function") {
          const event = key.substring(2).toLowerCase();
          element.addEventListener(event, argValue);
        } else {
          element.setAttribute(key, argValue);
        }
      });
    }
  });
}

var doc: Document | undefined = typeof document !== "undefined" ? document : undefined;
var isNode = (e: unknown): e is Node => {
  return typeof document !== "undefined" && !![HTMLElement, Text].find((value) => e instanceof value);
};

export function setCreateElementContext(newDoc: Document, newIsNode: typeof isNode) {
  doc = newDoc;
  isNode = newIsNode;
}

function getDocument() {
  if (doc) {
    return doc;
  }
  throw new Error("document is undefined");
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: keyof HTMLElementTagNameMap,
  ...args: CreateElementArgs<K>
): HTMLElementTagNameMap[K] {
  const element = getDocument().createElement(tagName);
  addItems(element, ...args);
  return element as HTMLElementTagNameMap[K];
}

const createElementFn =
  <K extends keyof HTMLElementTagNameMap>(tagName: K) =>
  (...args: CreateElementArgs<K>) =>
    createElement(tagName, ...args);

export const a = createElementFn("a");
export const abbr = createElementFn("abbr");
export const address = createElementFn("address");
export const area = createElementFn("area");
export const article = createElementFn("article");
export const aside = createElementFn("aside");
export const audio = createElementFn("audio");
export const b = createElementFn("b");
export const base = createElementFn("base");
export const bdi = createElementFn("bdi");
export const bdo = createElementFn("bdo");
export const blockquote = createElementFn("blockquote");
export const body = createElementFn("body");
export const br = createElementFn("br");
export const button = createElementFn("button");
export const canvas = createElementFn("canvas");
export const caption = createElementFn("caption");
export const cite = createElementFn("cite");
export const code = createElementFn("code");
export const col = createElementFn("col");
export const colgroup = createElementFn("colgroup");
export const data = createElementFn("data");
export const datalist = createElementFn("datalist");
export const dd = createElementFn("dd");
export const del = createElementFn("del");
export const details = createElementFn("details");
export const dfn = createElementFn("dfn");
export const dialog = createElementFn("dialog");
export const div = createElementFn("div");
export const dl = createElementFn("dl");
export const dt = createElementFn("dt");
export const em = createElementFn("em");
export const embed = createElementFn("embed");
export const fieldset = createElementFn("fieldset");
export const figcaption = createElementFn("figcaption");
export const figure = createElementFn("figure");
export const footer = createElementFn("footer");
export const form = createElementFn("form");
export const h1 = createElementFn("h1");
export const h2 = createElementFn("h2");
export const h3 = createElementFn("h3");
export const h4 = createElementFn("h4");
export const h5 = createElementFn("h5");
export const h6 = createElementFn("h6");
export const head = createElementFn("head");
export const header = createElementFn("header");
export const hgroup = createElementFn("hgroup");
export const hr = createElementFn("hr");
export const html = createElementFn("html");
export const i = createElementFn("i");
export const iframe = createElementFn("iframe");
export const img = createElementFn("img");
export const input = createElementFn("input");
export const ins = createElementFn("ins");
export const kbd = createElementFn("kbd");
export const label = createElementFn("label");
export const legend = createElementFn("legend");
export const li = createElementFn("li");
export const link = createElementFn("link");
export const main = createElementFn("main");
export const map = createElementFn("map");
export const mark = createElementFn("mark");
export const menu = createElementFn("menu");
export const meta = createElementFn("meta");
export const meter = createElementFn("meter");
export const nav = createElementFn("nav");
export const noscript = createElementFn("noscript");
export const object = createElementFn("object");
export const ol = createElementFn("ol");
export const optgroup = createElementFn("optgroup");
export const option = createElementFn("option");
export const output = createElementFn("output");
export const p = createElementFn("p");
export const picture = createElementFn("picture");
export const pre = createElementFn("pre");
export const progress = createElementFn("progress");
export const q = createElementFn("q");
export const rp = createElementFn("rp");
export const rt = createElementFn("rt");
export const ruby = createElementFn("ruby");
export const s = createElementFn("s");
export const samp = createElementFn("samp");
export const script = createElementFn("script");
export const search = createElementFn("search");
export const section = createElementFn("section");
export const select = createElementFn("select");
export const slot = createElementFn("slot");
export const small = createElementFn("small");
export const source = createElementFn("source");
export const span = createElementFn("span");
export const strong = createElementFn("strong");
export const style = createElementFn("style");
export const sub = createElementFn("sub");
export const summary = createElementFn("summary");
export const sup = createElementFn("sup");
export const table = createElementFn("table");
export const tbody = createElementFn("tbody");
export const td = createElementFn("td");
export const template = createElementFn("template");
export const textarea = createElementFn("textarea");
export const tfoot = createElementFn("tfoot");
export const th = createElementFn("th");
export const thead = createElementFn("thead");
export const time = createElementFn("time");
export const title = createElementFn("title");
export const tr = createElementFn("tr");
export const track = createElementFn("track");
export const u = createElementFn("u");
export const ul = createElementFn("ul");
export const varE = createElementFn("var");
export const video = createElementFn("video");
export const wbr = createElementFn("wbr");

// Other Nodes

export const text = (arg: string | number = "") => getDocument().createTextNode(String(arg));

// Render function that appends generated elements to the target element
export function setElementToId(targetId: string, element: HTMLElement) {
  const targetElement = getDocument().getElementById(targetId);
  if (targetElement) {
    targetElement.replaceChildren(element);
  } else {
    console.error(`Target element with ID "${targetId}" not found!`);
  }
}
