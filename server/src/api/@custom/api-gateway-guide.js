/**
 * @custom — API Gateway onboarding guide API
 *
 * Provides guide steps and progress tracking for the API Gateway onboarding
 * experience. Progress is stored in-memory (for demo/example purposes).
 *
 * GET  /api/api-gateway-guide         — fetch guide steps + user progress
 * POST /api/api-gateway-guide/progress — mark a step as completed
 * POST /api/api-gateway-guide/reset    — reset all progress
 */

const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers')

// ── Guide steps definition ───────────────────────────────────────────────────
const GUIDE_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to API Gateway',
    description: 'Learn the basics of API Gateway and how it fits into your architecture.',
    details:
      'API Gateway is the entry point for all client requests. It handles routing, authentication, rate limiting, and request transformation before forwarding to backend services.',
  },
  {
    id: 'authentication',
    title: 'Configure Authentication',
    description: 'Set up API keys and JWT-based authentication for secure access.',
    details:
      'Choose between API key authentication for machine-to-machine communication or JWT-based auth for user-facing endpoints. Both can be used together for layered security.',
  },
  {
    id: 'rate-limiting',
    title: 'Set Up Rate Limiting',
    description: 'Protect your backend from abuse with configurable rate limits.',
    details:
      'Define rate limits per client, per endpoint, or globally. Configure burst allowances and custom response headers so consumers know their usage limits.',
  },
  {
    id: 'routing',
    title: 'Define Routes & Policies',
    description: 'Map incoming requests to the appropriate backend services.',
    details:
      'Create route rules that match URL patterns, HTTP methods, and headers. Attach policies for CORS, request/response transformation, and caching.',
  },
  {
    id: 'monitoring',
    title: 'Enable Monitoring & Logging',
    description: 'Track API usage, errors, and performance metrics in real-time.',
    details:
      'Integrate with your observability stack to collect request logs, error rates, latency percentiles, and traffic patterns. Set up alerts for anomaly detection.',
  },
  {
    id: 'deployment',
    title: 'Deploy to Production',
    description: 'Promote your gateway configuration through environments.',
    details:
      'Use the CI/CD pipeline to promote gateway configs from dev → staging → production. Enable canary deployments to test changes with a subset of traffic before full rollout.',
  },
]

// ── In-memory progress store (replace with DB in production) ─────────────────
const progressStore = new Map()

// GET /api/api-gateway-guide — fetch guide steps + progress
router.get('/api-gateway-guide', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id
    if (!progressStore.has(userId)) {
      progressStore.set(userId, { completedSteps: [], startedAt: new Date().toISOString() })
    }
    const userProgress = progressStore.get(userId)

    res.json({
      steps: GUIDE_STEPS,
      progress: {
        completedSteps: userProgress.completedSteps,
        totalSteps: GUIDE_STEPS.length,
        startedAt: userProgress.startedAt,
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/api-gateway-guide/progress — mark a step as completed
router.post('/api-gateway-guide/progress', authenticate, async (req, res, next) => {
  try {
    const { stepId } = req.body

    if (!stepId) {
      return res.status(400).json({ error: 'stepId is required' })
    }

    const stepExists = GUIDE_STEPS.some((s) => s.id === stepId)
    if (!stepExists) {
      return res.status(400).json({ error: `Invalid stepId: ${stepId}` })
    }

    const userId = req.user.id
    if (!progressStore.has(userId)) {
      progressStore.set(userId, { completedSteps: [], startedAt: new Date().toISOString() })
    }

    const userProgress = progressStore.get(userId)
    if (!userProgress.completedSteps.includes(stepId)) {
      userProgress.completedSteps.push(stepId)
    }

    res.json({
      success: true,
      progress: {
        completedSteps: userProgress.completedSteps,
        totalSteps: GUIDE_STEPS.length,
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/api-gateway-guide/reset — reset all progress
router.post('/api-gateway-guide/reset', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id
    progressStore.set(userId, { completedSteps: [], startedAt: new Date().toISOString() })

    res.json({
      success: true,
      progress: {
        completedSteps: [],
        totalSteps: GUIDE_STEPS.length,
      },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router