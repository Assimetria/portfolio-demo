// @system/@custom — Routes barrel
//
// Hand-authored on purpose. scripts/@system/generate-barrels.js regenerates
// routes/@system/index.js as an EMPTY barrel ("No route modules discovered"),
// and this file used to `export * from './@system'` — so <AppRoutes /> was
// undefined, the app rendered nothing, and webpack emitted zero page chunks.
// Always import AppRoutes explicitly from its module.
//
// AppRoutes.jsx is the runtime-authoritative route table (lazy-loaded pages,
// GuestRoute/ProtectedRoute wrappers, redirects). Products override or add
// routes in routes/@custom/index.jsx via mergeRoutes() — never edit AppRoutes.
export { AppRoutes } from './@system/AppRoutes'
export { mergeRoutes, isRouteLocked } from './@system/utils'
export * from './@custom'
