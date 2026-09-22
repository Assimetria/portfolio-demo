// @system — upgradeModal store + controller
// Global hook + provider so any component can open the in-app UpgradeModal.
//
// Usage:
//   import { UpgradeProvider, useUpgradeModal } from '@/app/store/@system/upgradeModal'
//
//   function BillingButton() {
//     const { openUpgrade } = useUpgradeModal()
//     return <button onClick={() => openUpgrade('Billing · Change plan')}>Change plan</button>
//   }
//
//   <UpgradeProvider>
//     <App />
//   </UpgradeProvider>
//
// The provider renders the shared <UpgradeModal> once, above the app tree, so
// every component — dashboards, settings, gated features, the sidebar — opens
// the exact same modal. Requires being mounted inside AuthProvider (the modal
// reads the current plan from there).

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { UpgradeModal } from '@/app/components/@system/UpgradeModal'

const UpgradeModalContext = createContext(null)

/**
 * UpgradeProvider — mounts a single shared UpgradeModal and exposes the hook.
 */
export function UpgradeProvider({ children, plans }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('')

  const openUpgrade = useCallback((from) => {
    setSource(typeof from === 'string' ? from : '')
    setOpen(true)
  }, [])

  const closeUpgrade = useCallback(() => {
    setOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      open,
      source,
      openUpgrade,
      closeUpgrade,
    }),
    [open, source, openUpgrade, closeUpgrade]
  )

  return (
    <UpgradeModalContext.Provider value={value}>
      {children}
      <UpgradeModal
        open={open}
        onClose={closeUpgrade}
        source={source}
        plans={plans}
      />
    </UpgradeModalContext.Provider>
  )
}

/**
 * useUpgradeModal — access shared upgrade state + controls.
 * @returns {{ open: boolean, source: string, openUpgrade: (from?:string)=>void, closeUpgrade: ()=>void }}
 */
export function useUpgradeModal() {
  const ctx = useContext(UpgradeModalContext)
  if (!ctx) {
    throw new Error('useUpgradeModal must be used within an <UpgradeProvider>')
  }
  return ctx
}
