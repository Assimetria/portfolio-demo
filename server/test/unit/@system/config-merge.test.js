/**
 * Unit tests for the server-side config override/merge chain.
 *
 * @system/info.js loads the shared root `.config/info.js` source of truth.
 * @custom/index.js re-merges those values over the @system defaults so that product
 * name / supportEmail / url override while unset @system keys are retained.
 *
 * These tests assert criterion #4 of task #1024401: the @custom server config must
 * surface the @custom name/supportEmail/url merged over `.config/info.js`, and
 * @system/info.js must load the shared source.
 */

const systemInfo = require('../../../src/config/@system/info')
const customConfig = require('../../../src/config/@custom/index')

describe('server config merge chain (@system/info + @custom/index)', () => {
  it('@system/info loads the shared .config/info.js source of truth', () => {
    // name/description come straight from .config/info.js via ...sharedInfo
    expect(systemInfo.name).toBe('ProductTemplate')
    expect(systemInfo.description).toContain('SaaS starter kit')
    // shared source of truth is always spread first
    expect(systemInfo).toHaveProperty('supportEmail')
    expect(systemInfo).toHaveProperty('url')
  })

  it('@custom/index surfaces the @custom name override', () => {
    expect(customConfig.name).toBe('Product Template')
  })

  it('@custom/index surfaces the @custom supportEmail override', () => {
    expect(customConfig.supportEmail).toBe('hello@producttemplate.com')
  })

  it('@custom/index overrides url with the runtime URL', () => {
    expect(typeof customConfig.url).toBe('string')
    expect(customConfig.url.length).toBeGreaterThan(0)
  })

  it('retains @system/.config keys when unset by @custom (shallow merge)', () => {
    // description / products / plans exist only in the shared .config/info.js spread
    expect(customConfig.description).toContain('SaaS starter kit')
    expect(Array.isArray(customConfig.plans)).toBe(true)
    expect(customConfig).toHaveProperty('products')
  })

  it('retains server metadata injected by @system/info', () => {
    expect(customConfig.version).toBe('0.1.0')
    expect(customConfig).toHaveProperty('env')
  })
})
