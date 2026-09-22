// @system — Two-Factor Authentication setup wizard
// Renders a multi-step flow: generate secret → scan QR → verify code → done
import { useState } from 'react'
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react'
import { Button } from '@/app/components/@system/ui/button'
import { FormField, Input } from '@/app/components/@system/Form'
import { api } from '@/app/lib/@system/api'



export function TwoFactorSetup({ enabled, onStatusChange }) {
  const [step, setStep] = useState('idle')
  const [setupData, setSetupData] = useState(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function startSetup() {
    setLoading(true)
    setError('')
    try {
      const data = await api.post('/users/me/2fa/setup', {})
      setSetupData(data)
      setStep('setup')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  async function confirmEnable() {
    if (!code.trim()) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/users/me/2fa/enable', { code: code.trim() })
      setStep('done')
      onStatusChange(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function disable() {
    if (!code.trim() && !password.trim()) {
      setError('Enter your TOTP code or account password to confirm.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/users/me/2fa/disable', {
        ...(code.trim() ? { code: code.trim() } : {}) })
      setStep('idle')
      setCode('')
      setPassword('')
      onStatusChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disable failed')
    } finally {
      setLoading(false)
    }
  }

  function copySecret() {
    if (!setupData?.secret) return
    navigator.clipboard.writeText(setupData.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Disable form (2FA is currently active) ────────────────────────────────
  if (enabled && step === 'idle') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-success)] font-medium">
          <ShieldCheck className="h-4 w-4" />
          Two-factor authentication is enabled
        </div>
        <p className="text-sm text-brand-text-muted">
          Disable 2FA by providing your current authenticator code or your account password.
        </p>
        <FormField label="Authenticator Code">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
          />
        </FormField>
        <p className="text-xs text-brand-text-muted text-center">— or —</p>
        <FormField label="Account Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your current password"
          />
        </FormField>
        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
        <Button
          variant="outline"
          className="gap-2 text-[var(--color-error)] border-destructive/40 hover:bg-[var(--color-error-bg)]"
          onClick={disable}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
          {loading ? 'Disabling…' : 'Disable 2FA'}
        </Button>
      </div>
    )
  }

  // ── Step 1: Prompt to begin setup ─────────────────────────────────────────
  if (step === 'idle') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-brand-text-muted">
          Add an extra layer of security to your account using a TOTP authenticator app (e.g. Google
          Authenticator, Authy, 1Password).
        </p>
        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
        <Button onClick={startSetup} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {loading ? 'Generating…' : 'Set Up 2FA'}
        </Button>
      </div>
    )
  }

  // ── Step 2: Show QR code + manual secret ──────────────────────────────────
  if (step === 'setup' && setupData) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-brand-text-muted">
          Scan this QR code with your authenticator app, then enter the 6-digit code it generates.
        </p>
        <div className="flex justify-center">
          <img
            src={setupData.qrCodeDataUrl}
            alt="TOTP QR Code"
            className="h-48 w-48 sm:h-56 sm:w-56 md:h-64 md:w-64 rounded-md border"
            loading="lazy"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-brand-text-muted">Can't scan? Enter this key manually:</p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <code className="flex-1 rounded bg-brand-surface px-2 py-1.5 sm:py-1 text-xs font-mono break-all min-h-touch sm:min-h-0">
              {setupData.secret}
            </code>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={copySecret} 
              className="shrink-0 w-full sm:w-auto min-h-touch sm:min-h-0"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span className="ml-2 sm:hidden">{copied ? 'Copied!' : 'Copy Key'}</span>
            </Button>
          </div>
        </div>
        <Button variant="outline" onClick={() => setStep('verify')} className="w-full sm:w-auto">
          I've scanned the code →
        </Button>
      </div>
    )
  }

  // ── Step 3: Verify first code ─────────────────────────────────────────────
  if (step === 'verify') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-brand-text-muted">
          Enter the 6-digit code from your authenticator app to activate 2FA.
        </p>
        <FormField label="Verification Code">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
            autoFocus
          />
        </FormField>
        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          <Button onClick={confirmEnable} disabled={loading} className="gap-2 w-full sm:w-auto">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Verifying…' : 'Enable 2FA'}
          </Button>
          <Button variant="outline" onClick={() => setStep('setup')} className="w-full sm:w-auto">
            Back
          </Button>
        </div>
      </div>
    )
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-success)] font-medium">
        <ShieldCheck className="h-4 w-4" />
        2FA enabled successfully. Your account is now more secure.
      </div>
    )
  }

  return null
}
