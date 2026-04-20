import { z } from 'zod'
import { describe, expect, it, vi } from 'vitest'
import { createState, State } from '..'

const valueSchema = z.object({
  value: z.number(),
})

describe('State', () => {
  describe('get()', () => {
    it('returns the current value', () => {
      const state = createState({ value: { c: 0 } })

      expect(state.get()).toEqual({ c: 0 })
    })

    it('returns undefined when the initial value has not been set', () => {
      const state = createState<{ c: number }>()

      expect(state.get()).toBeUndefined()
    })
  })

  describe('set()', () => {
    it('accepts a direct value', () => {
      const state = createState({ value: { c: 0 } })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })

      state.set({ c: 1 })

      expect(state.get()).toEqual({ c: 1 })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ c: 1 }, { c: 0 })
    })

    it('accepts an updater callback', () => {
      const state = createState({ value: { c: 0 } })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })

      state.set((cur) => ({ c: cur.c + 2 }))

      expect(state.get()).toEqual({ c: 2 })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ c: 2 }, { c: 0 })
    })

    it('ignores State.Never', () => {
      const state = createState({ value: { c: 0 } })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })

      state.set(State.Never)

      expect(state.get()).toEqual({ c: 0 })
      expect(listener).not.toHaveBeenCalled()
    })

    it('does not emit when setting the same object reference', () => {
      const value = { c: 0 }
      const state = createState({ value })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.set(value)

      expect(state.get()).toBe(value)
      expect(listener).not.toHaveBeenCalled()
    })

    it('throws when called after destroy', () => {
      const state = createState({ value: { c: 0 } })

      state.destroy()

      expect(() => state.set({ c: 1 })).toThrow(/State destroyed\. Cannot set\(\) value/)
    })

    it('applies the map function when the source state updates', () => {
      const state = createState({ value: { c: 1 } })
      const mapped = state.map((obj) => ({ c: obj.c * 2 }))
      const listener = vi.fn()

      mapped.onValueChange(listener, { noInit: true })
      state.set({ c: 3 })

      expect(mapped.get()).toEqual({ c: 6 })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ c: 6 }, { c: 2 })
    })

    it('supports reducer-style actions with state.reducer()', () => {
      const state = createState<{ total: number }>()
      const dispatch = state.reducer((action: { type: 'add'; value: number } | { type: 'reset' }, cur) => {
        if (action.type === 'reset') return { total: 0 }
        return { total: cur.total + action.value }
      })
      const listener = vi.fn()

      state.onValueChange(listener)
      dispatch({ type: 'add', value: 2 })
      dispatch({ type: 'add', value: 5 })

      expect(state.get()).toEqual({ total: 8 })
      expect(listener).toHaveBeenCalledTimes(3)
      expect(listener).toHaveBeenNthCalledWith(1, { total: 1 }, { total: 1 })
      expect(listener).toHaveBeenNthCalledWith(2, { total: 3 }, { total: 1 })
      expect(listener).toHaveBeenNthCalledWith(3, { total: 8 }, { total: 3 })
    })

    it('does not emit when a mapped state map function returns State.Never', () => {
      const state = createState({ value: { c: 1 } })
      const mapped = state.map(() => State.Never)
      const listener = vi.fn()

      mapped.onValueChange(listener, { noInit: true })
      state.set({ c: 3 })

      expect(mapped.get()).toBeUndefined()
      expect(listener).not.toHaveBeenCalled()
    })

    it('sets the initial value when the state starts undefined', () => {
      const state = createState<{ c: number }>()
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.set({ c: 1 })

      expect(state.get()).toEqual({ c: 1 })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ c: 1 }, { c: 1 })
    })

    it('supports updater callbacks when the state starts undefined', () => {
      const state = createState<number>()
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.set((cur) => (cur ?? 0) + 2)

      expect(state.get()).toBe(2)
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(2, 2)
    })

    it('accepts a direct value when schema validation passes', () => {
      const state = createState({
        value: { value: 1 },
        schema: valueSchema,
      })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.set({ value: 2 })

      expect(state.get()).toEqual({ value: 2 })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ value: 2 }, { value: 1 })
    })

    it('keeps the current value when schema validation fails without onValidateFailure', () => {
      const state = createState({
        value: { value: 1 },
        schema: valueSchema,
      })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.set({ value: 'x' } as any)

      expect(state.get()).toEqual({ value: 1 })
      expect(listener).not.toHaveBeenCalled()
    })

    it('calls onValidateFailure and keeps the current value when set validation fails', () => {
      const onValidateFailure = vi.fn()
      const state = createState({
        value: { value: 1 },
        schema: valueSchema,
        onValidateFailure,
      })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.set({ value: 'x' } as any)

      expect(state.get()).toEqual({ value: 1 })
      expect(listener).not.toHaveBeenCalled()
      expect(onValidateFailure).toHaveBeenCalledTimes(1)
      expect(onValidateFailure.mock.calls[0]?.[0]).toMatchObject({
        issues: [expect.objectContaining({ message: expect.any(String) })],
      })
    })
  })

  describe('update()', () => {
    it('merges a partial object into the current value', () => {
      const state = createState({ value: { a: 1, b: 2 } })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })

      state.update({ a: 5 })

      expect(state.get()).toEqual({ a: 5, b: 2 })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ a: 5, b: 2 }, { a: 1, b: 2 })
    })

    it('accepts an updater callback', () => {
      const state = createState({ value: { a: 1, b: 2 } })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })

      state.update((cur) => ({ a: cur.a + 4 }))

      expect(state.get()).toEqual({ a: 5, b: 2 })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ a: 5, b: 2 }, { a: 1, b: 2 })
    })

    it('ignores State.Never', () => {
      const state = createState({ value: { a: 1, b: 2 } })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })

      state.update(State.Never)

      expect(state.get()).toEqual({ a: 1, b: 2 })
      expect(listener).not.toHaveBeenCalled()
    })

    it('throws for undefined state value', () => {
      const state = createState<{ a: number }>()
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })

      expect(() => state.update({ a: 1 })).toThrow(/State is undefined/)
      expect(listener).not.toHaveBeenCalled()
    })

    it('throws for non-object state value', () => {
      const state = createState({ value: 1 })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })

      expect(() => state.update(2)).toThrow(/State is not an object/)
      expect(listener).not.toHaveBeenCalled()
    })

    it('updates mapped state values directly', () => {
      const state = createState({ value: { a: 1 } }).map((obj) => ({ a: obj.a + 1 }))
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.update({ a: 2 })

      expect(state.get()).toEqual({ a: 2 })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ a: 2 }, { a: 2 })
    })

    it('throws when called after destroy', () => {
      const state = createState({ value: { a: 1 } })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.destroy()

      expect(() => state.update({ a: 2 })).toThrow(/State destroyed\. Cannot update\(\) value/)
      expect(listener).not.toHaveBeenCalled()
    })

    it('accepts a merged value when schema validation passes', () => {
      const state = createState({
        value: { value: 1 },
        schema: valueSchema,
      })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.update({ value: 2 })

      expect(state.get()).toEqual({ value: 2 })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ value: 2 }, { value: 1 })
    })

    it('keeps the current value when merged update fails schema validation without onValidateFailure', () => {
      const state = createState({
        value: { value: 1 },
        schema: valueSchema,
      })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.update({ value: 'x' } as any)

      expect(state.get()).toEqual({ value: 1 })
      expect(listener).not.toHaveBeenCalled()
    })

    it('calls onValidateFailure and keeps the current value when update validation fails', () => {
      const onValidateFailure = vi.fn()
      const state = createState({
        value: { value: 1 },
        schema: valueSchema,
        onValidateFailure,
      })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.update({ value: 'x' } as any)

      expect(state.get()).toEqual({ value: 1 })
      expect(listener).not.toHaveBeenCalled()
      expect(onValidateFailure).toHaveBeenCalledTimes(1)
      expect(onValidateFailure.mock.calls[0]?.[0]).toMatchObject({
        issues: [expect.objectContaining({ message: expect.any(String) })],
      })
    })
  })

  describe('onValueChange()', () => {
    it('subscribes to value updates and emits the initial value by default', () => {
      const state = createState({ value: { c: 0 } })
      const listener = vi.fn()

      state.onValueChange(listener)
      state.set({ c: 1 })

      expect(listener).toHaveBeenNthCalledWith(1, { c: 0 }, { c: 0 })
      expect(listener).toHaveBeenNthCalledWith(2, { c: 1 }, { c: 0 })
    })

    it('supports noInit to skip the initial emission', () => {
      const state = createState({ value: { c: 0 } })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.set({ c: 1 })

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ c: 1 }, { c: 0 })
    })

    it('does not emit an initial value for undefined state', () => {
      const state = createState<{ c: number }>()
      const listener = vi.fn()

      state.onValueChange(listener)

      expect(listener).not.toHaveBeenCalled()
    })

    it('throws when subscribing after destroy', () => {
      const state = createState({ value: { c: 0 } })

      state.destroy()

      expect(() => state.onValueChange(() => {})).toThrow(/Cannot subscribe to destroyed state/)
    })
  })

  describe('destroy()', () => {
    it('prevents further access to the state', () => {
      const state = createState({ value: { c: 0 } })

      state.destroy()

      expect(() => state.get()).toThrow(/State destroyed\. Cannot get value/)
    })

    it('stops notifying existing onValueChange subscribers', () => {
      const state = createState({ value: { c: 0 } })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.destroy()

      expect(() => state.set({ c: 1 })).toThrow(/State destroyed\. Cannot set\(\) value/)
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('map()', () => {
    it('creates a derived state that follows source updates', () => {
      const state = createState({ value: { c: 2 } })
      const doubled = state.map((obj) => obj.c * 2)

      state.set({ c: 3 })

      expect(doubled.get()).toBe(6)
    })

    it('passes the current mapped value to the mapping callback', () => {
      const state = createState({ value: { c: 2 } })
      const seenCurrentValues: Array<number | undefined> = []
      const doubled = state.map((obj, cur): number => {
        seenCurrentValues.push(cur)
        return obj.c * 2
      })

      state.set({ c: 3 })
      state.set({ c: 4 })

      expect(doubled.get()).toBe(8)
      expect(seenCurrentValues).toEqual([undefined, 4, 6])
    })

    it('does not update the derived state when the mapper returns State.Never', () => {
      const state = createState({ value: { c: 2 } })
      const mapped = state.map((obj) => (obj.c > 2 ? State.Never : obj.c * 2))

      state.set({ c: 3 })

      expect(mapped.get()).toBe(4)
    })

    it('starts undefined when the source state has no initial value', () => {
      const state = createState<{ c: number }>()
      const doubled = state.map((obj) => (obj?.c || 1) * 2)

      expect(doubled.get()).toBeUndefined()

      state.set({ c: 3 })

      expect(doubled.get()).toBe(6)
    })
  })
})
