// @system — zod request schemas for src/api/@system/web3/index.js
// Signed-message wallet login body. Address format is left to ethers
// (verifyMessage + lowercase compare) so the schema is not stricter than the handler.
const { z } = require('zod')

// POST /auth/wallet
const WalletAuthBody = z.object({
  address: z.string().min(1, 'address is required').max(100),
  message: z.string().min(1, 'message is required').max(5000),
  signature: z.string().min(1, 'signature is required').max(500),
  // Epoch ms; handler compares against Date.now() when present
  timestamp: z.coerce.number().optional(),
})

module.exports = { WalletAuthBody }
