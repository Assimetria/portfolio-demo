// @custom — FeatureFlagsTab double-submit guard tests
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen } from '../test-utils'
import userEvent from '@testing-library/user-event'
import { FeatureFlagsTab } from '@/app/pages/app/@system/AdminPage/FeatureFlagsTab'

const mockFlags = [
  { key: 'dark_mode', label: 'Dark Mode', description: 'Enable dark mode', category: 'general', enabled: true },
  { key: 'beta_dashboard', label: 'Beta Dashboard', description: 'New dashboard UI', category: 'beta', enabled: false },
  { key: 'email_verification', label: 'Email Verification', description: null, category: 'email', enabled: true },
]

function renderTab(overrides = {}) {
  const defaults = {
    featureFlags: mockFlags,
    flagsLoading: false,
    flagsError: '',
    flagUpdating: null,
    flagAdding: false,
    flagDeleting: null,
    flagCategoryFilter: '',
    setFlagCategoryFilter: jest.fn(),
    showAddFlag: false,
    setShowAddFlag: jest.fn(),
    newFlag: { key: '', label: '', description: '', category: 'general' },
    setNewFlag: jest.fn(),
    fetchFeatureFlags: jest.fn(),
    handleFlagToggle: jest.fn(),
    handleAddFlag: jest.fn(),
    handleDeleteFlag: jest.fn(),
  }
  const props = { ...defaults, ...overrides }
  return render(<FeatureFlagsTab {...props} />)
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('FeatureFlagsTab — double-submit guards', () => {
  it('renders feature flags with toggle switches', () => {
    renderTab()
    expect(screen.getByText('Dark Mode')).toBeInTheDocument()
    expect(screen.getByText('Beta Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Email Verification')).toBeInTheDocument()
  })

  it('disables toggle when flagUpdating matches the flag key', () => {
    renderTab({ flagUpdating: 'dark_mode' })
    const toggles = screen.getAllByRole('switch')
    expect(toggles[0]).toBeDisabled()
    expect(toggles[1]).not.toBeDisabled()
    expect(toggles[2]).not.toBeDisabled()
  })

  it('does not disable any toggle when flagUpdating is null', () => {
    renderTab({ flagUpdating: null })
    const toggles = screen.getAllByRole('switch')
    toggles.forEach(toggle => {
      expect(toggle).not.toBeDisabled()
    })
  })

  it('disables Create button when flagAdding is true', () => {
    renderTab({
      showAddFlag: true,
      flagAdding: true,
      newFlag: { key: 'test_key', label: 'Test Label', description: '', category: 'general' },
    })
    expect(screen.getByText('Create')).toBeDisabled()
  })

  it('enables Create button when flagAdding is false and fields are filled', () => {
    renderTab({
      showAddFlag: true,
      flagAdding: false,
      newFlag: { key: 'test_key', label: 'Test Label', description: '', category: 'general' },
    })
    expect(screen.getByText('Create')).not.toBeDisabled()
  })

  it('disables delete button when flagDeleting matches the flag key', () => {
    renderTab({ flagDeleting: 'beta_dashboard' })
    const deleteButtons = screen.getAllByRole('button').filter(btn =>
      btn.querySelector('svg') && !btn.textContent
    )
    expect(deleteButtons[0]).not.toBeDisabled()
    expect(deleteButtons[1]).toBeDisabled()
    expect(deleteButtons[2]).not.toBeDisabled()
  })

  it('does not disable any delete button when flagDeleting is null', () => {
    renderTab({ flagDeleting: null })
    const deleteButtons = screen.getAllByRole('button').filter(btn =>
      btn.querySelector('svg') && !btn.textContent
    )
    deleteButtons.forEach(btn => {
      expect(btn).not.toBeDisabled()
    })
  })
})

describe('FeatureFlagsTab — interaction', () => {
  it('calls handleFlagToggle when a toggle is clicked', async () => {
    const handleFlagToggle = jest.fn()
    renderTab({ handleFlagToggle })
    const toggles = screen.getAllByRole('switch')
    await userEvent.click(toggles[0])
    expect(handleFlagToggle).toHaveBeenCalledTimes(1)
    expect(handleFlagToggle).toHaveBeenCalledWith(mockFlags[0])
  })

  it('does not call handleFlagToggle when toggle is disabled', async () => {
    const handleFlagToggle = jest.fn()
    renderTab({ flagUpdating: 'dark_mode', handleFlagToggle })
    const toggles = screen.getAllByRole('switch')
    await userEvent.click(toggles[0])
    expect(handleFlagToggle).not.toHaveBeenCalled()
  })

  it('calls handleDeleteFlag when delete button is clicked', async () => {
    const handleDeleteFlag = jest.fn()
    renderTab({ handleDeleteFlag })
    const buttons = screen.getAllByRole('button')
    const deleteButtons = buttons.filter(btn =>
      btn.querySelector('svg') && !btn.textContent
    )
    await userEvent.click(deleteButtons[0])
    expect(handleDeleteFlag).toHaveBeenCalledTimes(1)
    expect(handleDeleteFlag).toHaveBeenCalledWith('dark_mode')
  })

  it('calls handleAddFlag when Create is clicked with valid inputs', async () => {
    const handleAddFlag = jest.fn()
    renderTab({
      showAddFlag: true,
      handleAddFlag,
      newFlag: { key: 'test_key', label: 'Test Label', description: '', category: 'general' },
    })
    await userEvent.click(screen.getByText('Create'))
    expect(handleAddFlag).toHaveBeenCalledTimes(1)
  })

  it('shows add flag form when showAddFlag is true', () => {
    renderTab({ showAddFlag: true })
    expect(screen.getByText('New Feature Flag')).toBeInTheDocument()
  })

  it('shows error message when flagsError is provided', () => {
    renderTab({ flagsError: 'Failed to load flags' })
    expect(screen.getByText('Failed to load flags')).toBeInTheDocument()
  })

  it('renders empty state when no flags are present', () => {
    renderTab({ featureFlags: [] })
    expect(screen.getByText(/No feature flags configured/)).toBeInTheDocument()
  })
})