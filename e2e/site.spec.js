import { test, expect } from '@playwright/test'

/**
 * Informational site — home page (SitePage at /).
 * Runs against BASE_URL (default http://localhost:3000). The contact API is
 * mocked with page.route so the suite does not need a database or SMTP.
 */

const SECTION_IDS = ['about', 'services', 'team', 'testimonials', 'contact']

test.describe('Informational site — home', () => {
  test('renders every section id and the navbar/footer', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('site-page')).toBeVisible()
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('h1')).toBeVisible()
    for (const id of SECTION_IDS) {
      await expect(page.locator(`section#${id}`)).toHaveCount(1)
    }
    await expect(page.locator('footer')).toBeVisible()
    // No blank page: the body has real text content.
    const text = await page.locator('main').innerText()
    expect(text.length).toBeGreaterThan(200)
  })

  test('nav anchors scroll to their sections', async ({ page }) => {
    await page.goto('/')
    const before = await page.evaluate(() => window.scrollY)
    await page.locator('header nav[aria-label="Main navigation"] a[href="#contact"]').click()
    await expect.poll(async () => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeGreaterThan(before)
    await expect.poll(async () => page.evaluate(() => {
      const el = document.querySelector('#contact')
      return el ? Math.abs(el.getBoundingClientRect().top) : 9999
    })).toBeLessThan(200)
    await expect(page).toHaveURL(/#contact$/)
  })

  test('contact form shows validation errors and blocks submit', async ({ page }) => {
    let called = false
    await page.route('**/api/contact', async (route) => {
      called = true
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: 1, createdAt: new Date().toISOString() } }) })
    })
    await page.goto('/#contact')
    const form = page.getByTestId('contact-form')
    await form.getByLabel(/name/i).fill('A')
    await form.getByLabel(/email/i).fill('not-an-email')
    await form.getByLabel(/message/i).fill('short')
    await form.getByRole('button', { name: /send/i }).click()
    const alerts = form.getByRole('alert')
    await expect(alerts).toHaveCount(3)
    await expect(alerts.nth(0)).toContainText(/name/i)
    await expect(alerts.nth(1)).toContainText(/email/i)
    await expect(alerts.nth(2)).toContainText(/characters/i)
    expect(called).toBe(false)
  })

  test('contact form submits to /api/contact and shows success', async ({ page }) => {
    let body = null
    await page.route('**/api/contact', async (route) => {
      body = route.request().postDataJSON()
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: 42, createdAt: new Date().toISOString() } }) })
    })
    await page.goto('/#contact')
    const form = page.getByTestId('contact-form')
    await form.getByLabel(/name/i).fill('Ana Silva')
    await form.getByLabel(/email/i).fill('ana@example.com')
    await form.getByLabel(/message/i).fill('I would like to book a consultation next week.')
    await form.getByRole('button', { name: /send/i }).click()
    await expect(page.getByTestId('contact-success')).toBeVisible()
    expect(body).toMatchObject({ name: 'Ana Silva', email: 'ana@example.com', website: '' })
    expect(body.message.length).toBeGreaterThan(10)
  })

  test('contact form surfaces a server error without faking success', async ({ page }) => {
    await page.route('**/api/contact', (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ message: 'Too many messages sent from this address.' }) }),
    )
    await page.goto('/#contact')
    const form = page.getByTestId('contact-form')
    await form.getByLabel(/name/i).fill('Ana Silva')
    await form.getByLabel(/email/i).fill('ana@example.com')
    await form.getByLabel(/message/i).fill('I would like to book a consultation next week.')
    await form.getByRole('button', { name: /send/i }).click()
    await expect(page.getByTestId('contact-error')).toContainText(/too many/i)
    await expect(page.getByTestId('contact-success')).toHaveCount(0)
  })

  test('theme toggle flips data-theme on <html>', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')
    const initial = await html.getAttribute('data-theme')
    expect(['light', 'dark']).toContain(initial)
    await page.getByTestId('theme-toggle').first().click()
    await expect(html).toHaveAttribute('data-theme', initial === 'dark' ? 'light' : 'dark')
    await page.getByTestId('theme-toggle').first().click()
    await expect(html).toHaveAttribute('data-theme', initial)
  })

  test('mobile viewport shows the menu button and opens the drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const button = page.getByTestId('mobile-menu-button')
    await expect(button).toBeVisible()
    await expect(page.locator('header nav[aria-label="Main navigation"]')).toBeHidden()
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#site-mobile-menu')).toBeVisible()
    await page.locator('#site-mobile-menu a[href="#services"]').click()
    await expect(page.locator('#site-mobile-menu')).toHaveCount(0)
  })
})
