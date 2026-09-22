// @system — Skip-to-content link for keyboard/screen-reader users (WCAG 2.1 SC 2.4.1)
// Visually hidden until focused via Tab, then appears as a prominent link at top-left

export function SkipToContent() {
  function handleClick(e) {
    e.preventDefault()
    const main = document.getElementById('main-content') || document.querySelector('main')
    if (main) {
      main.setAttribute('tabindex', '-1')
      main.focus()
      main.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-brand-text-on-primary focus:rounded-md focus:font-medium focus:text-sm focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
    >
      Skip to main content
    </a>
  )
}
