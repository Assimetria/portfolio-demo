// @system — AuthPage: full-screen split-panel auth (Clerk/Linear/Lovable quality)
// Left: animated brand panel with social proof. Right: centered form card.
// All colors from brand CSS vars. Products customize copy via @custom/text + info.auth.

import { useState, useEffect, useCallback } from "react"
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom"
import { useAuthContext } from "@/app/store/@system/auth"
import { info, text, isModuleEnabled } from "@/config"
import { OAuthButtons } from "@/app/components/@system/OAuthButtons"
import { Button } from "@/app/components/@system/ui/button"
import { Input } from "@/app/components/@system/ui/input"
import { Label } from "@/app/components/@system/ui/label"
import { Checkbox } from "@/app/components/@system/ui/checkbox"
import "./index.scss"

const at = text.auth ?? {}
const authInfo = info.auth ?? {}

// Feature modules (brand.json `modules`): with selfRegistration off the page is
// login-only — no register form, no "Sign up" toggle, ?tab=register ignored
// (the server answers 403 on the register endpoints anyway). Billing off drops
// the ?plan= upgrade redirect into /app/billing.
const CAN_REGISTER = isModuleEnabled("selfRegistration")
const HAS_BILLING = isModuleEnabled("billing")

function EyeIcon({ open }) {
  if (open) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
      <line x1="2" x2="22" y1="2" y2="22"/>
    </svg>
  )
}

function PasswordStrength({ password }) {
  if (!password) return null
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const levels = ['Weak', 'Fair', 'Good', 'Strong', 'Excellent']
  const colors = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981']
  const level = Math.min(score, 4)
  return (
    <div className="auth-strength">
      <div className="auth-strength-bar">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="auth-strength-segment" style={{
            background: i <= level ? colors[level] : 'var(--brand-border, rgba(63,63,70,0.3))',
          }} />
        ))}
      </div>
      <span className="auth-strength-label" style={{ color: colors[level] }}>{levels[level]}</span>
    </div>
  )
}

function FeatureItem({ children }) {
  return (
    <li className="auth-feature-item">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="auth-feature-check">
        <circle cx="8" cy="8" r="8" fill="var(--brand-primary, #64748B)" opacity="0.15"/>
        <path d="M5 8l2 2 4-4" stroke="var(--brand-primary, #64748B)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>{children}</span>
    </li>
  )
}

function BrandPanel() {
  const features = authInfo.features ?? [
    'Authentication with OAuth & TOTP',
    'Stripe billing wired end-to-end',
    'Deploy anywhere in one command',
  ]
  const testimonial = authInfo.testimonial ?? null
  const logoSrc = info.logoWhite || info.logoDark || info.logo
  const productName = info.name

  return (
    <div className="auth-brand-panel">
      {/* Animated gradient orbs */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      {/* Noise overlay for texture */}
      <div className="auth-noise" />

      <div className="auth-brand-content">
        {/* Logo + badge */}
        <div className="auth-brand-header">
          {logoSrc ? (
            <img src={logoSrc} alt={productName} className="auth-brand-logo" />
          ) : (
            <span className="auth-brand-wordmark">{productName}</span>
          )}
          {authInfo.badge && (
            <span className="auth-brand-badge">{authInfo.badge}</span>
          )}
        </div>

        {/* Headline */}
        <h2 className="auth-brand-headline">
          {authInfo.description || `Everything you need to build and ship your ${info.description || 'product'}.`}
        </h2>

        {/* Features */}
        <ul className="auth-feature-list">
          {features.map((f, i) => <FeatureItem key={i}>{f}</FeatureItem>)}
        </ul>

        {/* Testimonial */}
        {testimonial && (
          <div className="auth-testimonial">
            <blockquote className="auth-testimonial-quote">
              &ldquo;{testimonial.quote}&rdquo;
            </blockquote>
            <div className="auth-testimonial-author">
              <div className="auth-testimonial-avatar">
                {testimonial.initials || testimonial.name?.charAt(0) || '?'}
              </div>
              <div>
                <div className="auth-testimonial-name">{testimonial.name}</div>
                <div className="auth-testimonial-role">{testimonial.role}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login, register } = useAuthContext()

  const defaultMode = CAN_REGISTER && searchParams.get("tab") === "register" ? "register" : "login"
  const planParam = HAS_BILLING ? searchParams.get("plan") : null
  const [mode, setMode] = useState(defaultMode)
  const [transitioning, setTransitioning] = useState(false)

  const oauthError = searchParams.get("error") === "oauth_failed"
    ? "OAuth sign-in failed. Please try again or use email & password."
    : null

  // Login state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginEmailError, setLoginEmailError] = useState("")
  const [loginPasswordError, setLoginPasswordError] = useState("")
  const [loginError, setLoginError] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [showLoginPw, setShowLoginPw] = useState(false)

  // Register state
  const [regName, setRegName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regError, setRegError] = useState("")
  const [regLoading, setRegLoading] = useState(false)
  const [showRegPw, setShowRegPw] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  const from = location.state?.from?.pathname ?? "/app"

  const switchMode = useCallback((next) => {
    setTransitioning(true)
    setTimeout(() => {
      setMode(next)
      setLoginError("")
      setLoginEmailError("")
      setLoginPasswordError("")
      setRegError("")
      setTimeout(() => setTransitioning(false), 50)
    }, 200)
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError("")
    setLoginEmailError("")
    setLoginPasswordError("")

    let hasError = false
    if (!loginEmail) { setLoginEmailError("Email is required"); hasError = true }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) { setLoginEmailError("Enter a valid email"); hasError = true }
    if (!loginPassword) { setLoginPasswordError("Password is required"); hasError = true }
    if (hasError) return

    setLoginLoading(true)
    try {
      const result = await login(loginEmail, loginPassword)
      if (result?.totp_required) {
        navigate("/2fa/verify", { state: { email: loginEmail, password: loginPassword } })
        return
      }
      navigate(planParam ? "/app/billing?upgrade=" + planParam : from, { replace: true })
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setRegError("")
    if (regPassword.length < 8) { setRegError("Password must be at least 8 characters"); return }
    if (!termsAccepted) { setRegError("Please accept the terms to continue"); return }

    setRegLoading(true)
    try {
      const displayName = regName || regEmail.split("@")[0] || ""
      await register(displayName, regEmail, regPassword)
      navigate(planParam ? "/app/billing?upgrade=" + planParam : "/app", { replace: true })
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setRegLoading(false)
    }
  }

  // The card shows a 44×44 box: prefer the square mark over the wide wordmark.
  const logoSrc = info.logo || info.logoUrl
  const productName = info.name

  return (
    <div className="auth-page">
      {/* Left brand panel — hidden on mobile */}
      <BrandPanel />

      {/* Right form panel */}
      <div className="auth-form-panel">
        <div className={`auth-card ${transitioning ? 'auth-card-exit' : 'auth-card-enter'}`}>
          {/* Logo */}
          <div className="auth-logo-wrap">
            {logoSrc ? (
              <img src={logoSrc} alt={productName} className="auth-logo-img" />
            ) : (
              <span className="auth-logo-text">{productName}</span>
            )}
          </div>

          {/* Heading */}
          <h1 className="auth-title">
            {mode === "login"
              ? (at.loginTitle ?? "Welcome back")
              : (at.registerTitle ?? "Create your account")}
          </h1>
          <p className="auth-subtitle">
            {mode === "login"
              ? (at.loginSubtitle ?? "Sign in to continue to " + productName)
              : (at.registerSubtitle ?? "Start building with " + productName)}
          </p>

          {/* Google OAuth */}
          <OAuthButtons showDivider={false} />

          {/* Divider */}
          <div className="auth-divider"><span>or continue with email</span></div>

          {/* Login Form */}
          {mode === "login" && (
            <form onSubmit={handleLogin} noValidate>
              <div className="auth-field">
                <Label htmlFor="login-email" className="auth-label">Email address</Label>
                <Input
                  id="login-email"
                  type="email"
                  className={"auth-input" + (loginEmailError ? " auth-input-error" : "")}
                  placeholder="name@company.com"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); setLoginEmailError("") }}
                  autoComplete="email"
                  autoFocus
                />
                {loginEmailError && <p className="auth-error-inline" role="alert">{loginEmailError}</p>}
              </div>
              <div className="auth-field">
                <div className="auth-label-row">
                  <Label htmlFor="login-password" className="auth-label">Password</Label>
                  <Link to="/forgot-password" className="auth-forgot-link" tabIndex={-1}>Forgot?</Link>
                </div>
                <div className="auth-password-wrap">
                  <Input
                    id="login-password"
                    type={showLoginPw ? "text" : "password"}
                    className={"auth-input auth-input-pw" + (loginPasswordError ? " auth-input-error" : "")}
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => { setLoginPassword(e.target.value); setLoginPasswordError("") }}
                    autoComplete="current-password"
                  />
                  <button type="button" className="auth-pw-toggle" onClick={() => setShowLoginPw(v => !v)} tabIndex={-1} aria-label={showLoginPw ? "Hide password" : "Show password"}>
                    <EyeIcon open={showLoginPw} />
                  </button>
                </div>
                {loginPasswordError && <p className="auth-error-inline" role="alert">{loginPasswordError}</p>}
              </div>
              {loginError && <div className="auth-error-banner" role="alert"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>{loginError}</div>}
              <Button type="submit" fullWidth loading={loginLoading} className="auth-submit">
                Sign in
              </Button>
            </form>
          )}

          {/* Register Form */}
          {CAN_REGISTER && mode === "register" && (
            <form onSubmit={handleRegister} noValidate>
              <div className="auth-field">
                <Label htmlFor="reg-name" className="auth-label">Full name</Label>
                <Input
                  id="reg-name"
                  type="text"
                  className="auth-input"
                  placeholder="Jane Smith"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                />
              </div>
              <div className="auth-field">
                <Label htmlFor="reg-email" className="auth-label">Work email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  className="auth-input"
                  placeholder="name@company.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="auth-field">
                <Label htmlFor="reg-password" className="auth-label">Password</Label>
                <div className="auth-password-wrap">
                  <Input
                    id="reg-password"
                    type={showRegPw ? "text" : "password"}
                    className="auth-input auth-input-pw"
                    placeholder="Min. 8 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" className="auth-pw-toggle" onClick={() => setShowRegPw(v => !v)} tabIndex={-1} aria-label={showRegPw ? "Hide password" : "Show password"}>
                    <EyeIcon open={showRegPw} />
                  </button>
                </div>
                <PasswordStrength password={regPassword} />
              </div>

              <label className="auth-terms-check">
                <Checkbox checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(!!checked)} />
                <span>I agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a></span>
              </label>

              {regError && <div className="auth-error-banner" role="alert"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>{regError}</div>}
              <Button type="submit" fullWidth loading={regLoading} className="auth-submit">
                Create account
              </Button>
            </form>
          )}

          {oauthError && <div className="auth-error-banner" role="alert">{oauthError}</div>}

          {/* Mode toggle — hidden entirely when self-registration is off */}
          {CAN_REGISTER && (
            <p className="auth-toggle">
              {mode === "login" ? (
                <>Don&apos;t have an account?{" "}<button type="button" className="auth-toggle-btn" onClick={() => switchMode("register")}>Sign up free</button></>
              ) : (
                <>Already have an account?{" "}<button type="button" className="auth-toggle-btn" onClick={() => switchMode("login")}>Sign in</button></>
              )}
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="auth-footer">
          &copy; {new Date().getFullYear()} {productName}. All rights reserved.
        </p>
      </div>
    </div>
  )
}
