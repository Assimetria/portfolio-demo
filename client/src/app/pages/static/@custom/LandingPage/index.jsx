// @custom — Product landing page
// Delegates to @system LandingPage which uses info.name and info.tagline
// from @custom/info.js. Products override branding in their own @custom/info.js.
import { LandingPage as SystemLandingPage } from '../../@system/LandingPage'

export function LandingPage() {
  return <SystemLandingPage />
}

export default LandingPage
