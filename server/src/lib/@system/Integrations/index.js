// @system — Integration health registry
// Aggregates health/status info from all adapter modules.
// Used by the admin integrations API to surface what's configured vs. missing.

'use strict'

const logger = require('../Logger')

/**
 * @typedef {Object} IntegrationCategory
 * @property {string}   id          Machine-readable ID (e.g. 'email', 'storage')
 * @property {string}   label       Human-readable label
 * @property {string}   description Short description
 * @property {string}   activeProvider  Currently resolved provider name
 * @property {boolean}  configured      Whether the active provider is fully configured
 * @property {Object}   providers   Health info for all available providers in this category
 * @property {string}   envVar      Primary env var that selects the provider
 */

async function getStatus() {
  const categories = []

  // ── Email ──────────────────────────────────────────────────────────────────
  try {
    const Email = require('../Email')
    const { provider } = Email.getTransport()
    categories.push({
      id: 'email',
      label: 'Email',
      description: 'Transactional email delivery (verification, password reset, notifications)',
      envVar: 'EMAIL_PROVIDER',
      activeProvider: provider,
      configured: provider !== 'console',
      providers: {
        ses:     { configured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && (process.env.SES_FROM_EMAIL || process.env.EMAIL_FROM)), envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'SES_FROM_EMAIL'] },
        smtp:    { configured: !!process.env.SMTP_HOST, envVars: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] },
        console: { configured: true, devMode: true, envVars: [] },
      },
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load Email status')
  }

  // ── Payment ────────────────────────────────────────────────────────────────
  try {
    const PaymentAdapter = require('../PaymentAdapter')
    const provider = PaymentAdapter.provider
    categories.push({
      id: 'payment',
      label: 'Payments',
      description: 'Subscription billing and one-time payments',
      envVar: 'PAYMENT_PROVIDER',
      activeProvider: provider,
      configured: !!(provider === 'stripe' ? process.env.STRIPE_SECRET_KEY : process.env.POLAR_ACCESS_TOKEN),
      providers: {
        stripe: { configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET), envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
        polar:  { configured: !!process.env.POLAR_ACCESS_TOKEN, envVars: ['POLAR_ACCESS_TOKEN', 'POLAR_WEBHOOK_SECRET'] },
      },
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load Payment status')
  }

  // ── Storage ────────────────────────────────────────────────────────────────
  try {
    const StorageAdapter = require('../StorageAdapter')
    categories.push({
      id: 'storage',
      label: 'File Storage',
      description: 'File uploads and asset storage',
      envVar: 'STORAGE_PROVIDER',
      activeProvider: StorageAdapter.provider,
      configured: StorageAdapter.health().configured,
      providers: StorageAdapter.healthAll(),
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load Storage status')
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  try {
    const NotificationAdapter = require('../NotificationAdapter')
    categories.push({
      id: 'notifications',
      label: 'Notifications',
      description: 'Operational alerts to Slack, Discord, or console',
      envVar: 'NOTIFICATION_PROVIDER',
      activeProvider: NotificationAdapter.provider,
      configured: NotificationAdapter.provider !== 'console',
      providers: NotificationAdapter.healthAll(),
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load Notification status')
  }

  // ── SMS ────────────────────────────────────────────────────────────────────
  try {
    const SmsAdapter = require('../SmsAdapter')
    categories.push({
      id: 'sms',
      label: 'SMS',
      description: 'SMS messages for OTP, alerts, and user communication',
      envVar: 'SMS_PROVIDER',
      activeProvider: SmsAdapter.provider,
      configured: SmsAdapter.provider !== 'console',
      providers: SmsAdapter.healthAll(),
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load SMS status')
  }

  // ── AI ─────────────────────────────────────────────────────────────────────
  try {
    const aiConfigured = !!process.env.ANTHROPIC_API_KEY
    categories.push({
      id: 'ai',
      label: 'AI',
      description: 'AI model access for chat, completions, and agent features',
      envVar: 'ANTHROPIC_API_KEY',
      activeProvider: aiConfigured ? 'anthropic' : 'none',
      configured: aiConfigured,
      providers: {
        anthropic: { configured: !!process.env.ANTHROPIC_API_KEY, envVars: ['ANTHROPIC_API_KEY'] },
        openai:    { configured: !!process.env.OPENAI_API_KEY, envVars: ['OPENAI_API_KEY'] },
      },
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load AI status')
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  try {
    const SearchAdapter = require('../SearchAdapter')
    const provider = SearchAdapter.provider
    categories.push({
      id: 'search',
      label: 'Search',
      description: 'Full-text search for content, products, and users',
      envVar: 'SEARCH_PROVIDER',
      activeProvider: provider,
      configured: provider !== 'none',
      providers: SearchAdapter.healthAll(),
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load Search status')
  }

  // ── OAuth ──────────────────────────────────────────────────────────────────
  categories.push({
    id: 'oauth',
    label: 'OAuth / Social Login',
    description: 'Third-party sign-in via Google or GitHub',
    envVar: 'GOOGLE_CLIENT_ID',
    activeProvider: (process.env.GOOGLE_CLIENT_ID || process.env.GITHUB_CLIENT_ID) ? 'configured' : 'none',
    configured: !!(process.env.GOOGLE_CLIENT_ID || process.env.GITHUB_CLIENT_ID),
    providers: {
      google: { configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
      github: { configured: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET), envVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'] },
    },
  })

  // ── Conversion Tracking ─────────────────────────────────────────────────
  try {
    const ConversionTracking = require('../ConversionTracking')
    categories.push({
      id: 'conversion-tracking',
      label: 'Conversion Tracking',
      description: 'Server-side conversion events for Google Ads, Facebook Pixel, and LinkedIn',
      envVar: 'GOOGLE_ADS_API_KEY',
      activeProvider: ConversionTracking.provider,
      configured: ConversionTracking.provider !== 'none',
      providers: ConversionTracking.healthAll(),
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load ConversionTracking status')
  }

  // ── Facebook Ads ────────────────────────────────────────────────────────
  try {
    const FacebookAds = require('../FacebookAds')
    categories.push({
      id: 'facebook-ads',
      label: 'Facebook Ads',
      description: 'Programmatic ad campaign management via Facebook Business SDK',
      envVar: 'FACEBOOK_ACCESS_TOKEN',
      activeProvider: FacebookAds.isConfigured() ? 'facebook-ads' : 'none',
      configured: FacebookAds.isConfigured(),
      providers: { 'facebook-ads': FacebookAds.health() },
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load FacebookAds status')
  }

  // ── Invoicing ───────────────────────────────────────────────────────────
  try {
    const InvoiceAdapter = require('../InvoiceAdapter')
    categories.push({
      id: 'invoicing',
      label: 'Invoicing',
      description: 'Invoice generation and client management',
      envVar: 'INVOICE_PROVIDER',
      activeProvider: InvoiceAdapter.provider,
      configured: InvoiceAdapter.provider !== 'console',
      providers: InvoiceAdapter.healthAll(),
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load InvoiceAdapter status')
  }

  // ── Replicate (AI Image Generation) ─────────────────────────────────────
  try {
    const Replicate = require('../Replicate')
    categories.push({
      id: 'replicate',
      label: 'Replicate',
      description: 'AI image generation via Replicate API',
      envVar: 'REPLICATE_API_TOKEN',
      activeProvider: Replicate.isConfigured() ? 'replicate' : 'none',
      configured: Replicate.isConfigured(),
      providers: { replicate: Replicate.health() },
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load Replicate status')
  }

  // ── Creatomate (Video Rendering) ────────────────────────────────────────
  try {
    const Creatomate = require('../Creatomate')
    categories.push({
      id: 'creatomate',
      label: 'Creatomate',
      description: 'Video and creative rendering via Creatomate API',
      envVar: 'CREATOMATE_API_KEY',
      activeProvider: Creatomate.isConfigured() ? 'creatomate' : 'none',
      configured: Creatomate.isConfigured(),
      providers: { creatomate: Creatomate.health() },
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load Creatomate status')
  }

  // ── Ghost CMS (Blog) ───────────────────────────────────────────────────
  try {
    const Ghost = require('../Ghost')
    categories.push({
      id: 'ghost',
      label: 'Ghost CMS',
      description: 'External blog content via Ghost Content API',
      envVar: 'GHOST_URL',
      activeProvider: Ghost.isConfigured() ? 'ghost' : 'none',
      configured: Ghost.isConfigured(),
      providers: { ghost: Ghost.health() },
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load Ghost status')
  }

  // ── GeoIP ─────────────────────────────────────────────────────────────
  try {
    let geoipAvailable = false
    try { require('geoip-lite'); geoipAvailable = true } catch {}
    categories.push({
      id: 'geoip',
      label: 'GeoIP',
      description: 'IP geolocation for session tracking and conversion attribution',
      envVar: null,
      activeProvider: geoipAvailable ? 'geoip-lite' : 'none',
      configured: geoipAvailable,
      providers: { 'geoip-lite': { configured: geoipAvailable, envVars: [] } },
    })
  } catch (err) {
    logger.warn({ err }, '[Integrations] Could not load GeoIP status')
  }

  return {
    timestamp: new Date().toISOString(),
    categories,
    summary: {
      total: categories.length,
      configured: categories.filter((c) => c.configured).length,
      missing: categories.filter((c) => !c.configured).length,
    },
  }
}

module.exports = { getStatus }
