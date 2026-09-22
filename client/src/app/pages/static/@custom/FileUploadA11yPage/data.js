// @custom — File-Upload Accessibility Standards research data
// These items are also available via GET /api/file-upload-a11y
// The page can use this static data directly for instant rendering

export const A11Y_STANDARDS = [
  {
    id: 'a11y-1',
    title: 'Keyboard Operability (WCAG 2.1.1)',
    summary: 'All file-upload controls must be operable via keyboard alone. Users must be able to navigate to the upload trigger, activate the file picker, select files, remove selected files, and submit the upload using only Tab, Enter, Space, and Escape keys.',
    criteria: 'WCAG 2.1.1 — Keyboard (Level A)',
    tags: ['keyboard', 'focus', 'WCAG 2.1.1'],
  },
  {
    id: 'a11y-2',
    title: 'Focus Management (WCAG 2.4.3)',
    summary: 'Focus must move in a logical order through the file-upload workflow. When the file picker opens, focus should move to the first focusable element. After a file is added, focus should move to the newly added file item. After a file is removed, focus should move to the next remaining item or back to the add button.',
    criteria: 'WCAG 2.4.3 — Focus Order (Level A)',
    tags: ['focus', 'focus-order', 'WCAG 2.4.3'],
  },
  {
    id: 'a11y-3',
    title: 'Name, Role, Value (WCAG 4.1.2 / ARIA)',
    summary: 'Custom file-upload widgets must expose correct name, role, and value to assistive technology. The drop zone should have `role="button"` (or `role="region"` with a button inside), a descriptive `aria-label`, and `aria-disabled` when uploading is in progress.',
    criteria: 'WCAG 4.1.2 — Name, Role, Value (Level A)',
    tags: ['ARIA', 'role', 'label', 'WCAG 4.1.2'],
  },
  {
    id: 'a11y-4',
    title: 'Error Identification & Announcements (WCAG 3.3.1 / ARIA Live)',
    summary: 'File-upload errors — wrong file type, exceeded size limit, upload failure — must be identified and announced to screen readers. Use `aria-live="polite"` regions to announce dynamic messages without interrupting the current task.',
    criteria: 'WCAG 3.3.1 — Error Identification (Level A)',
    tags: ['errors', 'aria-live', 'announcements', 'WCAG 3.3.1'],
  },
  {
    id: 'a11y-5',
    title: 'Drag-and-Drop Accessibility (WCAG 2.5.1 / 2.5.7)',
    summary: 'Drag-and-drop file upload must have a keyboard-accessible alternative. Not all users can perform drag-and-drop gestures due to motor disabilities. Provide a visible "Browse files" button alongside the drop zone.',
    criteria: 'WCAG 2.5.1 — Pointer Gestures (Level A) | WCAG 2.5.7 — Dragging Movements (Level AA)',
    tags: ['drag-and-drop', 'pointer', 'gestures', 'WCAG 2.5.1', 'WCAG 2.5.7'],
  },
  {
    id: 'a11y-6',
    title: 'Multiple File Selection Feedback (WCAG 3.3.2 / 4.1.3)',
    summary: 'When multiple file selection is supported, provide clear feedback about the number and names of selected files. Each file item should display its name, size, and upload status/progress.',
    criteria: 'WCAG 3.3.2 — Labels or Instructions (Level A) | WCAG 4.1.3 — Status Messages (Level AA)',
    tags: ['multiple-files', 'progress', 'feedback', 'WCAG 3.3.2', 'WCAG 4.1.3'],
  },
  {
    id: 'a11y-7',
    title: 'Progress Indication (WCAG 2.2.1 / ARIA Progressbar)',
    summary: 'Upload progress must be communicated both visually and programmatically. Use `<progress>` element or a custom progress bar with `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label`.',
    criteria: 'WCAG 2.2.1 — Timing Adjustable (Level A) | ARIA Progressbar Pattern',
    tags: ['progress', 'progressbar', 'timing', 'WCAG 2.2.1'],
  },
{
    id: 'a11y-8',
    title: 'Colour & Visual Contrast (WCAG 1.4.1 / 1.4.3 / 1.4.11)',
    summary: 'File-upload UI elements must not rely solely on colour to convey information. Error states, required fields, and status indicators must include text labels or icons. All text and interactive elements must meet AA contrast ratios.',
    criteria: 'WCAG 1.4.1 — Use of Color (Level A) | WCAG 1.4.3 — Contrast Minimum (Level AA) | WCAG 1.4.11 — Non-text Contrast (Level AA)',
    tags: ['colour', 'contrast', 'visual', 'WCAG 1.4.1', 'WCAG 1.4.3', 'WCAG 1.4.11'],
  },
  {
    id: 'a11y-9',
    title: 'Screen Reader Announcements for Drag-and-Drop (ARIA)',
    summary: 'Screen reader users must be informed about the drag-and-drop functionality and given equivalent keyboard alternatives. Announce the drop zone role, instructions, and state changes.',
    criteria: 'ARIA Drag-and-Drop Pattern | WCAG 4.1.2 — Name, Role, Value',
    tags: ['screen-reader', 'drop-zone', 'announcements', 'ARIA'],
  },
  {
    id: 'a11y-10',
    title: 'Touch Target Size (WCAG 2.5.5 / 2.5.8)',
    summary: 'Interactive upload controls — browse button, remove buttons, submit — must have touch targets of at least 44x44 CSS pixels on mobile devices.',
    criteria: 'WCAG 2.5.5 — Target Size (Level AAA) | WCAG 2.5.8 — Target Size (Level AA, WCAG 2.2)',
    tags: ['touch', 'mobile', 'target-size', 'WCAG 2.5.5', 'WCAG 2.5.8'],
  },
  {
    id: 'a11y-11',
    title: 'File Format and Size Constraints Disclosure (WCAG 3.3.2)',
    summary: 'Accepted file formats, maximum file size, and any quantity limits must be disclosed before the user attempts to upload. This information should be available to screen readers and visible on the page.',
    criteria: 'WCAG 3.3.2 — Labels or Instructions (Level A)',
    tags: ['file-format', 'size-limit', 'instructions', 'WCAG 3.3.2'],
  },
  {
    id: 'a11y-12',
    title: 'Disabled State Communication (WCAG 1.3.1 / ARIA)',
    summary: 'When the file upload area is disabled (e.g., during processing or because a limit is reached), the disabled state must be communicated programmatically and not rely solely on visual styling.',
    criteria: 'WCAG 1.3.1 — Info and Relationships (Level A) | ARIA Disabled State',
    tags: ['disabled', 'state', 'aria-disabled', 'WCAG 1.3.1'],
  },
]

export const A11Y_CATEGORIES = [
  'Keyboard & Focus',
  'ARIA & Semantics',
  'Errors & Feedback',
  'Visual & Contrast',
  'Mobile & Touch',
]

export function filterByCategory(items, category) {
  if (!category) return items
  const tagMap = {
    'Keyboard & Focus': ['keyboard', 'focus', 'focus-order', 'WCAG 2.1.1', 'WCAG 2.4.3'],
    'ARIA & Semantics': ['ARIA', 'role', 'label', 'aria-live', 'aria-disabled', 'screen-reader', 'announcements', 'WCAG 4.1.2', 'WCAG 1.3.1'],
    'Errors & Feedback': ['errors', 'aria-live', 'announcements', 'progress', 'progressbar', 'multiple-files', 'WCAG 3.3.1', 'WCAG 3.3.2', 'WCAG 2.2.1', 'WCAG 4.1.3'],
    'Visual & Contrast': ['colour', 'contrast', 'visual', 'WCAG 1.4.1', 'WCAG 1.4.3', 'WCAG 1.4.11'],
    'Mobile & Touch': ['touch', 'mobile', 'target-size', 'WCAG 2.5.5', 'WCAG 2.5.8'],
  }
  const relevantTags = tagMap[category] || []
  return items.filter((item) => item.tags.some((t) => relevantTags.includes(t)))
}

export function searchStandards(items, query) {
  if (!query || !query.trim()) return items
  const q = query.toLowerCase().trim()
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.criteria.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q)),
  )
}
]