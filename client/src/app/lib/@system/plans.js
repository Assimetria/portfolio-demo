// @system — plan-tier helpers shared by UpgradeModal, SettingsPlanCard and BillingPage.
// Kept out of the component modules so React Fast Refresh can hot-swap them.

/** Normalise a plan name/slug for comparison ("Pro " → "pro"). */
export function normalizePlan(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
}

/** True when the user has no paid subscription (defaults an unknown user to free). */
export function isFreeUser(user) {
  return normalizePlan(user?.subscription?.plan ?? user?.plan ?? 'free') === 'free'
}
