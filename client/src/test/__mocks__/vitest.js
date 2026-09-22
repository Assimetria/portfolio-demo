// Vitest → Jest compatibility shim
// Uses getters so values resolve lazily (jest global injected per-module)
Object.defineProperties(module.exports, {
  describe: { get() { return global.describe } },
  it: { get() { return global.it } },
  expect: { get() { return global.expect } },
  vi: { get() { return jest } },
  test: { get() { return global.test } },
  beforeEach: { get() { return global.beforeEach } },
  afterEach: { get() { return global.afterEach } },
  beforeAll: { get() { return global.beforeAll } },
  afterAll: { get() { return global.afterAll } },
})
