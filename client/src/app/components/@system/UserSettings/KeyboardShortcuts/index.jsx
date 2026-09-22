// @system — Keyboard shortcuts settings panel
// Displays all available shortcuts, allows customization, and provides search.

import { useState } from 'react'
import { Search, Command, X } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Card } from '../../Card'
import { Badge } from '../../Badge'

const isMac = typeof window !== 'undefined' 
  ? navigator.platform.toUpperCase().indexOf('MAC') >= 0 
  : false

export function KeyboardShortcuts({
  shortcuts = [],
  customShortcuts = {},
  onCustomize,
  editable = false,
  className
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingKey, setEditingKey] = useState(null)

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(shortcut)
    return acc
  }, {})

  // Filter shortcuts by search
  const filteredGroups = Object.entries(groupedShortcuts).reduce((acc, [category, items]) => {
    const filtered = items.filter(item =>
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keys.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    if (filtered.length > 0) {
      acc[category] = filtered
    }
    return acc
  }, {})

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Keyboard Shortcuts</h3>
        <p className="text-sm text-brand-text-muted">
          Learn or customize keyboard shortcuts to work faster.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search shortcuts..."
          className={cn(
            'w-full pl-10 pr-10 py-2 text-sm rounded-lg border border-brand-border bg-brand-bg',
            'placeholder:text-brand-text-muted',
            'focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2'
          )}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Shortcuts list */}
      <div className="space-y-6">
        {Object.entries(filteredGroups).map(([category, items]) => (
          <div key={category}>
            <h4 className="text-sm font-semibold mb-3">{category}</h4>
            <Card className="divide-y">
              {items.map((shortcut, index) => (
                <ShortcutRow
                  key={index}
                  shortcut={shortcut}
                  customKeys={customShortcuts[shortcut.id]}
                  isEditing={editingKey === shortcut.id}
                  onEdit={() => setEditingKey(shortcut.id)}
                  onSave={(keys) => {
                    onCustomize?.(shortcut.id, keys)
                    setEditingKey(null)
                  }}
                  onCancel={() => setEditingKey(null)}
                  editable={editable}
                />
              ))}
            </Card>
          </div>
        ))}
      </div>

      {Object.keys(filteredGroups).length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-brand-text-muted">
            No shortcuts found matching "{searchQuery}"
          </p>
        </div>
      )}
    </div>
  )
}

function ShortcutRow({
  shortcut,
  customKeys,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  editable
}) {
  const keys = customKeys || shortcut.keys
  
  return (
    <div className="flex items-center justify-between p-4 hover:bg-brand-surface-hover/30 transition-colors">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium">{shortcut.description}</p>
        {shortcut.note && (
          <p className="text-xs text-brand-text-muted mt-1">{shortcut.note}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Type shortcut..."
              className="w-32 px-2 py-1 text-xs rounded border border-brand-border"
              autoFocus
            />
            <button
              onClick={onSave}
              className="text-xs text-brand-primary hover:underline"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="text-xs text-brand-text-muted hover:text-brand-text"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <KeyCombo keys={keys} />
            {editable && !shortcut.fixed && (
              <button
                onClick={onEdit}
                className="text-xs text-brand-text-muted hover:text-brand-text ml-2"
              >
                Edit
              </button>
            )}
            {customKeys && (
              <Badge variant="secondary" className="text-xs ml-2">
                Custom
              </Badge>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function KeyCombo({ keys }) {
  // Format keys for display (replace Cmd with ⌘, etc.)
  const formatKey = (key) => {
    if (isMac) {
      return key
        .replace('Cmd', '⌘')
        .replace('Alt', '⌥')
        .replace('Shift', '⇧')
        .replace('Ctrl', '⌃')
    }
    return key
  }

  return (
    <div className="flex items-center gap-1">
      {keys.map((key, index) => (
        <div key={index} className="flex items-center gap-1">
          <kbd className="inline-flex h-6 items-center gap-1 rounded border border-[var(--brand-border-subtle)] bg-brand-surface px-2 font-mono text-xs font-medium">
            {formatKey(key)}
          </kbd>
          {index < keys.length - 1 && (
            <span className="text-xs text-brand-text-muted">or</span>
          )}
        </div>
      ))}
    </div>
  )
}

// Example shortcuts structure:
// const defaultShortcuts = [
//   {
//     id: 'search',
//     category: 'General',
//     description: 'Open search',
//     keys: isMac ? ['⌘K'] : ['Ctrl+K'],
//     fixed: true
//   },
//   {
//     id: 'new',
//     category: 'General',
//     description: 'Create new item',
//     keys: isMac ? ['⌘N'] : ['Ctrl+N']
//   },
//   {
//     id: 'save',
//     category: 'Editing',
//     description: 'Save changes',
//     keys: isMac ? ['⌘S'] : ['Ctrl+S'],
//     fixed: true
//   },
//   {
//     id: 'undo',
//     category: 'Editing',
//     description: 'Undo last action',
//     keys: isMac ? ['⌘Z'] : ['Ctrl+Z'],
//     fixed: true
//   },
//   {
//     id: 'redo',
//     category: 'Editing',
//     description: 'Redo last action',
//     keys: isMac ? ['⌘⇧Z', '⌘Y'] : ['Ctrl+Shift+Z', 'Ctrl+Y'],
//     fixed: true
//   },
//   {
//     id: 'settings',
//     category: 'Navigation',
//     description: 'Open settings',
//     keys: isMac ? ['⌘,'] : ['Ctrl+,']
//   }
// ]
