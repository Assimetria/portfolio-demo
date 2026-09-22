// @system — In-app help widget with search and contextual articles
// Floating help button that opens a help panel
//
// Usage:
// <HelpWidget />

import { useState, useEffect } from 'react'
import { HelpCircle, X, Search, Book, MessageCircle, Mail, ExternalLink } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../Form'
import { cn } from '@/app/lib/@system/utils'
import { info } from '@/config'

// @custom — Replace with real help articles from your knowledge base
const HELP_ARTICLES = [
  {
    id: 1,
    title: 'Getting Started Guide',
    description: 'Learn the basics of using the platform',
    category: 'Getting Started',
    url: '/help',
  },
  {
    id: 2,
    title: 'Account Settings',
    description: 'Manage your profile and preferences',
    category: 'Account',
    url: '/help',
  },
  {
    id: 3,
    title: 'Billing & Subscriptions',
    description: 'Manage your plan and payment methods',
    category: 'Billing',
    url: '/help',
  },
  {
    id: 4,
    title: 'API Documentation',
    description: 'Integrate with our REST API',
    category: 'Development',
    url: '/help',
  },
  {
    id: 5,
    title: 'Security Best Practices',
    description: 'Keep your account secure',
    category: 'Security',
    url: '/help',
  },
  {
    id: 6,
    title: 'Keyboard Shortcuts',
    description: 'Work faster with keyboard shortcuts',
    category: 'Tips',
    url: '/app/settings?tab=shortcuts',
  },
]

/**
 * HelpWidget — Floating help button with search panel
 * @param {Object} props
 * @param {string} [props.position='bottom-right'] - Widget position (bottom-right | bottom-left | top-right | top-left)
 * @param {Object} [props.context] - Current page context for contextual help
 * @param {string} [props.className] - Additional CSS classes
 */
export function HelpWidget({ 
  position = 'bottom-right', 
  context,
  className 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredArticles, setFilteredArticles] = useState(HELP_ARTICLES)

  // Filter articles based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const filtered = HELP_ARTICLES.filter(
        (article) =>
          article.title.toLowerCase().includes(query) ||
          article.description.toLowerCase().includes(query) ||
          article.category.toLowerCase().includes(query)
      )
      setFilteredArticles(filtered)
    } else {
      setFilteredArticles(HELP_ARTICLES)
    }
  }, [searchQuery])

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  }

  const panelPositionClasses = {
    'bottom-right': 'bottom-20 right-0',
    'bottom-left': 'bottom-20 left-0',
    'top-right': 'top-20 right-0',
    'top-left': 'top-20 left-0',
  }

  return (
    <div className={cn('fixed z-50', positionClasses[position], className)}>
      {/* Help button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="default"
        className="h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg hover:shadow-xl transition-all touch-target"
        aria-label="Help"
      >
        {isOpen ? (
          <X className="h-5 w-5 sm:h-6 sm:w-6" />
        ) : (
          <HelpCircle className="h-5 w-5 sm:h-6 sm:w-6" />
        )}
      </Button>

      {/* Help panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 sm:bg-black/20 backdrop-blur-sm -z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel - Full screen on mobile, floating on desktop */}
          <div
            className={cn(
              'fixed sm:absolute',
              'inset-0 sm:inset-auto',
              'sm:w-96 bg-brand-bg border-0 sm:border sm:rounded-lg shadow-xl',
              'max-h-screen sm:max-h-[600px] flex flex-col overflow-hidden',
              'sm:' + panelPositionClasses[position].replace('absolute ', '')
            )}
          >
            {/* Header */}
            <div className="p-4 sm:p-4 border-b">
              <div className="flex items-center justify-between mb-3 sm:mb-3">
                <h3 className="font-semibold text-base sm:text-lg">Help & Support</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="h-10 w-10 sm:h-8 sm:w-8 flex items-center justify-center rounded-md hover:bg-brand-surface-hover transition-colors touch-target"
                >
                  <X className="h-5 w-5 sm:h-4 sm:w-4" />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-muted pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search help articles..."
                  className="pl-9 h-11 sm:h-10"
                />
              </div>
            </div>

            {/* Articles list */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-4">
              {filteredArticles.length > 0 ? (
                <div className="space-y-2">
                  {filteredArticles.map((article) => (
                    <a
                      key={article.id}
                      href={article.url}
                      className="block p-3 sm:p-3 rounded-lg hover:bg-brand-surface-hover active:bg-brand-surface-active transition-colors group touch-target"
                    >
                      <div className="flex items-start justify-between gap-2 sm:gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:text-sm font-medium group-hover:text-brand-primary transition-colors">
                            {article.title}
                          </p>
                          <p className="text-xs sm:text-xs text-brand-text-muted mt-1 sm:mt-0.5 line-clamp-2">
                            {article.description}
                          </p>
                          <span className="inline-block text-xs text-brand-text-muted mt-1.5 sm:mt-1">
                            {article.category}
                          </span>
                        </div>
                        <ExternalLink className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-brand-text-muted group-hover:text-brand-primary transition-colors shrink-0 mt-1" />
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 sm:py-12">
                  <Book className="h-10 w-10 sm:h-8 sm:w-8 text-[var(--brand-text-muted)] mx-auto mb-2 sm:mb-2" />
                  <p className="text-sm sm:text-sm text-brand-text-muted">No articles found</p>
                  <p className="text-xs sm:text-xs text-brand-text-muted mt-1">
                    Try a different search term
                  </p>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-4 sm:p-4 border-t space-y-2">
              <a
                href="/help"
                className="flex items-center gap-2 sm:gap-2 px-3 py-3 sm:py-2 text-sm sm:text-sm rounded-md hover:bg-brand-surface-hover active:bg-brand-surface-active transition-colors touch-target"
              >
                <Book className="h-5 w-5 sm:h-4 sm:w-4" />
                Browse all docs
              </a>
              <a
                href="/contact"
                className="flex items-center gap-2 sm:gap-2 px-3 py-3 sm:py-2 text-sm sm:text-sm rounded-md hover:bg-brand-surface-hover active:bg-brand-surface-active transition-colors touch-target"
              >
                <MessageCircle className="h-5 w-5 sm:h-4 sm:w-4" />
                Contact support
              </a>
              <a
                href={`mailto:${info.supportEmail}`}
                className="flex items-center gap-2 sm:gap-2 px-3 py-3 sm:py-2 text-sm sm:text-sm rounded-md hover:bg-brand-surface-hover active:bg-brand-surface-active transition-colors touch-target"
              >
                <Mail className="h-5 w-5 sm:h-4 sm:w-4" />
                Email us
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
