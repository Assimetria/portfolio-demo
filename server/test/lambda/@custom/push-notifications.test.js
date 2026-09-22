/**
 * Lambda handler tests for push-notifications processor ([SV4-172])
 *
 * Tests the actual AWS Lambda handler functions including event routing,
 * batch processing, state management, and error handling.
 * AWS SDK clients (SNS, DynamoDB) are mocked to avoid external calls.
 */

const { v4: uuidv4 } = require('uuid')

// ── Mock AWS SDK modules ───────────────────────────────────────────────────
const mockSend = jest.fn()

jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn(() => ({
    send: mockSend,
  })),
  PublishCommand: jest.fn(),
}))

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({
    send: mockSend,
  })),
}))

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend,
    })),
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
}))

// Clear env before each test
beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.PUSH_NOTIFICATIONS_TABLE
  delete process.env.NOTIFICATION_SNS_TOPIC
  delete process.env.AWS_REGION
})

// ── Module under test ──────────────────────────────────────────────────────
const {
  handler,
  processBatch,
  processNotification,
  readProcessorState,
  writeProcessorState,
  inMemoryStore,
} = require('../../../src/lambda/@custom/push-notifications')
describe('pushNotifications Lambda handler', () => {
  describe('readProcessorState / writeProcessorState', () => {
    beforeEach(() => {
      // Reset in-memory store
      inMemoryStore.totalProcessed = 0
      inMemoryStore.failedCount = 0
      inMemoryStore.lastProcessedAt = null
      inMemoryStore.status = 'idle'
    })

    it('returns initial idle state', async () => {
      const state = await readProcessorState()
      expect(state.status).toBe('idle')
      expect(state.totalProcessed).toBe(0)
      expect(state.failedCount).toBe(0)
    })

    it('persists and retrieves state via in-memory store', async () => {
      await writeProcessorState({
        status: 'ready',
        lastProcessedAt: '2026-01-01T00:00:00.000Z',
        totalProcessed: 50,
        failedCount: 2,
      })
      const state = await readProcessorState()
      expect(state.status).toBe('ready')
      expect(state.totalProcessed).toBe(50)
      expect(state.failedCount).toBe(2)
    })
  })

  describe('processNotification', () => {
    it('returns skipped for null notification', async () => {
      const result = await processNotification(null)
      expect(result.status).toBe('skipped')
      expect(result.reason).toContain('null or undefined')
    })

    it('returns skipped for notification missing userId', async () => {
      const result = await processNotification({ title: 'Test', body: 'Body' })
      expect(result.status).toBe('skipped')
      expect(result.reason).toContain('userId')
    })

    it('returns skipped for notification missing title and body', async () => {
      const result = await processNotification({ userId: 'user-1' })
      expect(result.status).toBe('skipped')
      expect(result.reason).toContain('title or body')
    })

    it('processes a valid notification successfully (no SNS topic)', async () => {
      const notification = { userId: 'user-1', title: 'Hello', body: 'World' }
      const result = await processNotification(notification)
      expect(result.status).toBe('delivered')
      expect(result.userId).toBe('user-1')
      expect(result.notificationId).toBeDefined()
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('processes a valid notification with SNS delivery', async () => {
      process.env.NOTIFICATION_SNS_TOPIC = 'arn:aws:sns:eu-west-1:123456789012:test-topic'
      mockSend.mockResolvedValue({ MessageId: 'mocked-msg-id' })

      const notification = { userId: 'user-1', title: 'Push', body: 'Test', type: 'push' }
      const result = await processNotification(notification)
      expect(result.status).toBe('delivered')
      expect(mockSend).toHaveBeenCalled()
    })

    it('handles delivery failure gracefully', async () => {
      process.env.NOTIFICATION_SNS_TOPIC = 'arn:aws:sns:eu-west-1:123456789012:test-topic'
      mockSend.mockRejectedValue(new Error('SNS throttling error'))

      const notification = { userId: 'user-1', title: 'Fail', body: 'Test' }
      const result = await processNotification(notification)
      expect(result.status).toBe('failed')
      expect(result.error).toBe('SNS throttling error')
    })
  })
describe('processBatch', () => {
    beforeEach(() => {
      inMemoryStore.totalProcessed = 0
      inMemoryStore.failedCount = 0
      inMemoryStore.status = 'idle'
    })

    it('processes a batch of valid notifications', async () => {
      const notifications = [
        { userId: 'user-1', title: 'A', body: '1' },
        { userId: 'user-2', title: 'B', body: '2' },
        { userId: 'user-3', title: 'C', body: '3' },
      ]
      const result = await processBatch(notifications)
      expect(result.batchSize).toBe(3)
      expect(result.processed).toBe(3)
      expect(result.failed).toBe(0)
    })

    it('updates processor state after batch', async () => {
      const notifications = [
        { userId: 'user-1', title: 'A', body: '1' },
      ]
      await processBatch(notifications)
      const state = await readProcessorState()
      expect(state.totalProcessed).toBe(1)
      expect(state.status).toBe('ready')
    })

    it('handles mixed successes and failures', async () => {
      const notifications = [
        { userId: 'user-1', title: 'Good', body: '1' },
        null,
        { title: 'No userId', body: '2' },
        { userId: 'user-3', title: 'Bad', body: '3' },
      ]
      const result = await processBatch(notifications)
      expect(result.batchSize).toBe(4)
      expect(result.processed).toBe(2)
      expect(result.failed).toBe(2)
    })

    it('includes details in the result', async () => {
      const notifications = [
        { userId: 'user-1', title: 'A', body: '1' },
      ]
      const result = await processBatch(notifications)
      expect(result.details).toBeDefined()
      expect(result.details.succeeded).toHaveLength(1)
      expect(result.details.failed).toHaveLength(0)
      expect(result.startedAt).toBeDefined()
      expect(result.completedAt).toBeDefined()
    })
  })

  describe('handler — event routing', () => {
    beforeEach(() => {
      inMemoryStore.totalProcessed = 0
      inMemoryStore.failedCount = 0
    })

    it('handles direct invocation event', async () => {
      const event = { batchSize: 5, userId: 'test-user' }
      const result = await handler(event, { invokedFunctionArn: 'test:arn' })
      expect(result.batchSize).toBe(5)
      expect(result.processed).toBeGreaterThanOrEqual(0)
      expect(result.failed).toBe(0)
    })

    it('handles SQS event', async () => {
      const event = {
        Records: [
          {
            body: JSON.stringify({ userId: 'u1', title: 'T1', body: 'B1' }),
          },
          {
            body: JSON.stringify({ userId: 'u2', title: 'T2', body: 'B2' }),
          },
        ],
      }
      const result = await handler(event, { invokedFunctionArn: 'test:arn' })
      expect(result.batchSize).toBe(2)
      expect(result.processed).toBe(2)
    })

    it('handles Scheduled / CloudWatch event', async () => {
      const event = { source: 'aws.events', 'detail-type': 'Scheduled Event' }
      const result = await handler(event, { invokedFunctionArn: 'test:arn' })
      expect(result.status).toBe('maintenance_complete')
    })

    it('throws on malformed SQS event', async () => {
      const event = { Records: 'not-an-array' }
      await expect(handler(event, { invokedFunctionArn: 'test:arn' })).rejects.toThrow()
    })
  })
})