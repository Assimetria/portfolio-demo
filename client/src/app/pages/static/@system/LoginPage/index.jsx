// @system — LoginPage re-exports AuthPage (split layout, no navbar).
// All auth routes (/login, /auth, /register) share the same full-screen
// split-panel layout with NO topbar/header. The AuthPage tab defaults to
// "login" when there is no ?tab=register query param.
export { AuthPage as LoginPage } from '../AuthPage'
