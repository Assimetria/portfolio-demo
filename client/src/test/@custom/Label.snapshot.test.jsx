import { render } from '@testing-library/react'
import { Label } from '@/app/components/@system/ui/label'

describe('Label snapshot', () => {
  it('renders default label', () => {
    const { container } = render(<Label>Email</Label>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with htmlFor attribute', () => {
    const { container } = render(<Label htmlFor="email">Email address</Label>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('applies custom className', () => {
    const { container } = render(<Label className="text-destructive">Required</Label>)
    expect(container.firstChild).toMatchSnapshot()
  })
})
