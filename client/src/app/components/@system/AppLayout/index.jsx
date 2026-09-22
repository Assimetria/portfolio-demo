// @system -- Shared layout for all /app/* pages.
// Renders Sidebar + <Outlet /> so individual pages
// no longer need to import/render their own sidebar.
import { Outlet } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import { Sidebar } from '../Sidebar'
import { useAuthContext } from '@/app/store/@system/auth'
import { useTheme } from '@/app/store/@system/theme'
import { useNavigate } from 'react-router-dom'

// Context so child pages can open the mobile sidebar
const MobileSidebarContext = createContext({ open: () => {} })
export const useMobileSidebar = () => useContext(MobileSidebarContext)

export default function AppLayout(props) {
  const { user, token, logout } = useAuthContext()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [badges, setBadges] = useState({})

  // Fetch inbox unread count for badge
  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch('/api/game/inbox?unread=true', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && !cancelled) {
          setBadges(prev => ({ ...prev, inbox: data.unreadCount || 0 }))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [token])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <MobileSidebarContext.Provider value={{ open: () => setMobileOpen(true) }}>
      <div className="flex h-screen bg-[var(--brand-bg)]">
        <Sidebar
          badges={badges}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          user={user}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <main className="flex-1 overflow-auto">
            {props.children || <Outlet />}
          </main>
        </div>
      </div>
    </MobileSidebarContext.Provider>
  )
}
