// @custom — Product pricing page
// Delegates to @system PricingPage which fetches live Stripe plans.
// Products can override this file to add custom pricing UI without touching @system.
import { PricingPage as SystemPricingPage } from '../../@system/PricingPage'

export function PricingPage() {
  return <SystemPricingPage />
}

export default PricingPage
