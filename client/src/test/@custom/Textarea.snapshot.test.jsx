import { render } from '@testing-library/react'
import { Textarea } from '@/app/components/@system/ui/textarea'

describe('Textarea snapshot', () => {
  it('renders default textarea', () => {
    const { container } = render(<Textarea />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with placeholder', () => {
    const { container } = render(<Textarea placeholder="Tell us more..." />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders disabled', () => {
    const { container } = render(<Textarea disabled defaultValue="locked" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with custom rows and className', () => {
    const { container } = render(<Textarea rows={6} className="min-h-[200px]" />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
