import { Context, State, StateListener } from './state'

const defaultContext = new Context()

export const getDefaultContext = () => defaultContext
export const createController = defaultContext.createController.bind(defaultContext)
export const createState = defaultContext.createState.bind(defaultContext)
export const createForm = defaultContext.createForm.bind(defaultContext)

export { State, StateListener }
