// @custom — FAQ page sub-components
import { Search, FolderOpen, ChevronDown } from 'lucide-react'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/app/components/@system/ui/accordion'
import { Button } from '@/app/components/@system/ui/button'
import { Badge } from '@/app/components/@system/ui/badge'
import { Input } from '@/app/components/@system/ui/input'

// ── Search bar ─────────────────────────────────────────────────────────────

export function FaqSearchBar({ value, onChange }) {
  return (
    <div className="relative max-w-xl mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-text-muted pointer-events-none" />
      <Input
        type="search"
        placeholder="Search FAQ…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-12"
        aria-label="Search FAQ"
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
        className="rounded-full"
      >
        <FolderOpen className="h-4 w-4 mr-1" />
        All
      </Button>
      {categories.map((cat) => (
        <Button
          key={cat}
          variant={selected === cat ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(cat)}
          className="rounded-full"
        >
          {cat}
        </Button>
      ))}
    </div>
  )
}

// ── FAQ accordion list ─────────────────────────────────────────────────────

export function FaqAccordionList({ items }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <Search className="h-10 w-10 text-brand-text-muted mx-auto mb-4" />
        <p className="text-lg font-medium">No FAQ items match your search</p>
        <p className="text-sm text-brand-text-muted mt-2">
          Try different keywords or browse by category.
        </p>
      </div>
    )
  }

  return (
    <Accordion type="multiple" className="w-full">
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="text-left text-base font-medium">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-brand-text-secondary leading-relaxed">
            <p className="mb-3">{item.answer}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-xs">
                {item.category}
              </Badge>
              {item.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}