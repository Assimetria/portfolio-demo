// @system — Promise-based mutex for webhook deduplication
// Mirrors Asymetric Ventures' Mutex class used in Stripe webhook processing.
// Prevents concurrent processing of the same key (e.g. duplicate webhook events).
'use strict'

class Mutex {
  constructor() {
    this._locks = new Map()
  }

  /**
   * Acquire exclusive lock for a given key.
   * If another operation holds the lock, waits for it to complete.
   * Returns a release function that MUST be called when done.
   */
  async acquire(key) {
    while (this._locks.has(key)) {
      await this._locks.get(key)
    }

    let resolve
    const promise = new Promise((r) => { resolve = r })
    this._locks.set(key, promise)

    return () => {
      this._locks.delete(key)
      resolve()
    }
  }

  /**
   * Run a function under exclusive lock for the given key.
   * Automatically acquires and releases the lock.
   */
  async run(key, fn) {
    const release = await this.acquire(key)
    try {
      return await fn()
    } finally {
      release()
    }
  }

  /** Check if a key is currently locked. */
  isLocked(key) {
    return this._locks.has(key)
  }
}

module.exports = Mutex
