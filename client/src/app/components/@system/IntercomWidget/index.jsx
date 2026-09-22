// @system — Intercom live chat widget
// Mirrors Asymetric Ventures' Intercom integration.
// Set VITE_INTERCOM_APP_ID in client .env to enable.
// Renders nothing when not configured.

import { useEffect } from 'react'

const INTERCOM_APP_ID = import.meta.env.VITE_INTERCOM_APP_ID

export default function IntercomWidget({ user }) {
  useEffect(() => {
    if (!INTERCOM_APP_ID) return

    // Load Intercom script
    ;(function () {
      const w = window
      const ic = w.Intercom
      if (typeof ic === 'function') {
        ic('reattach_activator')
        ic('update', w.intercomSettings)
      } else {
        const d = document
        const i = function () { i.c(arguments) }
        i.q = []
        i.c = function (args) { i.q.push(args) }
        w.Intercom = i
        const s = d.createElement('script')
        s.type = 'text/javascript'
        s.async = true
        s.src = `https://widget.intercom.io/widget/${INTERCOM_APP_ID}`
        const x = d.getElementsByTagName('script')[0]
        x.parentNode.insertBefore(s, x)
      }
    })()

    window.Intercom('boot', {
      app_id: INTERCOM_APP_ID,
      user_id: user?.id,
      name: user?.name,
      email: user?.email,
    })

    return () => {
      if (window.Intercom) window.Intercom('shutdown')
    }
  }, [user?.id, user?.name, user?.email])

  return null
}
