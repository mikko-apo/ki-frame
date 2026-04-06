import { describe, expect, it, vi } from 'vitest'
import { createState, State } from '..'

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

    it('applies the map function for mapped states', () => {
      const mapped = createState({ value: { c: 1 } }).map((obj) => ({ c: obj.c * 2 }))
      const listener = vi.fn()

      mapped.onValueChange(listener, { noInit: true })
      mapped.set({ c: 3 })

      expect(mapped.get()).toEqual({ c: 6 })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith({ c: 6 }, { c: 2 })
    })

    it('supports reducer-style actions with createState({ value, reducer })', () => {
      const state = createState({
        value: { total: 1 },
        reducer: (action: { type: 'add'; value: number } | { type: 'reset' }, cur) => {
          if (action.type === 'reset') return { total: 0 }
          return { total: cur.total + action.value }
        },
      })
      const listener = vi.fn()

      state.onValueChange(listener)
      state.set({ type: 'add', value: 2 })
      state.set({ type: 'add', value: 5 })

      expect(state.get()).toEqual({ total: 8 })
      expect(listener).toHaveBeenCalledTimes(3)
      expect(listener).toHaveBeenNthCalledWith(1, { total: 1 }, { total: 1 })
      expect(listener).toHaveBeenNthCalledWith(2, { total: 3 }, { total: 1 })
      expect(listener).toHaveBeenNthCalledWith(3, { total: 8 }, { total: 3 })
    })

    it('does not emit when a mapped state map function returns State.Never', () => {
      const mapped = createState({ value: { c: 1 } }).map(() => State.Never)
      const listener = vi.fn()

      mapped.onValueChange(listener, { noInit: true })
      mapped.set({ c: 3 })

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

    it('throws when the state has a map function', () => {
      const state = createState({ value: { a: 1 } }).map((obj) => ({ a: obj.a + 1 }))
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })

      expect(() => state.update({ a: 2 })).toThrow(/Don't call state\.update/)
      expect(listener).not.toHaveBeenCalled()
    })

    it('throws when called after destroy', () => {
      const state = createState({ value: { a: 1 } })
      const listener = vi.fn()

      state.onValueChange(listener, { noInit: true })
      state.destroy()

      expect(() => state.update({ a: 2 })).toThrow(/State destroyed\. Cannot update\(\) value/)
      expect(listener).not.toHaveBeenCalled()
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
