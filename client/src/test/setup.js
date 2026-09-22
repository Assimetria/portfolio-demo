// Mock import.meta.env (Vite → Jest bridge)
// Tests can override individual keys via: globalThis.__IMPORT_META_ENV__.VITE_X = 'y'
globalThis.__IMPORT_META_ENV__ = {
  PROD: false,
  DEV: true,
  MODE: 'test',
  BASE_URL: '/',
  VITE_APP_URL: 'http://localhost:5173',
  VITE_APP_VERSION: '0.0.0',
  VITE_API_URL: '/api',
}

// Extend expect with @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
require('@testing-library/jest-dom')

// Vitest compatibility: add toHaveBeenCalledOnce (not in Jest by default)
if (typeof expect !== 'undefined') {
  expect.extend({
    toHaveBeenCalledOnce(received) {
      const count = received.mock?.calls?.length ?? 0
      return {
        pass: count === 1,
        message: () =>
          `expected function to have been called once, but was called ${count} time(s)`,
      }
    },
  })
}
