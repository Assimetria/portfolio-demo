/**
 * OAuth scaffold — passport-google-oauth20
 *
 * This file demonstrates the passport.js approach to Google OAuth as an
 * alternative to the built-in @system OAuth implementation.
 *
 * @system already ships Google + GitHub OAuth (server/src/api/@system/oauth/index.js)
 * using lightweight direct HTTP calls (no passport dependency).
 *
 * Use this scaffold when you need:
 *   - passport.js middleware ecosystem (passport-local, passport-jwt, etc.)
 *   - Multiple strategies managed under one passport instance
 *   - Session-based auth instead of stateless JWTs
 *
 * To activate:
 *   1. npm install passport passport-google-oauth20
 *   2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
 *   3. Mount in server/src/routes/@custom/index.js:
 *        router.use(require('../../routes/auth'))
 *   4. Ensure APP_URL and SERVER_URL are set in .env
 */

const express = require('express')
const { defaultOf } = require('../lib/@system/Env/schema')
const router = express.Router()

// NOTE: passport and passport-google-oauth20 are not in package.json by default.
// They are loaded lazily so the server does not crash if the package is absent.

let passport
let GoogleStrategy

try {
  passport = require('passport')
  GoogleStrategy = require('passport-google-oauth20').Strategy
} catch {
  // Package not installed — routes return 501 Not Implemented
}

function serverUrl() {
  // PORT is normally already defaulted by lib/@system/Env at boot; the schema
  // default is the single fallback for contexts that skip that bootstrap (tests).
  const port = process.env.PORT ?? defaultOf('PORT')
  return process.env.SERVER_URL ?? `http://localhost:${port}`
}

function appUrl() {
  return process.env.APP_URL ?? 'http://localhost:5173'
}

function notInstalled(res) {
  return res.status(501).json({
    message: 'passport-google-oauth20 is not installed. Run: npm install passport passport-google-oauth20',
  })
}

if (passport && GoogleStrategy) {
  const UserRepo = require('../db/repos/@system/UserRepo')
  const OAuthRepo = require('../db/repos/@system/OAuthRepo')
  const { signTokenAsync } = require('../lib/@system/Helpers/jwt')

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        callbackURL: `${serverUrl()}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value ?? null
          const name = profile.displayName ?? null
          const providerId = profile.id

          let user = await OAuthRepo.findUserByProvider('google', providerId)

          if (!user && email) {
            user = await UserRepo.findByEmail(email)
          }

          if (!user) {
            user = await UserRepo.createOAuth({ email, name })
          }

          await OAuthRepo.linkProvider({ userId: user.id, provider: 'google', providerId, email })

          return done(null, user)
        } catch (err) {
          return done(err)
        }
      },
    ),
  )

  // Passport serialize/deserialize (only needed for session-based flows)
  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await UserRepo.findById(id)
      done(null, user)
    } catch (err) {
      done(err)
    }
  })

  router.use(passport.initialize())

  /**
   * GET /api/auth/google
   * Redirect the browser to the Google consent page.
   */
  router.get(
    '/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false }),
  )

  /**
   * GET /api/auth/google/callback
   * Google redirects here after user grants (or denies) consent.
   * On success: issue a JWT cookie and redirect to the app.
   * On failure: redirect to the auth page with an error query param.
   */
  router.get(
    '/auth/google/callback',
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${appUrl()}/auth?error=oauth_failed`,
    }),
    async (req, res) => {
      try {
        const token = await signTokenAsync({ userId: req.user.id })
        const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
        res.cookie('access_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: SESSION_TTL_MS,
        })
        res.redirect(`${appUrl()}/app`)
      } catch {
        res.redirect(`${appUrl()}/auth?error=oauth_failed`)
      }
    },
  )
}

// Stubs when passport is not installed
if (!passport) {
  router.get('/auth/google', (_req, res) => notInstalled(res))
  router.get('/auth/google/callback', (_req, res) => notInstalled(res))
}

module.exports = router
