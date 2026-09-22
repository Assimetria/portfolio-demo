// @custom — File-Upload Accessibility Standards API
// Returns researched accessibility standards for file-upload components
// covering WCAG criteria, ARIA attributes, keyboard navigation, focus
// management, error announcement patterns, and mobile considerations.
//
// GET /api/file-upload-a11y — returns all accessibility standards
// GET /api/file-upload-a11y/:id — returns a single standard by id

const express = require('express')
const router = express.Router()

// ── Accessibility standards data: file-upload related WCAG / ARIA research ──

const STANDARDS = [
  {
    id: 'a11y-1',
    title: 'Keyboard Operability (WCAG 2.1.1)',
    summary:
      'All file-upload controls must be operable via keyboard alone. Users must be able to navigate to the upload trigger, activate the file picker, select files, remove selected files, and submit the upload using only Tab, Enter, Space, and Escape keys.',
    criteria: 'WCAG 2.1.1 — Keyboard (Level A)',
    details:
      'Ensure the upload button, drag-and-drop zone, file list items, and removal buttons are all reachable and operable via keyboard. The native `<input type="file">` is keyboard accessible by default, but custom-styled drop zones often lose focusability. Apply `tabindex="0"` and an `onKeyDown` handler that triggers on Enter/Space for custom drop zones.',
    wcagRef: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard',
    tags: ['keyboard', 'focus', 'WCAG 2.1.1'],
  },
  {
    id: 'a11y-2',
    title: 'Focus Management (WCAG 2.4.3)',
    summary:
      'Focus must move in a logical order through the file-upload workflow. When the file picker opens (native or custom), focus should move to the first focusable element inside it. After a file is added, focus should move to the newly added file item in the list. After a file is removed, focus should move to the next remaining item or back to the add button.',
    criteria: 'WCAG 2.4.3 — Focus Order (Level A)',
    details:
      'Manage focus programmatically using `.focus()` on the target element. Use `aria-live` regions to announce changes to screen readers without moving focus unexpectedly. When the upload completes, move focus to the success confirmation or to the next logical step. Avoid focus traps — users must be able to Tab away from the upload area.',
    wcagRef: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order',
    tags: ['focus', 'focus-order', 'WCAG 2.4.3'],
  },
  {
    id: 'a11y-3',
    title: 'Name, Role, Value (WCAG 4.1.2 / ARIA)',
    summary:
      'Custom file-upload widgets must expose correct name, role, and value to assistive technology. The drop zone should have `role="button"` (or `role="region"` with a button inside), a descriptive `aria-label`, and `aria-disabled` when uploading is in progress.',
    criteria: 'WCAG 4.1.2 — Name, Role, Value (Level A)',
    details:
      'For a custom drop zone, use `role="button"` and provide `aria-label="Upload files"` or similar. For drag-and-drop regions that also show status, use `role="region"` with `aria-label="File upload area"`. File items in the list should use `role="listitem"` within a `role="list"` container. Remove buttons should use `aria-label="Remove {filename}"` for clear screen reader output.',
    wcagRef: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value',
    tags: ['ARIA', 'role', 'label', 'WCAG 4.1.2'],
  },
  {
    id: 'a11y-4',
    title: 'Error Identification & Announcements (WCAG 3.3.1 / ARIA Live)',
    summary:
      'File-upload errors — wrong file type, exceeded size limit, upload failure — must be identified and announced to screen readers. Use `aria-live="polite"` regions to announce dynamic messages without interrupting the current task.',
    criteria: 'WCAG 3.3.1 — Error Identification (Level A)',
    details:
      'Display errors inline near the relevant control (e.g., next to the file list or drop zone). Use `aria-live="polite"` or `role="status"` for dynamic announcements — this ensures screen readers announce the message when it appears. For critical errors like upload failure, use `aria-live="assertive"`. Each error should describe what went wrong and how to fix it (e.g., "File "report.pdf" exceeds the 5 MB limit. Please select a smaller file.").',
    wcagRef: 'https://www.w3.org/WAI/WCAG22/Understanding/error-identification',
    tags: ['errors', 'aria-live', 'announcements', 'WCAG 3.3.1'],
  },
  {
    id: 'a11y-5',
    title: 'Drag-and-Drop Accessibility (WCAG 2.5.1 / 2.5.7)',
    summary:
      'Drag-and-drop file upload must have a keyboard-accessible alternative. Not all users can perform drag-and-drop gestures due to motor disabilities. Provide a visible "Browse files" button alongside the drop zone.',
    criteria: 'WCAG 2.5.1 — Pointer Gestures (Level A) | WCAG 2.5.7 — Dragging Movements (Level AA)',
    details:
      'Always provide a fallback file picker button in addition to the drag-and-drop zone. The drop zone should clearly indicate when it is active (dragover styling) and support paste-from-clipboard as an additional accessible input method. Avoid requiring multi-finger or path-based drag gestures. The drag-and-drop alternative should be equally discoverable and functional.',
    wcagRef: 'https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures',
    tags: ['drag-and-drop', 'pointer', 'gestures', 'WCAG 2.5.1', 'WCAG 2.5.7'],
  },
]
    id: 'a11y-6',
    title: 'Multiple File Selection Feedback (WCAG 3.3.2 / 4.1.3)',
    summary:
      'When multiple file selection is supported, provide clear feedback about the number and names of selected files. Each file item should display its name, size, and upload status/progress.',
    criteria: 'WCAG 3.3.2 — Labels or Instructions (Level A) | WCAG 4.1.3 — Status Messages (Level AA)',
    details:
      'Display a visible file list with each item showing: file name, file size (formatted), file type icon/thumbnail, upload progress bar, and a remove button. Use `role="list"` and `role="listitem"` for the file list. Use `aria-label` on progress bars. Announce via `aria-live` when files are added or removed from the list.',
    wcagRef: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions',
    tags: ['multiple-files', 'progress', 'feedback', 'WCAG 3.3.2', 'WCAG 4.1.3'],
  },
  {
    id: 'a11y-7',
    title: 'Progress Indication (WCAG 2.2.1 / ARIA Progressbar)',
    summary:
      'Upload progress must be communicated both visually and programmatically. Use `<progress>` element or a custom progress bar with `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label`.',
    criteria: 'WCAG 2.2.1 — Timing Adjustable (Level A) | ARIA Progressbar Pattern',
    details:
      'For individual file progress, use `role="progressbar"` with `aria-valuenow` (current progress), `aria-valuemin="0"`, and `aria-valuemax="100"`. For overall batch upload progress, use an additional progress bar or a summary like "3 of 7 files uploaded" announced via `aria-live`. Avoid relying solely on colour to indicate progress.',
    wcagRef: 'https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable',
    tags: ['progress', 'progressbar', 'timing', 'WCAG 2.2.1'],
  },
  {
    id: 'a11y-8',
    title: 'Colour & Visual Contrast (WCAG 1.4.1 / 1.4.3 / 1.4.11)',
    summary:
      'File-upload UI elements must not rely solely on colour to convey information. Error states, required fields, and status indicators must include text labels or icons. All text and interactive elements must meet AA contrast ratios.',
    criteria: 'WCAG 1.4.1 — Use of Color (Level A) | WCAG 1.4.3 — Contrast Minimum (Level AA) | WCAG 1.4.11 — Non-text Contrast (Level AA)',
    details:
      'Do not use colour alone to indicate file type validation errors — include an error message. The drop zone border/fill must have sufficient contrast against the background (at least 3:1 for non-text elements). Focus indicators must have 3:1 contrast against adjacent colours. Text labels and file names must meet 4.5:1 contrast ratio. Provide a visible focus ring.',
    wcagRef: 'https://www.w3.org/WAI/WCAG22/Understanding/use-of-color',
    tags: ['colour', 'contrast', 'visual', 'WCAG 1.4.1', 'WCAG 1.4.3', 'WCAG 1.4.11'],
  },
{
    id: 'a11y-9',
    title: 'Screen Reader Announcements for Drag-and-Drop (ARIA)',
    summary:
      'Screen reader users must be informed about the drag-and-drop functionality and given equivalent keyboard alternatives. Announce the drop zone role, instructions, and state changes.',
    criteria: 'ARIA Drag-and-Drop Pattern | WCAG 4.1.2 — Name, Role, Value',
    details:
      'When a user enters the drop zone via keyboard focus, announce instructions: "Drop zone. Drag files here or press Enter to browse." When files are dragged over the zone, announce "Drop zone active - release to upload." When files are dropped, announce "X file(s) selected." Always provide the browse button fallback. Use `aria-live="polite"` for status updates.',
    wcagRef: 'https://www.w3.org/WAI/PF/aria-practices/',
    tags: ['screen-reader', 'drop-zone', 'announcements', 'ARIA'],
  },
  {
    id: 'a11y-10',
    title: 'Touch Target Size (WCAG 2.5.5 / 2.5.8)',
    summary:
      'Interactive upload controls — browse button, remove buttons, submit — must have touch targets of at least 44x44 CSS pixels on mobile devices.',
    criteria: 'WCAG 2.5.5 — Target Size (Level AAA) | WCAG 2.5.8 — Target Size (Level AA, WCAG 2.2)',
    details:
      'Ensure file upload buttons and remove/file-action icons have minimum 44x44px touch targets with adequate spacing between adjacent targets (at least 24px). This is especially important for remove buttons on file list items, which are often too small on mobile. Use padding or a larger hit area via `::before` pseudo-element to expand the target without changing visual size.',
    wcagRef: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size',
    tags: ['touch', 'mobile', 'target-size', 'WCAG 2.5.5', 'WCAG 2.5.8'],
  },
  {
    id: 'a11y-11',
    title: 'File Format and Size Constraints Disclosure (WCAG 3.3.2)',
    summary:
      'Accepted file formats, maximum file size, and any quantity limits must be disclosed before the user attempts to upload. This information should be available to screen readers and visible on the page.',
    criteria: 'WCAG 3.3.2 — Labels or Instructions (Level A)',
    details:
      'Display accepted formats (e.g., "Accepted: PDF, PNG, JPG - Max 10 MB each") near the upload trigger. Use an `aria-describedby` association from the upload input to the hint text element so screen readers announce constraints automatically. For drag-and-drop zones, include the constraints as part of the zone\'s `aria-label` or as visible text within the zone.',
    wcagRef: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions',
    tags: ['file-format', 'size-limit', 'instructions', 'WCAG 3.3.2'],
  },
  {
    id: 'a11y-12',
    title: 'Disabled State Communication (WCAG 1.3.1 / ARIA)',
    summary:
      'When the file upload area is disabled (e.g., during processing or because a limit is reached), the disabled state must be communicated programmatically and not rely solely on visual styling.',
    criteria: 'WCAG 1.3.1 — Info and Relationships (Level A) | ARIA Disabled State',
    details:
      'Use the `aria-disabled` attribute (not just a CSS class) on disabled upload buttons and drop zones. Remove or disable the tab-stop (`tabindex="-1"` or `disabled` attribute on native elements) so keyboard users skip disabled controls. Provide a visible explanation: "Upload limit reached. Remove a file to add more."',
    wcagRef: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships',
    tags: ['disabled', 'state', 'aria-disabled', 'WCAG 1.3.1'],
  },
]

// GET /api/file-upload-a11y — returns all accessibility standards
router.get('/file-upload-a11y', async (_req, res, next) => {
  try {
    res.json({
      items: STANDARDS,
      total: STANDARDS.length,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/file-upload-a11y/:id — returns a single standard by id
router.get('/file-upload-a11y/:id', async (req, res, next) => {
  try {
    const item = STANDARDS.find((s) => s.id === req.params.id)
    if (!item) {
      return res.status(404).json({ message: 'Accessibility standard not found' })
    }
    res.json(item)
  } catch (err) {
    next(err)
  }
})

module.exports = router
]