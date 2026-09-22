import { render } from '@testing-library/react'
import { Button } from '@/app/components/@system/ui/button'

describe('Button snapshot', () => {
  it('renders default variant', () => {
    const { container } = render(<Button>Click me</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders destructive variant', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders outline variant', () => {
    const { container } = render(<Button variant="outline">Cancel</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders secondary variant', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders ghost variant', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders link variant', () => {
    const { container } = render(<Button variant="link">Link</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders small size', () => {
    const { container } = render(<Button size="sm">Small</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders large size', () => {
    const { container } = render(<Button size="lg">Large</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders icon size', () => {
    const { container } = render(<Button size="icon" aria-label="icon" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders disabled', () => {
    const { container } = render(<Button disabled>Disabled</Button>)
    expect(container.firstChild).toMatchSnapshot()
  })
})
