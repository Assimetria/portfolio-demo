// @system — Unit tests for the Promise-based Mutex used to serialize webhook processing.
// Mirrors Asymetric Ventures' Mutex: prevents concurrent processing of the same key
// (e.g. duplicate Stripe/Polar webhook events). Pure-jest, no DB/Redis required.
'use strict'

const Mutex = require('../../../src/lib/@system/Mutex')

/** Deferred helper so we can release promises from the test body. */
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('@system Mutex', () => {
  describe('run()', () => {
    it('executes the task to completion for a single key', async () => {
      const mutex = new Mutex()
      const order = []
      await mutex.run('k', async () => { order.push('start'); await Promise.resolve(); order.push('end') })
      expect(order).toEqual(['start', 'end'])
    })

    it('serialises concurrent run() calls for the SAME key (no overlap)', async () => {
      const mutex = new Mutex()
      const startGate = deferred()

      let active = 0
      let maxActive = 0
      const entered = []

      const track = async (id) => {
        await startGate.promise // all three attempt acquisition together
        return mutex.run('shared', async () => {
          active += 1
          maxActive = Math.max(maxActive, active)
          entered.push(id)
          // Keep the lock held long enough that an overlapping call would be observed.
          await new Promise((r) => setTimeout(r, 20))
          active -= 1
          return id
        })
      }

      // Kick off all three acquisitions (each awaits the gate), then release the
      // gate so the tasks race into run() together — awaiting before resolving
      // would deadlock since every track() blocks on the gate.
      const resultsPromise = Promise.all([track('a'), track('b'), track('c')])
      startGate.resolve()
      const results = await resultsPromise

      expect(results).toEqual(['a', 'b', 'c'])
      // Tasks for one key must never overlap.
      expect(maxActive).toBe(1)
      // All three completed serially.
      expect(entered).toEqual(['a', 'b', 'c'])
    })

    it('runs tasks for DIFFERENT keys in parallel', async () => {
      const mutex = new Mutex()
      const startGate = deferred()

      let active = 0
      let maxActive = 0

      const track = async (key) => {
        await startGate.promise
        return mutex.run(key, async () => {
          active += 1
          maxActive = Math.max(maxActive, active)
          await new Promise((r) => setTimeout(r, 20))
          active -= 1
          return key
        })
      }

      const resultsPromise = Promise.all([track('k1'), track('k2'), track('k3')])
      startGate.resolve()
      const results = await resultsPromise

      expect([...results].sort()).toEqual(['k1', 'k2', 'k3'])
      // Independent keys may run concurrently — no serialisation enforced.
      expect(maxActive).toBeGreaterThan(1)
    })

    it('releases the lock when the task throws (finally)', async () => {
      const mutex = new Mutex()
      await expect(
        mutex.run('flaky', async () => { throw new Error('boom') }),
      ).rejects.toThrow('boom')

      // Lock must be released after the failed run so a later run is not blocked.
      expect(mutex.isLocked('flaky')).toBe(false)
      const order = []
      await mutex.run('flaky', async () => { order.push('ran-again') })
      expect(order).toEqual(['ran-again'])
    })

    it('returns the resolved value of the task', async () => {
      const mutex = new Mutex()
      const value = await mutex.run('k', async () => 42)
      expect(value).toBe(42)
    })
  })

  describe('acquire()', () => {
    it('returns a working release function', async () => {
      const mutex = new Mutex()
      const release = await mutex.acquire('k')
      expect(mutex.isLocked('k')).toBe(true)

      // A second acquire for the same key must wait until the first releases.
      let secondAcquired = false
      const second = mutex.acquire('k').then((rel2) => {
        secondAcquired = true
        rel2()
      })

      await new Promise((r) => setTimeout(r, 20))
      expect(secondAcquired).toBe(false)

      release()
      await second
      expect(secondAcquired).toBe(true)
      expect(mutex.isLocked('k')).toBe(false)
    })
  })

  describe('isLocked()', () => {
    it('reports true while a key is held and false once released', async () => {
      const mutex = new Mutex()
      expect(mutex.isLocked('k')).toBe(false)

      const release = await mutex.acquire('k')
      expect(mutex.isLocked('k')).toBe(true)

      // Different keys are independent.
      expect(mutex.isLocked('other')).toBe(false)

      release()
      expect(mutex.isLocked('k')).toBe(false)
    })
  })
})
