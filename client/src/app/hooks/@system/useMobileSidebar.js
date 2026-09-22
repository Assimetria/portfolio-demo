// @system — Hook for managing mobile sidebar drawer state
import { useState, useEffect } from 'react'

/**
 * useMobileSidebar
 * Manages mobile sidebar (drawer) open/close state with viewport detection
 * @returns {{ mobileOpen: boolean, toggleMobile: () => void, closeMobile: () => void, isMobile: boolean }}
 */
export function useMobileSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // lg breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close mobile sidebar when resizing to desktop
  useEffect(() => {
    if (!isMobile && mobileOpen) {
      setMobileOpen(false)
    }
  }, [isMobile, mobileOpen])

  const toggleMobile = () => setMobileOpen((v) => !v)
  const closeMobile = () => setMobileOpen(false)

  return { mobileOpen, toggleMobile, closeMobile, isMobile }
}
