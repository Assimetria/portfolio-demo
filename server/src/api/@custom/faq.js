// @custom — FAQ API: returns localization FAQ data
const express = require('express')
const router = express.Router()

// ── FAQ data: localization common issues ──────────────────────────────────

const FAQ_ITEMS = [
  {
    id: 'faq-1',
    question: 'What is the most common cause of character encoding issues?',
    answer:
      'The most common cause is using the wrong character encoding when handling text. Always use **UTF-8** encoding throughout your entire stack — database connection, HTML `<meta charset>` declaration, HTTP `Content-Type` headers, and file storage. Mismatched encoding between layers produces garbled text (mojibake) like `Ã©` instead of `é`.',
    category: 'Character Encoding',
    tags: ['utf-8', 'encoding', 'mojibake'],
  },
  {
    id: 'faq-2',
    question: 'How should I handle date and time formatting for different locales?',
    answer:
      'Use the built-in `Intl.DateTimeFormat` API in JavaScript or a dedicated library like `date-fns` with locale plugins. Always display dates in the user\'s locale and respect their timezone. Store all dates in UTC in the database and convert on the client side. Avoid manual date string concatenation — it breaks across locales with different date order conventions (MM/DD vs DD/MM).',
    category: 'Date & Time',
    tags: ['dates', 'timezone', 'Intl', 'formatting'],
  },
  {
    id: 'faq-3',
    question: 'What is the best approach for formatting numbers and currencies across locales?',
    answer:
      'Use `Intl.NumberFormat` for locale-aware number formatting. For currencies, always specify the currency code (e.g., `USD`, `EUR`, `JPY`) alongside the locale. Remember that decimal and thousand separators vary by locale — some use comma as decimal (1.000,50 in German) while others use dot (1,000.50 in English). Never hardcode currency symbols or separator positions.',
    category: 'Numbers & Currency',
    tags: ['numbers', 'currency', 'Intl.NumberFormat', 'formatting'],
  },
  {
    id: 'faq-5',
    question: 'What should I consider when supporting right-to-left (RTL) languages?',
    answer:
      'Use CSS logical properties (`margin-inline-start` instead of `margin-left`, `padding-inline-end` instead of `padding-right`) so the layout flips automatically under `dir="rtl"`. Set `dir="rtl"` and `lang="ar"` (or the appropriate language code) on the `<html>` element. Test all components with long RTL text. Frameworks like Tailwind CSS offer `rtl:` and `ltr:` modifiers. Avoid hardcoded left/right positioning — use `start`/`end` alignment instead.',
    category: 'RTL Support',
    tags: ['rtl', 'right-to-left', 'css', 'logical-properties'],
  },
  {
    id: 'faq-6',
    question: 'How do I handle pluralization rules across different languages?',
    answer:
      'Languages have different plural categories beyond singular/plural. For example, Arabic has 6 plural forms, Russian has 4, while Chinese and Japanese have only 1. Use a library that supports ICU MessageFormat plural rules (like `i18next` with its plural resolver). Never concatenate a number with a translated word — use `{count} items` with proper plural rules instead of `count + " item(s)"`.',
    category: 'Pluralization',
    tags: ['plurals', 'ICU', 'i18next', 'grammar'],
  },
  {
    id: 'faq-7',
    question: 'How do I sort text correctly for different languages?',
    answer:
      'Use `String.prototype.localeCompare()` with the appropriate locale parameter instead of relying on default `Array.sort()`. For example, `items.sort((a, b) => a.name.localeCompare(b.name, "de"))` sorts German text correctly, placing `ß` near `ss` and handling accented characters properly. For database sorting, use the column\'s collation setting (e.g., `utf8mb4_unicode_ci` in MySQL).',
    category: 'Sorting & Collation',
    tags: ['sorting', 'localeCompare', 'collation', 'database'],
  },
  {
    id: 'faq-8',
    question: 'How should I handle images and assets with text for localization?',
    answer:
      'Avoid embedding text in images whenever possible — it cannot be translated or localized without recreating the image. If text-in-image is unavoidable (e.g., screenshots), store separate localized versions for each locale and serve the appropriate one based on the user\'s language preference. Use CSS for text overlays on images instead. Generate dynamic OG images using server-side rendering with localized text.',
    category: 'Assets & Media',
    tags: ['images', 'assets', 'localization', 'og-images'],
  },
  {
    id: 'faq-9',
    question: 'What is the best way to detect a user\'s preferred locale?',
    answer:
      'Check the `Accept-Language` HTTP header sent by the browser, which contains the user\'s language preferences ordered by priority. Use this as the default, but always allow users to manually override the language in your application and persist their choice (e.g., in localStorage or a user profile setting). For SEO, use `hreflang` tags and serve locale-specific URLs (`/en/about`, `/de/ueber-uns`).',
    category: 'Locale Detection',
    tags: ['Accept-Language', 'detection', 'hreflang', 'SEO'],
  },
  {
    id: 'faq-10',
    question: 'How do I ensure my application scales well for many locales?',
    answer:
      'Design your architecture to be locale-agnostic from the start. Store all user-generated text in UTF-8 columns. Use a locale-agnostic database collation for sorting. Extract all user-facing strings into translation files. Set up automated translation pipelines and test each locale with real content before launch. Monitor for layout breaks with long German or short Chinese text. Consider the impact of text expansion — German text is typically 30% longer than English.',
    category: 'Scalability',
    tags: ['architecture', 'scaling', 'testing', 'text-expansion'],
  },
]

// GET /api/faq — returns all FAQ items
router.get('/faq', async (_req, res, next) => {
  try {
    res.json({
      items: FAQ_ITEMS,
      total: FAQ_ITEMS.length,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/faq/:id — returns a single FAQ item
router.get('/faq/:id', async (req, res, next) => {
  try {
    const item = FAQ_ITEMS.find((f) => f.id === req.params.id)
    if (!item) {
      return res.status(404).json({ message: 'FAQ item not found' })
    }
    res.json(item)
  } catch (err) {
    next(err)
  }
})

module.exports = router