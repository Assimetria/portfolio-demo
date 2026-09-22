// Config resolver: merges @system defaults with @custom overrides.
// @system/info.js = template defaults (overwritten during template sync)
// @custom/info.js = product identity. Two writers exist and BOTH must work:
//   - scripts/apply-brand.js generates it from brand.json on every build and
//     exports `customInfo` (+ a legacy `info` = { ...baseInfo, ...customInfo });
//   - Orkosi provisioning writes it directly as `export const customInfo = {...}`.
//   The import below therefore reads the module namespace and accepts either
//   `customInfo` or `info`. Never import a single named binding here — a shape
//   mismatch used to spread `...undefined`, so every built customer app fell
//   back to the @system defaults ("ProductTemplate", slate, light) at runtime.
//
// Usage: import { info, text, site } from '@/config'
//   info — shallow merge: { ...systemInfo, ...customInfo } (@custom wins per key)
//   text — deep merge: @custom wins per leaf key, @system siblings are kept
//   site — three-layer deep merge (see below)

import { info as systemInfo } from './@system/info.js'
import * as customMod from './@custom/info.js'
import { text as systemText } from './@system/text/index.js'
import { text as customText } from './@custom/text/index.js'
import systemSite from '../app/content/@system/site.js'
import generatedSite from '../app/content/@generated/site.brand.js'
import customSite from '../app/content/@custom/site.js'
// Shared with scripts/apply-brand.js, client/webpack.config.mjs and
// client/scripts/prerender.mjs so build-time HTML and runtime React merge the
// site content with one and the same rule.
import { mergeSiteLayers, deepMerge } from '../../../scripts/lib/site-brand.cjs'

const customInfo = customMod.customInfo ?? customMod.info ?? {}

export const info = { ...systemInfo, ...customInfo }

// Feature modules (brand.json `modules` → webpack __MODULES__). Re-exported so
// callers can `import { modules, isModuleEnabled } from '@/config'`.
export { modules, isModuleEnabled, filterByModules } from './@system/modules.js'


export const text = deepMerge(systemText, customText)

// Informational site content, three layers (lowest → highest precedence):
//   content/@system/site.js            template defaults
//   content/@generated/site.brand.js   GENERATED from brand.json `site` by apply-brand.js
//   content/@custom/site.js            hand-written product overrides
// Objects merge per key, arrays are replaced wholesale, unset keys fall through.
// Usage: import { site } from '@/config'  →  site.hero.title, site.features.showTeam …
export const site = mergeSiteLayers(systemSite, generatedSite, customSite)

/** Hook-shaped accessor for components; content is static so this is just `site`. */
export function useSite() {
  return site
}
