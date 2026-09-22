/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        md: '2rem',
        lg: '2.5rem',
        xl: '3rem',
        '2xl': '3rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    // Families come from brand.json via generated brand.css (--font-*). Use
    // `font-sans` (body), `font-heading` and `font-mono`; never hardcode names.
    fontFamily: {
      sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
    },
    extend: {
      // Mobile-first responsive breakpoints
      screens: {
        'xs': '480px',
        // sm: 640px (Tailwind default)
        // md: 768px (Tailwind default)
        // lg: 1024px (Tailwind default)
        // xl: 1280px (Tailwind default)
        // 2xl: 1536px (Tailwind default)
        // Landscape mobile detection
        'landscape': { 'raw': '(orientation: landscape)' },
        // High-res mobile (retina)
        'retina': { 'raw': '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)' },
      },
      // Mobile-optimized spacing scale
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      // Touch-friendly minimum sizes (WCAG 2.5.5 - 44x44px)
      minHeight: {
        'touch': '44px',
        'touch-sm': '36px',
        'touch-lg': '48px',
      },
      minWidth: {
        'touch': '44px',
        'touch-sm': '36px',
        'touch-lg': '48px',
      },
      // Responsive font sizes (fluid typography)
      fontSize: {
        'xs-fluid': ['clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', { lineHeight: '1.5' }],
        'sm-fluid': ['clamp(0.875rem, 0.8rem + 0.375vw, 1rem)', { lineHeight: '1.5' }],
        'base-fluid': ['clamp(1rem, 0.9rem + 0.5vw, 1.125rem)', { lineHeight: '1.6' }],
        'lg-fluid': ['clamp(1.125rem, 1rem + 0.625vw, 1.25rem)', { lineHeight: '1.6' }],
        'xl-fluid': ['clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)', { lineHeight: '1.4' }],
        '2xl-fluid': ['clamp(1.5rem, 1.3rem + 1vw, 1.875rem)', { lineHeight: '1.3' }],
        '3xl-fluid': ['clamp(1.875rem, 1.5rem + 1.875vw, 2.25rem)', { lineHeight: '1.2' }],
        '4xl-fluid': ['clamp(2.25rem, 1.8rem + 2.25vw, 3rem)', { lineHeight: '1.1' }],
      },
      // Mobile-optimized max widths
      maxWidth: {
        'mobile': '100vw',
        'mobile-safe': 'calc(100vw - 2rem)',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* Brand tokens (set by brand.css — product-specific colors) */
        brand: {
          primary: 'var(--brand-primary)',
          'primary-hover': 'var(--brand-primary-hover)',
          'primary-active': 'var(--brand-primary-active)',
          accent: 'var(--brand-accent)',
          'accent-hover': 'var(--brand-accent-hover)',
          bg: 'var(--brand-bg)',
          surface: 'var(--brand-surface)',
          'surface-hover': 'var(--brand-surface-hover)',
          'surface-active': 'var(--brand-surface-active)',
          border: 'var(--brand-border)',
          'border-subtle': 'var(--brand-border-subtle)',
          'border-strong': 'var(--brand-border-strong)',
          text: 'var(--brand-text)',
          'text-secondary': 'var(--brand-text-secondary)',
          'text-muted': 'var(--brand-text-muted)',
          'text-disabled': 'var(--brand-text-disabled)',
          'text-on-primary': 'var(--brand-text-on-primary)',
          'text-on-accent': 'var(--brand-text-on-accent)',
        },
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        warning: 'var(--color-warning)',
        info: 'var(--color-info)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      height: {
        header: 'var(--header-height)',
      },
      top: {
        header: 'var(--header-height)',
      },
      width: {
        sidebar: 'var(--sidebar-width)',
      },
      maxWidth: {
        content: 'var(--max-width)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
