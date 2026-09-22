const { z } = require('zod')

const EnableTotpBody = z.object({
  code: z.union([z.string(), z.number()], { required_error: 'code is required' })
    .transform((v) => String(v).replace(/\s/g, '')),
})

const DisableTotpBody = z.object({
  code: z.union([z.string(), z.number()]).optional().transform((v) => v != null ? String(v).replace(/\s/g, '') : undefined),
  password: z.string().optional(),
}).refine(
  (data) => data.code || data.password,
  { message: 'Either code or password must be provided' }
)

module.exports = { EnableTotpBody, DisableTotpBody }
