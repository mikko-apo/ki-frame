import { createController } from '..'
import { button, div } from '../domBuilder'

export function stateTimeoutDemo() {
  const b1 = button('Click me!')
  const state = createController()

  state.addDomEvent('start timeout', b1, 'click', () => {
    b1.textContent = 'Waiting...'
    state.timeout(() => (b1.textContent = 'Ready!'), 1000)
  })

  return div(b1)
}
