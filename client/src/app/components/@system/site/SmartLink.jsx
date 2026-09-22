// @system — Link that does the right thing for every href shape used in site.js:
//   "#contact"        → smooth-scroll on the home page (navigates to /#contact elsewhere)
//   "/pricing"        → react-router <Link>
//   "https://…", "mailto:", "tel:" → plain <a>
// Used by Hero / Services / Footer so content authors never think about it.
import { forwardRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { scrollToAnchor } from './SiteNavbar'

const isExternal = (href) => /^(https?:)?\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')

export const SmartCta = forwardRef(function SmartCta({ href = '#', children, onClick, ...rest }, ref) {
  const location = useLocation()
  const navigate = useNavigate()

  if (href.startsWith('#')) {
    return (
      <a
        ref={ref}
        href={href}
        onClick={(e) => {
          onClick?.(e)
          if (e.defaultPrevented) return
          e.preventDefault()
          if (location.pathname !== '/') {
            navigate('/' + href)
            return
          }
          scrollToAnchor(href)
        }}
        {...rest}
      >
        {children}
      </a>
    )
  }
  if (isExternal(href)) {
    const newTab = href.startsWith('http')
    return (
      <a ref={ref} href={href} onClick={onClick} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link ref={ref} to={href} onClick={onClick} {...rest}>
      {children}
    </Link>
  )
})

export default SmartCta
