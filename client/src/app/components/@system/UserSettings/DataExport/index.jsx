// @system — Data export settings panel
// Allows users to export their data in various formats (JSON, CSV, PDF).
// Provides granular control over what data to include.

import { useState } from 'react'
import { Download, FileText, Table, FileJson, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Card } from '../../Card'
import { Button } from '../../Button'
import { Alert } from '../../Alert'

const EXPORT_FORMATS = [
  {
    id: 'json',
    label: 'JSON',
    description: 'Machine-readable format',
    icon: FileJson,
    extension: '.json'
  },
  {
    id: 'csv',
    label: 'CSV',
    description: 'Spreadsheet format',
    icon: Table,
    extension: '.csv'
  },
  {
    id: 'pdf',
    label: 'PDF',
    description: 'Human-readable document',
    icon: FileText,
    extension: '.pdf'
  }
]

export function DataExport({
  dataCategories = [],
  onExport,
  loading = false,
  lastExport,
  className
}) {
  const [selectedFormat, setSelectedFormat] = useState('json')
  const [selectedCategories, setSelectedCategories] = useState(
    dataCategories.filter(c => c.defaultSelected).map(c => c.id)
  )
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [success, setSuccess] = useState(false)

  const handleExport = async () => {
    setSuccess(false)
    try {
      await onExport?.({
        format: selectedFormat,
        categories: selectedCategories,
        includeMetadata
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 5000)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const allSelected = selectedCategories.length === dataCategories.length
  const someSelected = selectedCategories.length > 0

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Export Your Data</h3>
        <p className="text-sm text-brand-text-muted">
          Download a copy of your data in your preferred format.
        </p>
      </div>

      {/* Success message */}
      {success && (
        <Alert variant="success">
          <Check className="h-4 w-4" />
          <div>
            <h4 className="font-medium">Export started</h4>
            <p className="text-sm">Your download will begin shortly.</p>
          </div>
        </Alert>
      )}

      {/* Last export info */}
      {lastExport && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <div className="text-sm">
            Last exported on {new Date(lastExport).toLocaleDateString()} at{' '}
            {new Date(lastExport).toLocaleTimeString()}
          </div>
        </Alert>
      )}

      {/* Format selection */}
      <div>
        <label className="block text-sm font-medium mb-3">
          Choose format
        </label>
        <div className="grid grid-cols-3 gap-3">
          {EXPORT_FORMATS.map((format) => {
            const Icon = format.icon
            const isSelected = selectedFormat === format.id
            
            return (
              <button
                key={format.id}
                onClick={() => setSelectedFormat(format.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                  'hover:border-primary/60',
                  isSelected
                    ? 'border-primary bg-brand-primary/5'
                    : 'border-[var(--brand-border-subtle)]'
                )}
              >
                <Icon className={cn(
                  'h-6 w-6',
                  isSelected ? 'text-brand-primary' : 'text-brand-text-muted'
                )} />
                <div className="text-center">
                  <p className={cn(
                    'text-sm font-medium',
                    isSelected && 'text-brand-primary'
                  )}>
                    {format.label}
                  </p>
                  <p className="text-xs text-brand-text-muted mt-0.5">
                    {format.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Category selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium">
            Select data to include
          </label>
          <button
            onClick={() => {
              if (allSelected) {
                setSelectedCategories([])
              } else {
                setSelectedCategories(dataCategories.map(c => c.id))
              }
            }}
            className="text-sm text-brand-primary hover:underline"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <Card className="divide-y">
          {dataCategories.map((category) => {
            const isSelected = selectedCategories.includes(category.id)
            const Icon = category.icon
            
            return (
              <label
                key={category.id}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-brand-surface-hover/30 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleCategory(category.id)}
                  className="rounded border-brand-border"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4 text-brand-text-muted" />}
                    <span className="text-sm font-medium">{category.label}</span>
                  </div>
                  {category.description && (
                    <p className="text-xs text-brand-text-muted mt-1">
                      {category.description}
                    </p>
                  )}
                </div>

                {category.estimatedSize && (
                  <span className="text-xs text-brand-text-muted">
                    ~{category.estimatedSize}
                  </span>
                )}
              </label>
            )
          })}
        </Card>
      </div>

      {/* Options */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeMetadata}
            onChange={(e) => setIncludeMetadata(e.target.checked)}
            className="rounded border-brand-border"
          />
          <div>
            <span className="text-sm font-medium">Include metadata</span>
            <p className="text-xs text-brand-text-muted">
              Timestamps, IDs, and other technical information
            </p>
          </div>
        </label>
      </div>

      {/* Export button */}
      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-xs text-brand-text-muted">
          {someSelected 
            ? `${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'} selected`
            : 'Select at least one category'}
        </p>
        
        <Button
          onClick={handleExport}
          disabled={!someSelected || loading}
          className="gap-2"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Export Data
            </>
          )}
        </Button>
      </div>

      {/* Privacy note */}
      <Alert variant="info" className="text-xs">
        <AlertCircle className="h-3 w-3" />
        <p>
          Your exported data will be downloaded directly to your device.
          We never store or process this data on our servers.
        </p>
      </Alert>
    </div>
  )
}

// Example data categories:
// import { User, Mail, CreditCard, Settings, FileText, Calendar } from 'lucide-react'
//
// const categories = [
//   {
//     id: 'profile',
//     label: 'Profile Information',
//     description: 'Name, email, avatar, bio',
//     icon: User,
//     defaultSelected: true,
//     estimatedSize: '2 KB'
//   },
//   {
//     id: 'messages',
//     label: 'Messages',
//     description: 'All your sent and received messages',
//     icon: Mail,
//     defaultSelected: false,
//     estimatedSize: '15 MB'
//   },
//   {
//     id: 'billing',
//     label: 'Billing History',
//     description: 'Invoices and payment records',
//     icon: CreditCard,
//     defaultSelected: true,
//     estimatedSize: '500 KB'
//   },
//   {
//     id: 'settings',
//     label: 'Account Settings',
//     description: 'Preferences and configurations',
//     icon: Settings,
//     defaultSelected: true,
//     estimatedSize: '10 KB'
//   },
//   {
//     id: 'documents',
//     label: 'Documents',
//     description: 'Uploaded files and attachments',
//     icon: FileText,
//     defaultSelected: false,
//     estimatedSize: '250 MB'
//   },
//   {
//     id: 'activity',
//     label: 'Activity Log',
//     description: 'Login history and actions',
//     icon: Calendar,
//     defaultSelected: false,
//     estimatedSize: '5 MB'
//   }
// ]
