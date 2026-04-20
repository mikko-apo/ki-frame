import { createState, type State } from '..'
import { button, div, li, p, text, ul } from '../domBuilder'
import { events } from '../domBuilderEvents'
import { styles } from '../domBuilderStyles'

export function domBuilderAndState() {
  // DOM structure setup for testing
  const createNodes = (state: State<{ total: number }>) => {
    const info = text()
    state.onValueChange((obj) => {
      info.nodeValue = `Counter: ${obj.total}`
    })
    const showInfo = false
    return div(
      p('Click this text to update counter', {
        styles: {
          color: 'red',
        },
        events: {
          click() {
            state.set((cur) => ({ total: cur.total + 1 }))
          },
        },
      }),
      info,
      showInfo && 'Text node with more information',
      ul([1, 2, 3].map((i) => li(i))),
      styles({ color: 'green' })
    )
  }

  function counter(state = createState({ value: { total: 0 } })) {
    const c = createNodes(state)
    const reset = button(
      'Reset',
      events({
        click() {
          state.set({ total: 0 })
        },
      })
    )
    return div({ class: 'counter' }, c, reset)
  }

  return counter()
}
