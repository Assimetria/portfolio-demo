// @custom — CommentsAlertingPage tests (SV4-136)
// Tests the alerting configuration page including loading, saving, and
// sending test alerts across all configuration sections.
import { render, screen, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import * as alertingApi from '@/app/api/@custom'

// Mock the API module
jest.mock('@/app/api/@custom', () => ({
  getAlertingConfig: jest.fn(),
  updateAlertingConfig: jest.fn(),
  sendTestAlert: jest.fn(),
}))

// Dashboard barrel pulls in heavily-wired Sidebar/Menu components.
jest.mock('@/app/components/@system/Dashboard', () => {
  const Content = ({ children }) => <div data-testid="alerting-content">{children}</div>
  const Layout = ({ children }) => <div>{children}</div>
  Layout.Content = Content
  return { DashboardLayout: Layout }
})

// react-router-dom hooks
jest.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(''), jest.fn()],
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}))

const mockConfig = {
  enabled: true,
  slack_webhook_url: '',
  email_notifications: true,
  error_threshold: 10,
  time_window_minutes: 60,
  notify_on: ['spam', 'abuse', 'technical_error'],
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
}

function renderPage() {
  alertingApi.getAlertingConfig.mockResolvedValue({ config: mockConfig })
  const user = userEvent.setup()

  const CommentsAlertingPage = require('@/app/pages/app/@custom/CommentsAlertingPage').default
  render(<CommentsAlertingPage />)

  return { user }
}

describe('CommentsAlertingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the page title and description', async () => {
    renderPage()
    expect(await screen.findByText('Comments Alerting')).toBeInTheDocument()
    expect(screen.getByText(/configure real-time alerting/i)).toBeInTheDocument()
  })

  it('loads and displays the alerting configuration', async () => {
    renderPage()
    await waitFor(() => {
      expect(alertingApi.getAlertingConfig).toHaveBeenCalledTimes(1)
    })
  })

  it('shows the General section with enable toggle by default', async () => {
    renderPage()
    expect(await screen.findByText('General Settings')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable Alerting')).toBeInTheDocument()
  })

  it('shows navigation sections', async () => {
    renderPage()
    expect(await screen.findByText('General')).toBeInTheDocument()
    expect(screen.getByText('Thresholds')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Quiet Hours')).toBeInTheDocument()
  })

  it('saves configuration from General section', async () => {
    alertingApi.updateAlertingConfig.mockResolvedValue({
      config: { ...mockConfig, enabled: false },
      message: 'Alerting configuration updated successfully',
    })

    const { user } = renderPage()

    // Wait for page to load and toggle the enable switch
    const enableSwitch = await screen.findByLabelText('Enable Alerting')
    await user.click(enableSwitch)

    // Click Save Changes
    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveBtn)

    await waitFor(() => {
      expect(alertingApi.updateAlertingConfig).toHaveBeenCalled()
    })
  })

  it('sends a test alert from General section', async () => {
    alertingApi.sendTestAlert.mockResolvedValue({
      message: 'Test alert sent successfully',
      timestamp: new Date().toISOString(),
    })

    const { user } = renderPage()
    await screen.findByText('General Settings')

    const testBtn = screen.getByRole('button', { name: /send test alert/i })
    await user.click(testBtn)

    await waitFor(() => {
      expect(alertingApi.sendTestAlert).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('Test alert sent successfully')).toBeInTheDocument()
  })

  it('displays error message when loading config fails', async () => {
    alertingApi.getAlertingConfig.mockRejectedValue(new Error('Network error'))

    renderPage()

    expect(await screen.findByText(/failed to load alerting configuration/i)).toBeInTheDocument()
  })

  it('shows different sections when navigated', async () => {
    const { user } = renderPage()
    await screen.findByText('General Settings')

    // Click on Thresholds
    await user.click(screen.getByText('Thresholds'))
    expect(await screen.findByText('Error Thresholds')).toBeInTheDocument()
    expect(screen.getByLabelText('Error Threshold')).toBeInTheDocument()
    expect(screen.getByLabelText('Time Window (minutes)')).toBeInTheDocument()
  })

  it('shows Notifications section with toggle options', async () => {
    const { user } = renderPage()
    await screen.findByText('General Settings')

    await user.click(screen.getByText('Notifications'))
    expect(await screen.findByText('Notification Types')).toBeInTheDocument()

    // Check that notification options are rendered
    expect(screen.getByText('Spam')).toBeInTheDocument()
    expect(screen.getByText('Abuse / Harassment')).toBeInTheDocument()
    expect(screen.getByText('Technical Errors')).toBeInTheDocument()
  })

  it('shows Quiet Hours section with time inputs', async () => {
    const { user } = renderPage()
    await screen.findByText('General Settings')

    await user.click(screen.getByText('Quiet Hours'))
    expect(await screen.findByText('Quiet Hours')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable Quiet Hours')).toBeInTheDocument()
    expect(screen.getByLabelText('Start Time')).toBeInTheDocument()
    expect(screen.getByLabelText('End Time')).toBeInTheDocument()
  })
})