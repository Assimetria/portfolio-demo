// @custom — Auth endpoint overrides for this product.
//
// store/@system/auth.jsx does `require('@/app/config/@custom/auth-config')` and
// merges `endpoints` over its defaults. The module has to exist for webpack to
// resolve the import (a missing file is a build error, not a soft fallback), so
// the template ships this empty override. Example:
//
//   export const endpoints = { login: '/api/auth/login', me: '/api/auth/me' }

export const endpoints = {}

export default { endpoints }
