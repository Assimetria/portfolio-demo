# Authentication & Authorization

> Purpose: reference for the template auth system (email/password, OAuth, verification, reset, TOTP, sessions). Security controls and cookie details are summarised in `SECURITY.md`; endpoint conventions in `API.md`.
> Last verified: 2026-09-20 (`server/src/api/@system/{auth,sessions,oauth,totp}`, `server/src/lib/@system/Helpers/{auth,jwt,cookies}.js`).

The product template includes a complete, production-ready authentication system with email/password login, OAuth (Google & GitHub), email verification, password reset, and two-factor authentication (TOTP).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Backend API](#backend-api)
- [Frontend Components](#frontend-components)
- [OAuth Configuration](#oauth-configuration)
- [Email Verification](#email-verification)
- [Password Reset](#password-reset)
- [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
- [Session Management](#session-management)
- [Security Features](#security-features)
- [Usage Examples](#usage-examples)
- [Testing](#testing)

---

## Overview

The authentication system provides:

- **Email/Password Auth** - Traditional login with bcrypt password hashing
- **OAuth 2.0** - Google and GitHub sign-in
- **JWT Sessions** - Secure, stateless authentication with RS256 signing
- **Refresh Tokens** - 7-day sessions with automatic token rotation
- **Email Verification** - Verify email addresses with time-limited tokens
- **Password Reset** - Secure password recovery flow
- **2FA/TOTP** - Optional two-factor authentication
- **Account Lockout** - Brute-force protection (max 5 failed attempts)
- **Session Management** - View and revoke active sessions

---

## Features

✅ **Registration** - Email + password with validation  
✅ **Login** - Email/password or OAuth  
✅ **Logout** - Clear session and blacklist tokens  
✅ **Email Verification** - Token-based email confirmation  
✅ **Password Reset** - Request and complete password reset  
✅ **OAuth** - Google and GitHub sign-in  
✅ **2FA/TOTP** - Optional authenticator app support  
✅ **Session List** - View all active sessions  
✅ **Session Revocation** - Revoke specific sessions  
✅ **Account Lockout** - Prevent brute-force attacks  
✅ **HTTP-Only Cookies** - Secure token storage  
✅ **CSRF Protection** - Token validation on state-changing requests  
✅ **Rate Limiting** - Throttle auth endpoints  

---

## Backend API

### Sessions (Login/Logout)

#### `POST /api/sessions` - Login

Authenticate a user with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (Success):**
```json
{
  "user": {
    "id": 42,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "emailVerified": true,
    "onboardingCompleted": true
  }
}
```

**Response (2FA Required):**
```json
{
  "totp_required": true
}
```

**Cookies Set:**
- `access_token` - Short-lived JWT (15 minutes)
- `refresh_token` - Long-lived opaque token (7 days)

**Error Responses:**
- `401` - Invalid credentials
- `429` - Account locked (too many failed attempts)

---

#### `POST /api/sessions/refresh` - Refresh Access Token

Rotate refresh token and get a new access token.

**Request:**
```bash
# Refresh token sent via HTTP-only cookie
curl -X POST https://api.example.com/api/sessions/refresh \
  -H "Cookie: refresh_token=abc123..."
```

**Response:**
```json
{
  "user": {
    "id": 42,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Cookies Updated:**
- New `access_token`
- New `refresh_token` (old one revoked)

**Security:**
- Detects token reuse and revokes entire session family
- Automatic token rotation on every refresh

---

#### `GET /api/sessions/me` - Get Current User

Get currently authenticated user.

**Response:**
```json
{
  "user": {
    "id": 42,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "emailVerified": true,
    "onboardingCompleted": true
  }
}
```

---

#### `GET /api/sessions` - List Active Sessions

List all active sessions for the current user.

**Response:**
```json
{
  "sessions": [
    {
      "id": 1,
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-03-01T00:00:00Z",
      "expiresAt": "2024-03-08T00:00:00Z",
      "isCurrent": true
    },
    {
      "id": 2,
      "ipAddress": "10.0.0.1",
      "userAgent": "Mobile Safari...",
      "createdAt": "2024-02-28T00:00:00Z",
      "expiresAt": "2024-03-07T00:00:00Z",
      "isCurrent": false
    }
  ]
}
```

---

#### `DELETE /api/sessions/:id` - Revoke Specific Session

Revoke a session by ID (e.g., logout from another device).

**Request:**
```bash
curl -X DELETE https://api.example.com/api/sessions/2 \
  -H "Cookie: access_token=xyz..."
```

**Response:**
```json
{
  "message": "Session revoked"
}
```

---

#### `DELETE /api/sessions` - Logout

Logout current session (blacklist access token, revoke refresh token).

**Response:**
```json
{
  "message": "Logged out"
}
```

**Cookies Cleared:**
- `access_token`
- `refresh_token`

---

### Users (Registration & Profile)

#### `POST /api/users` - Register

Create a new user account.

**Request:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "user": {
    "id": 43,
    "email": "jane@example.com",
    "name": "Jane Smith"
  }
}
```

**Side Effects:**
- Sends verification email (async, non-blocking)
- Password is hashed with bcrypt (12 rounds)

**Validation:**
- Email must be unique
- Password must be at least 8 characters
- Password must contain uppercase, lowercase, and number

---

#### `GET /api/users/me` - Get Profile

Get current user profile.

**Response:**
```json
{
  "user": {
    "id": 42,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "emailVerified": true,
    "onboardingCompleted": true
  }
}
```

---

#### `PATCH /api/users/me` - Update Profile

Update user profile (name only).

**Request:**
```json
{
  "name": "John Smith"
}
```

**Response:**
```json
{
  "user": {
    "id": 42,
    "name": "John Smith",
    "email": "user@example.com"
  }
}
```

---

#### `POST /api/users/me/password` - Change Password

Change password (requires current password).

**Request:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewSecurePassword456"
}
```

**Response:**
```json
{
  "message": "Password updated"
}
```

**Validation:**
- Current password must be correct
- New password must meet requirements

---

### Email Verification

#### `POST /api/users/email/verify/request` - Resend Verification Email

Request a new verification email (authenticated users only).

**Response:**
```json
{
  "message": "Verification email sent. Please check your inbox."
}
```

**Side Effects:**
- Invalidates any existing tokens
- Sends new verification email

---

#### `POST /api/users/email/verify` - Verify Email

Verify email with token from email link.

**Request:**
```json
{
  "token": "abc123..."
}
```

**Response:**
```json
{
  "message": "Email verified successfully.",
  "user": {
    "id": 42,
    "email": "user@example.com",
    "emailVerified": true
  }
}
```

**Side Effects:**
- Marks email as verified
- Invalidates token
- Sends welcome email (async)

**Errors:**
- `400` - Invalid or expired token

---

### Password Reset

#### `POST /api/users/password/request` - Request Password Reset

Request a password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If this email exists, a reset link has been sent."
}
```

**Security:**
- Always returns success to prevent email enumeration
- Sends email only if account exists
- Invalidates any existing reset tokens

---

#### `POST /api/users/password/reset` - Complete Password Reset

Reset password with token from email.

**Request:**
```json
{
  "token": "xyz789...",
  "password": "NewSecurePassword456"
}
```

**Response:**
```json
{
  "message": "Password reset successfully. You can now log in."
}
```

**Validation:**
- Token must be valid and not expired
- Password must meet requirements

**Side Effects:**
- Updates password hash
- Invalidates reset token

---

### OAuth

#### `GET /api/auth/google` - Initiate Google OAuth

Redirects user to Google consent page.

**Flow:**
1. User clicks "Sign in with Google"
2. Redirected to Google consent page
3. User approves
4. Google redirects back to `/api/auth/google/callback`
5. Backend exchanges code for user profile
6. Creates/finds user account
7. Issues JWT session
8. Redirects to `/app`

---

#### `GET /api/auth/google/callback` - Google OAuth Callback

Handles Google OAuth callback (automatic redirect).

**Success:** Redirects to `/app` with session cookie  
**Failure:** Redirects to `/auth?error=oauth_failed`

---

#### `GET /api/auth/github` - Initiate GitHub OAuth

Same flow as Google OAuth.

---

#### `GET /api/auth/github/callback` - GitHub OAuth Callback

Handles GitHub OAuth callback.

---

## Frontend Components

### Pages

#### `/auth` - AuthPage (Unified Login/Register)

Tabbed interface for login and register.

**Features:**
- Login tab with email/password
- Register tab with name, email, password, confirm password
- OAuth buttons (Google & GitHub)
- "Forgot password?" link
- Tab selection via `?tab=register` URL param
- 2FA redirect if TOTP enabled

**Location:** `client/src/app/pages/static/@system/AuthPage.jsx`

---

#### `/login` → `/auth` (Redirect)

Legacy route redirects to `/auth`.

---

#### `/register` - RegisterPage

Standalone registration page.

**Features:**
- Name, email, password, confirm password fields
- Password strength validation
- Show/hide password toggles
- OAuth buttons (Google & GitHub)
- Auto-login after successful registration
- Link to login page

**Location:** `client/src/app/pages/static/@system/RegisterPage.jsx`

---

#### `/forgot-password` - ForgotPasswordPage

Request password reset link.

**Features:**
- Email input field
- Success message (shown even if email doesn't exist)
- Link back to login

**Location:** `client/src/app/pages/static/@system/ForgotPasswordPage.jsx`

---

#### `/reset-password?token=abc123` - ResetPasswordPage

Complete password reset with token.

**Features:**
- Password and confirm password fields
- Token validation
- Success message with auto-redirect to login
- Link to request new token if expired

**Location:** `client/src/app/pages/static/@system/ResetPasswordPage.jsx`

---

#### `/verify-email?token=abc123` - VerifyEmailPage

Verify email with token from verification email.

**Features:**
- Automatic token verification on page load
- Success/error messages
- Link to resend verification email

**Location:** `client/src/app/pages/static/@system/VerifyEmailPage.jsx`

---

#### `/2fa/verify` - TwoFactorVerifyPage

2FA/TOTP challenge page.

**Features:**
- 6-digit code input
- Validates TOTP code from authenticator app
- Auto-redirects to app on success

**Location:** `client/src/app/pages/static/@system/TwoFactorVerifyPage.jsx`

---

### Components

#### `<AuthProvider>` - Auth Context

Provides global auth state and methods.

**Location:** `client/src/app/store/@system/auth.jsx`

**Usage:**
```jsx
import { AuthProvider, useAuthContext } from '@/app/store/@system/auth'

function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  )
}

function Profile() {
  const { user, loading, isAuthenticated, logout } = useAuthContext()
  
  if (loading) return <Spinner />
  if (!isAuthenticated) return <Redirect to="/auth" />
  
  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

**Methods:**
- `login(email, password)` - Login user
- `register(name, email, password)` - Create account and auto-login
- `logout()` - Logout and clear session
- `refresh()` - Refresh user data from server
- `updateUser(fields)` - Update profile
- `resendVerificationEmail()` - Resend verification
- `completeOnboarding(data)` - Mark onboarding complete

---

#### `<ProtectedRoute>` - Route Guard

Requires authentication to access a route.

**Usage:**
```jsx
import { ProtectedRoute } from '@/app/components/@system/ProtectedRoute/ProtectedRoute'

<Route
  path="/app/settings"
  element={
    <ProtectedRoute>
      <SettingsPage />
    </ProtectedRoute>
  }
/>

// Require specific role
<Route
  path="/app/admin"
  element={
    <ProtectedRoute role="admin">
      <AdminPage />
    </ProtectedRoute>
  }
/>
```

---

#### `<OAuthButtons>` - OAuth Sign-In Buttons

Google and GitHub OAuth buttons.

**Usage:**
```jsx
import { OAuthButtons } from '@/app/components/@system/OAuthButtons/OAuthButtons'

<OAuthButtons className="mt-4" />
```

**Location:** `client/src/app/components/@system/OAuthButtons/OAuthButtons.jsx`

---

## OAuth Configuration

### Google OAuth

1. **Create Google OAuth Client:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://yourdomain.com/api/auth/google/callback`

2. **Configure Environment Variables:**

```bash
# server/.env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

3. **Test:**
```bash
curl https://yourdomain.com/api/auth/google
# Should redirect to Google consent page
```

---

### GitHub OAuth

1. **Create GitHub OAuth App:**
   - Go to GitHub Settings → Developer Settings → OAuth Apps
   - Click "New OAuth App"
   - Set Authorization callback URL: `https://yourdomain.com/api/auth/github/callback`

2. **Configure Environment Variables:**

```bash
# server/.env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

3. **Test:**
```bash
curl https://yourdomain.com/api/auth/github
# Should redirect to GitHub authorize page
```

---

## Email Verification

### Flow

1. **User registers** → Backend sends verification email
2. **User clicks link** in email → Opens `/verify-email?token=abc123`
3. **Frontend calls** `POST /api/users/email/verify` with token
4. **Backend verifies** token and marks email as verified
5. **Welcome email** sent (async)

### Email Template

Verification email includes:
- Link to `/verify-email?token={token}`
- Token expires in 24 hours (default)
- Branded email template

### Resend Verification

Users can request a new verification email:

**Frontend:**
```jsx
const { resendVerificationEmail } = useAuthContext()

<button onClick={resendVerificationEmail}>
  Resend verification email
</button>
```

**API:**
```bash
POST /api/users/email/verify/request
Authorization: Bearer <jwt>
```

---

## Password Reset

### Flow

1. **User clicks** "Forgot password?" → Opens `/forgot-password`
2. **User enters email** → Frontend calls `POST /api/users/password/request`
3. **Backend sends** reset email (if account exists)
4. **User clicks link** in email → Opens `/reset-password?token=xyz789`
5. **User enters** new password → Frontend calls `POST /api/users/password/reset`
6. **Backend validates** token and updates password
7. **Success message** → Redirect to `/auth`

### Security

- Tokens expire in 1 hour (default)
- Old tokens invalidated when new one requested
- Always returns success to prevent email enumeration
- Password reset emails include warning about ignoring if not requested

---

## Two-Factor Authentication (2FA)

### Setup

Users can enable TOTP 2FA in settings.

**Backend Endpoints:**
- `POST /api/totp/setup` - Generate TOTP secret and QR code
- `POST /api/totp/verify` - Verify and enable TOTP
- `DELETE /api/totp` - Disable TOTP

### Login Flow with 2FA

1. User enters email + password → `POST /api/sessions`
2. Backend validates credentials
3. If TOTP enabled, return `{ totp_required: true }`
4. Frontend redirects to `/2fa/verify`
5. User enters 6-digit code from authenticator app
6. Frontend submits code → Backend validates and issues session

### QR Code Generation

TOTP setup returns QR code data URL:

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

User scans QR code with authenticator app (Google Authenticator, Authy, etc.).

---

## Session Management

### Token Types

**Access Token (JWT):**
- Short-lived (15 minutes)
- Signed with RS256
- Stored in HTTP-only cookie
- Contains user ID in `userId` claim

**Refresh Token:**
- Long-lived (7 days)
- Opaque, random token (32 bytes hex)
- Stored in HTTP-only cookie (scoped to `/api/sessions`)
- Hashed (SHA-256) before storage

### Token Rotation

Every refresh request:
1. Validates refresh token
2. Revokes old refresh token
3. Issues new refresh token (same family)
4. Issues new access token

**Reuse Detection:**
- If revoked token is used → Revoke entire session family
- Prevents token theft and replay attacks

### Session Families

Sessions are grouped by `family_id`:
- All rotated tokens share the same family
- If one token is compromised, entire family is revoked
- User must re-authenticate

---

## Security Features

### Password Hashing

- **Algorithm:** bcrypt
- **Rounds:** 12
- **Rainbow table resistant:** Yes
- **Salted:** Automatic

### JWT Signing

- **Algorithm:** RS256 (asymmetric)
- **Key Length:** 2048-bit RSA
- **Signature Verification:** Public key
- **Token Lifespan:** 15 minutes (access), 7 days (refresh)

### CSRF Protection

All state-changing requests require CSRF token:

1. Client fetches token: `GET /api/csrf-token`
2. Client includes token in header: `X-CSRF-Token: abc123`
3. Server validates token before processing request

### Rate Limiting

**Login Endpoints:**
- 5 requests / 15 minutes per IP

**Password Reset:**
- 3 requests / 15 minutes per IP

**Registration:**
- 5 requests / 15 minutes per IP

**Token Refresh:**
- 20 requests / 15 minutes per IP

### Account Lockout

**Failed Login Protection:**
- Max 5 failed attempts
- 30-minute lockout after 5 failures
- Warning after 3 failures
- Lockout applies to email, not IP (prevents distributed attacks)

### Cookie Security

```javascript
{
  httpOnly: true,        // Prevents XSS access
  secure: true,          // HTTPS only in production
  sameSite: 'strict',    // CSRF protection
  maxAge: 604800000,     // 7 days (refresh token)
  path: '/'              // Cookie scope
}
```

### Email Validation

- **Format validation:** RFC 5322 compliant
- **Normalization:** Lowercase, trim whitespace
- **Uniqueness:** Enforced at database level

### Password Validation

**Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

**Backend Validator:** `server/src/lib/@system/Helpers/password-validator.js`

---

## Usage Examples

### Frontend Login

```jsx
import { useAuthContext } from '@/app/store/@system/auth'

function LoginForm() {
  const { login } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  
  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await login(email, password)
      // User is now logged in, AuthProvider updates automatically
      navigate('/app')
    } catch (err) {
      setError(err.message)
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
      />
      <input 
        type="password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
      />
      {error && <p>{error}</p>}
      <button type="submit">Login</button>
    </form>
  )
}
```

### Frontend Registration

```jsx
import { useAuthContext } from '@/app/store/@system/auth'

function RegisterForm() {
  const { register } = useAuthContext()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await register(name, email, password)
      // Auto-logged in after registration
      navigate('/app')
    } catch (err) {
      setError(err.message)
    }
  }
  
  return <form>{/* ... */}</form>
}
```

### Backend Middleware

```javascript
const { authenticate } = require('./lib/@system/Middleware')

// Protect route
router.get('/api/protected', authenticate, (req, res) => {
  // req.user is populated by authenticate middleware
  res.json({ user: req.user })
})

// Require admin role
const { requireAdmin } = require('./lib/@system/Middleware')

router.get('/api/admin', authenticate, requireAdmin, (req, res) => {
  // Only accessible to users with role === 'admin'
  res.json({ message: 'Admin access granted' })
})
```

### Custom Password Reset Email

```javascript
const Email = require('./lib/@system/Email')

await Email.sendPasswordResetEmail({
  to: user.email,
  name: user.name,
  token: resetToken,
  userId: user.id
})
```

---

## Testing

### Backend Tests

```javascript
describe('POST /api/sessions (login)', () => {
  test('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({ email: 'test@example.com', password: 'Password123' })
    
    expect(response.status).toBe(200)
    expect(response.body.user.email).toBe('test@example.com')
    expect(response.headers['set-cookie']).toBeDefined()
  })
  
  test('should reject invalid credentials', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({ email: 'test@example.com', password: 'WrongPassword' })
    
    expect(response.status).toBe(401)
  })
  
  test('should lock account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/sessions')
        .send({ email: 'test@example.com', password: 'WrongPassword' })
    }
    
    const response = await request(app)
      .post('/api/sessions')
      .send({ email: 'test@example.com', password: 'Password123' })
    
    expect(response.status).toBe(429)
    expect(response.body.message).toContain('locked')
  })
})
```

### E2E Tests

```typescript
// e2e/@system/02-auth.spec.ts
test('should register, login, and access protected page', async ({ page }) => {
  // Register
  await page.goto('/register')
  await page.fill('input[type="email"]', 'newuser@example.com')
  await page.fill('input[name="name"]', 'New User')
  await page.fill('input[type="password"]', 'Password123')
  await page.fill('input[name="confirmPassword"]', 'Password123')
  await page.click('button[type="submit"]')
  
  // Should be logged in and redirected to app
  await expect(page).toHaveURL('/app')
  
  // Logout
  await page.click('button:has-text("Logout")')
  
  // Login again
  await page.goto('/auth')
  await page.fill('input[type="email"]', 'newuser@example.com')
  await page.fill('input[type="password"]', 'Password123')
  await page.click('button[type="submit"]')
  
  // Should be logged in
  await expect(page).toHaveURL('/app')
})
```

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  name              TEXT,
  password_hash     TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'user',
  stripe_customer_id TEXT,
  email_verified_at TIMESTAMPTZ,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed_at TIMESTAMPTZ,
  totp_enabled      BOOLEAN NOT NULL DEFAULT false,
  totp_secret       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Sessions Table

```sql
CREATE TABLE sessions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  ip_address   TEXT,
  user_agent   TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Refresh Tokens Table

```sql
CREATE TABLE refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  family_id   UUID NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Email Verification Tokens

```sql
CREATE TABLE email_verification_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Password Reset Tokens

```sql
CREATE TABLE password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 hour',
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Environment Variables

```bash
# JWT Signing Keys (auto-generated by bootstrap script)
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...

# App URLs
APP_URL=https://yourdomain.com
SERVER_URL=https://api.yourdomain.com

# OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Email (for verification and password reset)
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxx
EMAIL_FROM="Your App <noreply@yourdomain.com>"

# CSRF Protection
CSRF_SECRET=your-random-32-plus-character-secret
```

---

## Migration

To apply auth schema:

```bash
cd server
npm run migrate
```

Migrations are located in `server/src/db/migrations/@system/`.

---

## Troubleshooting

### "Invalid credentials" even with correct password

- Check password requirements (min 8 chars, uppercase, number)
- Verify email is lowercase (emails are normalized)
- Check if account is locked (too many failed attempts)

### OAuth redirects to `/auth?error=oauth_failed`

- Verify OAuth client ID and secret are set
- Check redirect URI matches exactly (including protocol)
- Ensure OAuth app is enabled in provider console

### Email verification link doesn't work

- Check token hasn't expired (24 hours default)
- Verify email service is configured correctly
- Check email logs for delivery errors

### Session expires too quickly

- Access token: 15 minutes (refresh automatically on frontend)
- Refresh token: 7 days (adjust `REFRESH_TOKEN_TTL_MS`)

### CSRF token errors

- Ensure client fetches CSRF token: `GET /api/csrf-token`
- Include token in header: `X-CSRF-Token: abc123`
- Check cookie and header are sent together

---

## Next Steps

- **Customize email templates** in `server/src/lib/@system/Email/templates/`
- **Add social providers** (Facebook, Twitter, etc.)
- **Implement magic links** (passwordless login)
- **Add biometric auth** (WebAuthn/FIDO2)
- **Set up SSO** (SAML, LDAP)

---

## Resources

- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [OAuth 2.0 Simplified](https://aaronparecki.com/oauth-2-simplified/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Password Hashing Competition](https://password-hashing.net/)

---

**The authentication system is production-ready and battle-tested. Just configure OAuth and email, then ship! 🚀**
