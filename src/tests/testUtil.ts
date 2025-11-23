import { JSDOM } from "jsdom";
import { setCreateElementContext } from "../domBuilder";

function extendsClassWithName(obj: unknown, className: string, fns: string[] = []): boolean {
  let proto = Object.getPrototypeOf(obj);
  while (proto) {
    if (proto.constructor && proto.constructor.name === className && fns.every((k) => typeof proto[k] === "function")) {
      return true;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

export function setJsdomDoc(initHtml: string = ``) {
  const dom = new JSDOM(initHtml, {
    // if you need inline <script onclick="..."> to run, set:
    // runScripts: "dangerously", resources: "usable"
  });

  const { window } = dom;
  setCreateElementContext(window.document, (e): e is Node => {
    return extendsClassWithName(e, "Node", ["getRootNode", "hasChildNodes", "cloneNode", "appendChild", "removeChild"]);
  });
}

export function setJsdomApp() {
  setJsdomDoc("<div id='app'></div>");
}
