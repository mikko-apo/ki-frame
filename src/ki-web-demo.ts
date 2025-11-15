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