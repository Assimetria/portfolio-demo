// @custom — File-Upload A11y page sub-components
import { Search, FolderOpen, ChevronDown } from 'lucide-react'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/app/components/@system/ui/accordion'
import { Button } from '@/app/components/@system/ui/button'
import { Badge } from '@/app/components/@system/ui/badge'
import { Input } from '@/app/components/@system/ui/input'

// ── Search bar ─────────────────────────────────────────────────────────────

export function A11ySearchBar({ value, onChange }) {
  return (
    <div className="relative max-w-xl mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-text-muted pointer-events-none" />
      <Input
        type="search"
        placeholder="Search accessibility standards…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-12"
        aria-label="Search accessibility standards"
      />
    </div>
  )
}

// ── Category filter chips ──────────────────────────────────────────────────

export function CategoryFilter({ categories, selected, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <Button
        variant={selected === null ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSelect(null)}
        aria-pressed={selected === null}
      >
        <FolderOpen className="h-4 w-4 mr-1.5" />
        All
      </Button>
      {categories.map((cat) => (
        <Button
          key={cat}
          variant={selected === cat ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(cat)}
          aria-pressed={selected === cat}
        >
          {cat}
        </Button>
      ))}
    </div>
  )
}

// ── Standards accordion list ───────────────────────────────────────────────

export function A11yAccordionList({ items }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-brand-text-muted text-lg">No accessibility standards match your search.</p>
        <p className="text-brand-text-muted/60 text-sm mt-1">Try a different keyword or clear the filter.</p>
      </div>
    )
  }

  return (
    <Accordion type="single" collapsible className="space-y-3">
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id} className="border rounded-lg px-5 py-1 bg-brand-surface/30">
          <AccordionTrigger className="text-left hover:no-underline [&[data-state=open]>div>svg]:rotate-180">
            <div className="flex flex-col gap-1 py-2">
              <span className="font-semibold text-base">{item.title}</span>
              <span className="text-sm text-brand-text-muted leading-relaxed">{item.summary}</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <ChevronDown className="h-5 w-5 shrink-0 text-brand-text-muted transition-transform duration-200" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3 pt-2 border-t">
              <div>
                <h4 className="text-sm font-medium text-brand-text-muted mb-1">WCAG Criteria</h4>
                <p className="text-sm">{item.criteria}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-brand-text-muted mb-1">Details</h4>
                <p className="text-sm leading-relaxed">{item.details}</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}