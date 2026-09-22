const express = require('express')
const router = express.Router()

// @custom — register your product-specific routers here.
// This file is NEVER overwritten during template sync.
//
// Imports are wrapped in try/catch so a broken @custom file doesn't crash the server.
//
// Do not register /health or /ready here: app.js mounts the @system health
// router ahead of the /api route merge, so a @custom copy is never reached.

try { router.use(require('../../api/@custom/dashboard')) } catch (e) { console.error('[custom] dashboard route failed to load:', e.message) }
try { router.use(require('../../api/@custom/billing')) } catch (e) { console.error('[custom] billing route failed to load:', e.message) }
try { router.use(require('../../api/@custom/settings')) } catch (e) { console.error('[custom] settings route failed to load:', e.message) }
try { router.use(require('../../api/@custom/admin')) } catch (e) { console.error('[custom] admin route failed to load:', e.message) }
try { router.use(require('../../api/@custom/tenants')) } catch (e) { console.error('[custom] tenants route failed to load:', e.message) }

module.exports = router
