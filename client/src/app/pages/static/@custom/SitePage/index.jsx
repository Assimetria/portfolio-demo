// @custom — Product home page.
// Delegates to @system SitePage, which renders the sections from
// content/@custom/site.js. To change the composition (drop a section, add a
// custom one, wrap with a banner) edit this file — it is NEVER overwritten
// during template sync. To only change copy, edit content/@custom/site.js.
import { SitePage as SystemSitePage } from '../../@system/SitePage'

export function SitePage() {
  return <SystemSitePage />
}

export default SitePage
