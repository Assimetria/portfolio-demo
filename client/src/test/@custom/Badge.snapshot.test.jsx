import { render } from '@testing-library/react'
import { Badge } from '@/app/components/@system/ui/badge'

describe('Badge snapshot', () => {
  it('renders default variant', () => {
    const { container } = render(<Badge>New</Badge>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders secondary variant', () => {
    const { container } = render(<Badge variant="secondary">Secondary</Badge>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders destructive variant', () => {
    const { container } = render(<Badge variant="destructive">Error</Badge>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders outline variant', () => {
    const { container } = render(<Badge variant="outline">Outline</Badge>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('applies custom className', () => {
    const { container } = render(<Badge className="ml-2">Tagged</Badge>)
    expect(container.firstChild).toMatchSnapshot()
  })
})
