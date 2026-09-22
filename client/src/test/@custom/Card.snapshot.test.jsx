import { render } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/app/components/@system/ui/card'

describe('Card snapshot', () => {
  it('renders empty card', () => {
    const { container } = render(<Card />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders card with header only', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
      </Card>
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders full card with content and footer', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>My Card</CardTitle>
          <CardDescription>A description of the card</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card body content goes here.</p>
        </CardContent>
        <CardFooter>
          <span>Footer</span>
        </CardFooter>
      </Card>
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('applies custom className to Card', () => {
    const { container } = render(<Card className="border-primary" />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
