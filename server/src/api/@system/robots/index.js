const express = require('express')
const router = express.Router()

router.get('/robots.txt', (req, res) => {
  // Use the request origin so the Sitemap URL matches the actual domain
  // visitors/crawlers see, not the APP_URL env var. (#36939)
  const appUrl = `${req.protocol}://${req.get('host')}`

  const txt = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /app/',
    'Disallow: /auth/',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /signup',
    'Disallow: /forgot-password',
    'Disallow: /reset-password',
    'Disallow: /verify-email',
    'Disallow: /2fa',
    'Disallow: /onboarding',
    'Disallow: /dashboard',
    '',
    `Sitemap: ${appUrl}/sitemap.xml`,
    '',
  ].join('\n')

  res.set('Content-Type', 'text/plain')
  res.send(txt)
})

module.exports = router
