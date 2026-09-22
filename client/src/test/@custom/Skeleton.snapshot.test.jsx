import { render } from '@testing-library/react'
import { Skeleton } from '@/app/components/@system/ui/skeleton'

describe('Skeleton snapshot', () => {
  it('renders default skeleton', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with size utility classes', () => {
    const { container } = render(<Skeleton className="h-10 w-full" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders circular avatar skeleton', () => {
    const { container } = render(<Skeleton className="h-12 w-12 rounded-full" />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
