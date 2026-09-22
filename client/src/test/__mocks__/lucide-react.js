// Lightweight lucide-react mock — prevents Jest from transforming the full 32 MB library
// Returns a stub SVG element for every icon import
const React = require('react')

const handler = {
  get(_, name) {
    if (name === '__esModule') return true
    if (name === 'default') return handler
    // Return a minimal React component for any icon name
    const Icon = React.forwardRef(function MockIcon(props, ref) {
      return React.createElement('svg', { ...props, ref, 'data-testid': `icon-${name}` })
    })
    Icon.displayName = name
    return Icon
  },
}

module.exports = new Proxy({}, handler)
