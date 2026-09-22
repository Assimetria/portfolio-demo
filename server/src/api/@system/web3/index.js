// @system — Web3 wallet authentication API
// Mirrors Asymetric Ventures' wallet-based auth flow.
// Verifies a signed message from MetaMask to authenticate users.
// Only active when authMode is 'web3' in .config/info.js.
// Request body is validated with zod (Validation/schemas/@system/web3.js).
'use strict'

const express = require('express')
const router = express.Router()
const { createHash } = require('crypto')
const jwt = require('jsonwebtoken')
const logger = require('../../../lib/@system/Logger')
const db = require('../../../lib/@system/PostgreSQL')
const { validate } = require('../../../lib/@system/Validation')
const { WalletAuthBody } = require('../../../lib/@system/Validation/schemas/@system/web3')

let ethers = null
try { ethers = require('ethers') } catch { /* optional */ }

const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY
const JWT_ALGORITHM = JWT_PRIVATE_KEY?.startsWith('-----') ? 'RS256' : 'HS256'

// POST /api/auth/wallet — authenticate via signed message
router.post('/auth/wallet', express.json(), validate({ body: WalletAuthBody }), async (req, res, next) => {
  try {
    if (!ethers) return res.status(501).json({ message: 'Web3 authentication not available (ethers not installed)' })

    const { address, message, signature, timestamp } = req.body
    if (!address || !message || !signature) {
      return res.status(400).json({ message: 'address, message, and signature are required' })
    }

    // Verify timestamp is within 5 minutes to prevent replay attacks
    if (timestamp && Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return res.status(401).json({ message: 'Signature expired' })
    }

    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature)
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ message: 'Invalid signature' })
    }

    // Find or create user by wallet address
    const normalizedAddress = address.toLowerCase()
    let user = await db.oneOrNone('SELECT * FROM users WHERE wallet_address = $1', [normalizedAddress])

    if (!user) {
      user = await db.one(
        `INSERT INTO users (wallet_address, name, email, auth_provider)
         VALUES ($1, $2, $3, 'wallet')
         RETURNING *`,
        [normalizedAddress, `${address.slice(0, 6)}...${address.slice(-4)}`, `${normalizedAddress}@wallet`],
      )
      logger.info({ address: normalizedAddress }, 'new wallet user created')
    }

    // Issue JWT
    const payload = { id: user.id, address: normalizedAddress }
    const token = jwt.sign(payload, JWT_PRIVATE_KEY, { algorithm: JWT_ALGORITHM, expiresIn: '7d' })

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, wallet_address: user.wallet_address },
    })
  } catch (err) { next(err) }
})

module.exports = router
