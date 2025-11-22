import { WrappedNode } from "./types";

type CreateElementArg<E extends HTMLElement> =
  | HTMLElement
  | string
  | Array<HTMLElement>
  | Partial<E>
  | Text
  | WrappedNode;
type CreateElementArgs<E extends HTMLElement> = CreateElementArg<E>[];

function addItems<E extends HTMLElement>(element: HTMLElement, ...args: CreateElementArgs<E>) {
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
        const argValue = (arg as any)[key];
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

function createElement<E extends HTMLElement>(
  tagNameOrElement: keyof HTMLElementTagNameMap,
  ...args: CreateElementArgs<E>
): E {
  const element = getDocument().createElement(tagNameOrElement);
  addItems<E>(element, ...args);
  return element as E;
}

const createElementFn =
  <E extends HTMLElement>(tagName: keyof HTMLElementTagNameMap) =>
  (...args: CreateElementArgs<E>) =>
    createElement<E>(tagName, ...args);

export const a = createElementFn<HTMLAnchorElement>("a");
export const abbr = createElementFn<HTMLElement>("abbr");
export const address = createElementFn<HTMLElement>("address");
export const area = createElementFn<HTMLAreaElement>("area");
export const article = createElementFn<HTMLElement>("article");
export const aside = createElementFn<HTMLElement>("aside");
export const audio = createElementFn<HTMLAudioElement>("audio");
export const b = createElementFn<HTMLElement>("b");
export const base = createElementFn<HTMLBaseElement>("base");
export const bdi = createElementFn<HTMLElement>("bdi");
export const bdo = createElementFn<HTMLElement>("bdo");
export const blockquote = createElementFn<HTMLQuoteElement>("blockquote");
export const body = createElementFn<HTMLBodyElement>("body");
export const br = createElementFn<HTMLBRElement>("br");
export const button = createElementFn<HTMLButtonElement>("button");
export const canvas = createElementFn<HTMLCanvasElement>("canvas");
export const caption = createElementFn<HTMLTableCaptionElement>("caption");
export const cite = createElementFn<HTMLElement>("cite");
export const code = createElementFn<HTMLElement>("code");
export const col = createElementFn<HTMLTableColElement>("col");
export const colgroup = createElementFn<HTMLTableColElement>("colgroup");
export const data = createElementFn<HTMLDataElement>("data");
export const datalist = createElementFn<HTMLDataListElement>("datalist");
export const dd = createElementFn<HTMLElement>("dd");
export const del = createElementFn<HTMLModElement>("del");
export const details = createElementFn<HTMLDetailsElement>("details");
export const dfn = createElementFn<HTMLElement>("dfn");
export const dialog = createElementFn<HTMLDialogElement>("dialog");
export const div = createElementFn<HTMLDivElement>("div");
export const dl = createElementFn<HTMLDListElement>("dl");
export const dt = createElementFn<HTMLElement>("dt");
export const em = createElementFn<HTMLElement>("em");
export const embed = createElementFn<HTMLEmbedElement>("embed");
export const fieldset = createElementFn<HTMLFieldSetElement>("fieldset");
export const figcaption = createElementFn<HTMLElement>("figcaption");
export const figure = createElementFn<HTMLElement>("figure");
export const footer = createElementFn<HTMLElement>("footer");
export const form = createElementFn<HTMLFormElement>("form");
export const h1 = createElementFn<HTMLHeadingElement>("h1");
export const h2 = createElementFn<HTMLHeadingElement>("h2");
export const h3 = createElementFn<HTMLHeadingElement>("h3");
export const h4 = createElementFn<HTMLHeadingElement>("h4");
export const h5 = createElementFn<HTMLHeadingElement>("h5");
export const h6 = createElementFn<HTMLHeadingElement>("h6");
export const head = createElementFn<HTMLHeadElement>("head");
export const header = createElementFn<HTMLElement>("header");
export const hgroup = createElementFn<HTMLElement>("hgroup");
export const hr = createElementFn<HTMLHRElement>("hr");
export const html = createElementFn<HTMLHtmlElement>("html");
export const i = createElementFn<HTMLElement>("i");
export const iframe = createElementFn<HTMLIFrameElement>("iframe");
export const img = createElementFn<HTMLImageElement>("img");
export const input = createElementFn<HTMLInputElement>("input");
export const ins = createElementFn<HTMLModElement>("ins");
export const kbd = createElementFn<HTMLElement>("kbd");
export const label = createElementFn<HTMLLabelElement>("label");
export const legend = createElementFn<HTMLLegendElement>("legend");
export const li = createElementFn<HTMLLIElement>("li");
export const link = createElementFn<HTMLLinkElement>("link");
export const main = createElementFn<HTMLElement>("main");
export const map = createElementFn<HTMLMapElement>("map");
export const mark = createElementFn<HTMLElement>("mark");
export const menu = createElementFn<HTMLMenuElement>("menu");
export const meta = createElementFn<HTMLMetaElement>("meta");
export const meter = createElementFn<HTMLMeterElement>("meter");
export const nav = createElementFn<HTMLElement>("nav");
export const noscript = createElementFn<HTMLElement>("noscript");
export const object = createElementFn<HTMLObjectElement>("object");
export const ol = createElementFn<HTMLOListElement>("ol");
export const optgroup = createElementFn<HTMLOptGroupElement>("optgroup");
export const option = createElementFn<HTMLOptionElement>("option");
export const output = createElementFn<HTMLOutputElement>("output");
export const p = createElementFn<HTMLParagraphElement>("p");
export const picture = createElementFn<HTMLPictureElement>("picture");
export const pre = createElementFn<HTMLPreElement>("pre");
export const progress = createElementFn<HTMLProgressElement>("progress");
export const q = createElementFn<HTMLQuoteElement>("q");
export const rp = createElementFn<HTMLElement>("rp");
export const rt = createElementFn<HTMLElement>("rt");
export const ruby = createElementFn<HTMLElement>("ruby");
export const s = createElementFn<HTMLElement>("s");
export const samp = createElementFn<HTMLElement>("samp");
export const script = createElementFn<HTMLScriptElement>("script");
export const search = createElementFn<HTMLElement>("search");
export const section = createElementFn<HTMLElement>("section");
export const select = createElementFn<HTMLSelectElement>("select");
export const slot = createElementFn<HTMLSlotElement>("slot");
export const small = createElementFn<HTMLElement>("small");
export const source = createElementFn<HTMLSourceElement>("source");
export const span = createElementFn<HTMLSpanElement>("span");
export const strong = createElementFn<HTMLElement>("strong");
export const style = createElementFn<HTMLStyleElement>("style");
export const sub = createElementFn<HTMLElement>("sub");
export const summary = createElementFn<HTMLElement>("summary");
export const sup = createElementFn<HTMLElement>("sup");
export const table = createElementFn<HTMLTableElement>("table");
export const tbody = createElementFn<HTMLTableSectionElement>("tbody");
export const td = createElementFn<HTMLTableCellElement>("td");
export const template = createElementFn<HTMLTemplateElement>("template");
export const textarea = createElementFn<HTMLTextAreaElement>("textarea");
export const tfoot = createElementFn<HTMLTableSectionElement>("tfoot");
export const th = createElementFn<HTMLTableCellElement>("th");
export const thead = createElementFn<HTMLTableSectionElement>("thead");
export const time = createElementFn<HTMLTimeElement>("time");
export const title = createElementFn<HTMLTitleElement>("title");
export const tr = createElementFn<HTMLTableRowElement>("tr");
export const track = createElementFn<HTMLTrackElement>("track");
export const u = createElementFn<HTMLElement>("u");
export const ul = createElementFn<HTMLUListElement>("ul");
export const varE = createElementFn<HTMLElement>("var");
export const video = createElementFn<HTMLVideoElement>("video");
export const wbr = createElementFn<HTMLElement>("wbr");

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
