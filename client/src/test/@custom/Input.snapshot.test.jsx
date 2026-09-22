import { render } from '@testing-library/react'
import { Input } from '@/app/components/@system/ui/input'

describe('Input snapshot', () => {
  it('renders default text input', () => {
    const { container } = render(<Input />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders email input with placeholder', () => {
    const { container } = render(<Input type="email" placeholder="you@example.com" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders password input', () => {
    const { container } = render(<Input type="password" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders disabled input', () => {
    const { container } = render(<Input disabled defaultValue="locked" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('applies custom className', () => {
    const { container } = render(<Input className="max-w-xs" />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
