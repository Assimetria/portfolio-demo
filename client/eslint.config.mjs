import { createRequire } from 'module'
import babelParser from '@babel/eslint-parser'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

const require = createRequire(import.meta.url)

// ─── Inline plugin: catch undefined lucide-react icon imports ────────────────
// Prevents runtime errors where unknown icon names become undefined and emit
// console errors in production (ref: #19642, #19633).
let _lucideExports = undefined

function getLucideExports() {
  if (_lucideExports === undefined) {
    try {
      _lucideExports = new Set(Object.keys(require('lucide-react')))
    } catch {
      _lucideExports = null // package not installed — skip validation silently
    }
  }
  return _lucideExports
}

const noUndefinedLucideIconsRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Detect lucide-react icon imports that don't exist in the installed version — prevents undefined icons at runtime",
    },
    schema: [],
    messages: {
      undefinedIcon:
        "'{{ name }}' is not exported by lucide-react. " +
        'It will be undefined at runtime. Check https://lucide.dev/icons/ for the correct icon name.',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'lucide-react') return

        const validExports = getLucideExports()
        if (!validExports) return // graceful no-op when package is not installed

        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue

          const name = specifier.imported.name
          if (!validExports.has(name)) {
            context.report({
              node: specifier,
              messageId: 'undefinedIcon',
              data: { name },
            })
          }
        }
      },
    }
  },
}

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  // Babel parser — handles JSX, TypeScript, and modern syntax across all source files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      // Build-time constants injected by webpack DefinePlugin
      globals: { __MODULES__: 'readonly' },
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-react', { runtime: 'automatic' }],
            ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
          ],
        },
      },
    },
  },
  // React Hooks rules
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // React Refresh — only-export-components for safe HMR.
  // Pure helpers were moved out of component files (lib/@system/plans.js,
  // lib/@system/analytics.js, lib/@system/facebookPixel.js, AdminPage/format.js).
  // What remains co-located is intentional and allow-listed by name:
  //   - cva variant objects next to their shadcn primitive (buttonVariants, badgeVariants)
  //   - hooks that expose a component-owned context (useMobileSidebar, useCookieConsent,
  //     useCommandPalette, useFeatureSpotlight)
  //   - declarative config tables next to the components that render them
  //     (commonBulkActions, STEPS)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: [
            'buttonVariants',
            'badgeVariants',
            'commonBulkActions',
            'STEPS',
            'useMobileSidebar',
            'useCookieConsent',
            'useCommandPalette',
            'useFeatureSpotlight',
          ],
        },
      ],
    },
  },
  // Store modules (src/app/store/**) are provider + context + hook by design —
  // the @system/@custom contract is `import { XProvider, useX } from '@/app/store/…'`.
  // Fast Refresh remounts these on edit, which is acceptable for app-level state.
  {
    files: ['src/app/store/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // lucide-react: catch undefined icon imports at lint time
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      lucide: {
        rules: { 'no-undefined-icons': noUndefinedLucideIconsRule },
      },
    },
    rules: {
      'lucide/no-undefined-icons': 'error',
    },
  },
]
