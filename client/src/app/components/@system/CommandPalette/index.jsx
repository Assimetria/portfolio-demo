// @system — Command Palette (Cmd+K style search)
// Quick navigation and action search with keyboard shortcuts
//
// Usage:
// <CommandPalette
//   commands={commands}
//   onSelect={(command) => command.action()}
// />

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight, Hash } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'

/**
 * CommandPalette — Quick action/navigation palette
 * @param {Object} props
 * @param {Array} props.commands - Array of command objects
 * @param {Function} [props.onSelect] - Command select handler
 * @param {string} [props.placeholder='Search commands...'] - Input placeholder
 * @param {boolean} [props.open=false] - Open state (controlled)
 * @param {Function} [props.onOpenChange] - Open state change handler
 */
export function CommandPalette({
  commands = [],
  onSelect,
  placeholder = 'Search commands...',
  open: controlledOpen,
  onOpenChange,
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(controlledOpen ?? false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)

  const isControlled = controlledOpen !== undefined

  const handleOpenChange = useCallback(
    (newOpen) => {
      if (isControlled) {
        onOpenChange?.(newOpen)
      } else {
        setOpen(newOpen)
      }
    },
    [isControlled, onOpenChange],
  )

  const isOpen = isControlled ? controlledOpen : open

  // Filter commands based on search
  const filteredCommands = search
    ? commands.filter((cmd) => {
        const searchLower = search.toLowerCase()
        return (
          cmd.label?.toLowerCase().includes(searchLower) ||
          cmd.category?.toLowerCase().includes(searchLower) ||
          cmd.keywords?.some((k) => k.toLowerCase().includes(searchLower))
        )
      })
    : commands

  // Group by category
  const grouped = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || 'Commands'
    if (!acc[category]) acc[category] = []
    acc[category].push(cmd)
    return acc
  }, {})

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        handleOpenChange(!isOpen)
        return
      }

      if (!isOpen) return

      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault()
        handleOpenChange(false)
        setSearch('')
        setSelected(0)
        return
      }

      // Arrow navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((prev) => Math.min(prev + 1, filteredCommands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((prev) => Math.max(prev - 1, 0))
      }

      // Enter to select
      if (e.key === 'Enter' && filteredCommands[selected]) {
        e.preventDefault()
        handleSelect(filteredCommands[selected])
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selected, handleOpenChange, handleSelect])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle command selection
  const handleSelect = useCallback((command) => {
    if (command.action) {
      command.action()
    } else if (command.href) {
      navigate(command.href)
    }

    if (onSelect) {
      onSelect(command)
    }

    // Close and reset
    handleOpenChange(false)
    setSearch('')
    setSelected(0)
  }, [navigate, onSelect, handleOpenChange])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
      onClick={() => handleOpenChange(false)}
    >
      <div
        className="relative w-full max-w-2xl mt-24 bg-brand-bg rounded-lg shadow-2xl animate-in zoom-in-95 slide-in-from-top-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-5 w-5 text-brand-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelected(0)
            }}
            placeholder={placeholder}
            className="flex-1 bg-transparent border-0 focus:outline-none text-sm"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-brand-surface rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {Object.keys(grouped).length === 0 ? (
            <div className="py-12 text-center text-sm text-brand-text-muted">
              No commands found
            </div>
          ) : (
            Object.entries(grouped).map(([category, cmds]) => (
              <div key={category} className="mb-2">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-brand-text-muted">
                  <Hash className="h-3 w-3" />
                  {category}
                </div>
                {cmds.map((cmd, index) => {
                  const globalIndex = filteredCommands.indexOf(cmd)
                  const isSelected = globalIndex === selected
                  const Icon = cmd.icon

                  return (
                    <button
                      key={cmd.id || index}
                      onClick={() => handleSelect(cmd)}
                      onMouseEnter={() => setSelected(globalIndex)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                        isSelected && 'bg-brand-surface-hover'
                      )}
                    >
                      {Icon && (
                        <span className="shrink-0 text-brand-text-muted">
                          <Icon className="h-4 w-4" />
                        </span>
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-medium">{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-xs text-brand-text-muted">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-brand-surface rounded">
                          {cmd.shortcut}
                        </kbd>
                      )}
                      <ArrowRight className="h-4 w-4 text-brand-text-muted shrink-0" />
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-brand-text-muted">
          <span>Navigate with ↑ ↓ arrows</span>
          <span>Select with ↵ Enter</span>
        </div>
      </div>
    </div>
  )
}

/**
 * useCommandPalette — Hook to manage command palette state
 * @returns {Object} { open, setOpen, toggle }
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  const toggle = () => setOpen((prev) => !prev)

  return { open, setOpen, toggle }
}
