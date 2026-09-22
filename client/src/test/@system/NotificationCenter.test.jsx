// @system — Tests for NotificationCenter dropdown behaviour
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationCenter } from '@/app/components/@system/NotificationCenter'

const notif = (id, over = {}) => ({
  id,
  title: `Notification ${id}`,
  description: 'Some detail',
  variant: 'success',
  read: false,
  timestamp: new Date().toISOString(),
  ...over,
})

describe('NotificationCenter', () => {
  const openBell = async (user) => {
    await user.click(screen.getByRole('button', { name: /notifications/i }))
  }

  it('calls onViewAll from the footer link', async () => {
    const user = userEvent.setup()
    const onViewAll = jest.fn()
    render(<NotificationCenter notifications={[notif(1)]} onViewAll={onViewAll} />)

    await openBell(user)
    await user.click(screen.getByRole('button', { name: /view all notifications/i }))

    expect(onViewAll).toHaveBeenCalledOnce()
  })

  it('shows a loading state while fetching', async () => {
    const user = userEvent.setup()
    render(<NotificationCenter loading notifications={[]} />)
    await openBell(user)
    expect(screen.getByText(/Loading notifications…/)).toBeInTheDocument()
  })

  it('shows an empty state when there are no notifications', async () => {
    const user = userEvent.setup()
    render(<NotificationCenter notifications={[]} />)
    await openBell(user)
    expect(screen.getByText(/No notifications yet/i)).toBeInTheDocument()
  })

  it('marks all as read from the dropdown', async () => {
    const user = userEvent.setup()
    const onMarkAllRead = jest.fn()
    render(<NotificationCenter notifications={[notif(1), notif(2)]} onMarkAllRead={onMarkAllRead} />)

    await openBell(user)
    await user.click(screen.getByRole('button', { name: /mark all read/i }))

    expect(onMarkAllRead).toHaveBeenCalledOnce()
  })

  it('marks a single notification read on click', async () => {
    const user = userEvent.setup()
    const onMarkRead = jest.fn()
    render(<NotificationCenter notifications={[notif(9, { read: false })]} onMarkRead={onMarkRead} />)

    await openBell(user)
    await user.click(screen.getByText('Notification 9'))

    expect(onMarkRead).toHaveBeenCalledWith(9)
  })
})
