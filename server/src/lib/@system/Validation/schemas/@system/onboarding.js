const { z } = require('zod')

const CompleteOnboardingBody = z.object({
  name: z.string().trim().min(1, 'name must be a non-empty string').optional(),
  useCase: z.string().optional(),
  referralSource: z.string().optional(),
})

module.exports = { CompleteOnboardingBody }
