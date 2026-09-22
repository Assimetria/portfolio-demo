import { Link } from 'react-router-dom'
import { Lock, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'
import { useUpgradeModal } from '@/app/store/@system/upgradeModal'

export function UpgradeGate() {
  const { openUpgrade } = useUpgradeModal()
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-surface">
          <Lock className="h-8 w-8 text-brand-text-muted" />
        </div>
        <h1 className="text-2xl font-bold">Upgrade required</h1>
        <p className="mt-3 text-brand-text-muted">
          This feature is not available on your current plan. Upgrade to unlock access.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => openUpgrade('UpgradeGate')} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Upgrade now
          </Button>
          <Button variant="outline" asChild><Link to="/app/billing">Compare plans</Link></Button>
          <Button variant="ghost" asChild><Link to="/app">Back to Dashboard</Link></Button>
        </div>
      </div>
    </div>
  )
}

