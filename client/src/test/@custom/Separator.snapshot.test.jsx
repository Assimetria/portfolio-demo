import { render } from '@testing-library/react'
import { Separator } from '@/app/components/@system/ui/separator'

describe('Separator snapshot', () => {
  it('renders default horizontal separator', () => {
    const { container } = render(<Separator />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders vertical separator', () => {
    const { container } = render(<Separator orientation="vertical" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders non-decorative separator', () => {
    const { container } = render(<Separator decorative={false} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('applies custom className', () => {
    const { container } = render(<Separator className="my-4" />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
