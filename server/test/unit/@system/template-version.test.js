// @system — contract tests for scripts/@system/version.js: the four version
// files stay in lock-step, CHANGELOG headings parse in every accepted form, and
// the repo itself satisfies the contract CI enforces (--check).
const fs = require('fs')
const os = require('os')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../../..')
const version = require(path.join(ROOT, 'scripts/@system/version.js'))

function fixture({ v = '2.0.0', manifestVersion = v, pkgVersion = v, changelog } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-version-'))
  fs.writeFileSync(path.join(root, 'VERSION'), `${v}\n`)
  fs.writeFileSync(
    path.join(root, 'template-manifest.json'),
    JSON.stringify(
      {
        version: manifestVersion,
        templateSlug: 'saas',
        templateRepo: 'Assimetria/product-template',
        generatedAt: '2026-09-20',
        ownership: { system: ['**/@system/**'], custom: ['**/@custom/**'], customer: ['brand.json'], merge: ['**'] },
      },
      null,
      2,
    ),
  )
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'x', version: pkgVersion }, null, 2))
  fs.writeFileSync(
    path.join(root, 'CHANGELOG.md'),
    changelog ??
      `# Template Changelog\n\n## v${v} (2026-09-20) — Baseline\n\n- first\n\n## v1.4.0 (2026-04-09)\n\n- older\n`,
  )
  return root
}

describe('version.js — changelog parsing', () => {
  it('parses every accepted heading form', () => {
    expect(version.parseHeading('## v2.1.0 (2026-09-21) — Template versioning')).toEqual({
      version: '2.1.0',
      date: '2026-09-21',
      title: 'Template versioning',
    })
    expect(version.parseHeading('## [2.1.0] - 2026-09-21')).toEqual({ version: '2.1.0', date: '2026-09-21', title: null })
    expect(version.parseHeading('## 2.1.0')).toEqual({ version: '2.1.0', date: null, title: null })
    expect(version.parseHeading('## v2.0.0-shop (2026-09-20) — Shopify-like template')).toEqual({
      version: '2.0.0',
      date: '2026-09-20',
      title: 'Shopify-like template',
    })
    expect(version.parseHeading('## Unreleased')).toBeNull()
    expect(version.parseHeading('### v2.1.0')).toBeNull()
  })

  it('splits sections with bodies, newest first as written', () => {
    const sections = version.parseChangelog('# T\n\n## v2.0.0 (2026-09-20) — A\n\n- a1\n- a2\n\n## v1.0.0\n\n- b\n')
    expect(sections.map((s) => s.version)).toEqual(['2.0.0', '1.0.0'])
    expect(sections[0].body).toBe('- a1\n- a2')
    expect(version.changelogSection('## v1.0.0\n\nbody', '1.0.0').body).toBe('body')
    expect(version.changelogSection('## v1.0.0\n\nbody', '9.9.9')).toBeNull()
  })

  it('inserts a new section before the first existing one', () => {
    const out = version.insertChangelogSection('# Log\n\nintro\n\n## v1.0.0\n\n- old\n', {
      version: '1.1.0',
      date: '2026-09-21',
      title: 'New',
      notes: '- new thing',
    })
    expect(out.indexOf('## v1.1.0 (2026-09-21) — New')).toBeLessThan(out.indexOf('## v1.0.0'))
    expect(out).toContain('intro')
    expect(out).toContain('- new thing')
  })
})

describe('version.js — check()', () => {
  it('passes for a consistent checkout', () => {
    const { problems } = version.check(fixture())
    expect(problems).toEqual([])
  })

  it('reports every disagreement', () => {
    const { problems } = version.check(fixture({ manifestVersion: '1.9.0', pkgVersion: '0.0.0', changelog: '# none\n' }))
    expect(problems.join('\n')).toMatch(/template-manifest\.json version "1\.9\.0"/)
    expect(problems.join('\n')).toMatch(/package\.json version "0\.0\.0"/)
    expect(problems.join('\n')).toMatch(/CHANGELOG\.md has no "## v2\.0\.0" section/)
  })

  it('requires the manifest contract keys', () => {
    const root = fixture()
    const m = JSON.parse(fs.readFileSync(path.join(root, 'template-manifest.json'), 'utf8'))
    delete m.templateSlug
    m.templateRepo = 'not-a-repo'
    m.ownership = { system: [], bogus: ['x'] }
    fs.writeFileSync(path.join(root, 'template-manifest.json'), JSON.stringify(m))
    const { problems } = version.check(root)
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/templateSlug missing/),
        expect.stringMatching(/templateRepo "not-a-repo"/),
        expect.stringMatching(/ownership\.system must be a non-empty string array/),
        expect.stringMatching(/ownership\.bogus is not one of/),
      ]),
    )
  })

  it('THIS repository satisfies the contract (what CI runs)', () => {
    const { status, problems } = version.check(ROOT)
    expect(problems).toEqual([])
    expect(status.version).toMatch(version.SEMVER_RE)
    expect(status.templateRepo).toMatch(/^Assimetria\//)
  })
})

describe('version.js — bump()', () => {
  it('updates VERSION, manifest, package.json and CHANGELOG together', () => {
    const root = fixture()
    const r = version.bump(root, 'minor', { title: 'Versioning', notes: '- tags', date: '2026-09-21' })
    expect(r).toEqual({ from: '2.0.0', to: '2.1.0', date: '2026-09-21' })
    expect(fs.readFileSync(path.join(root, 'VERSION'), 'utf8')).toBe('2.1.0\n')
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'template-manifest.json'), 'utf8'))
    expect(manifest.version).toBe('2.1.0')
    expect(manifest.generatedAt).toBe('2026-09-21')
    expect(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version).toBe('2.1.0')
    const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
    expect(changelog).toMatch(/^## v2\.1\.0 \(2026-09-21\) — Versioning\n\n- tags\n\n## v2\.0\.0/m)
    expect(version.check(root).problems).toEqual([])
  })

  it('computes the next version and rejects downgrades', () => {
    expect(version.nextVersion('2.0.0', 'patch')).toBe('2.0.1')
    expect(version.nextVersion('2.0.9', 'minor')).toBe('2.1.0')
    expect(version.nextVersion('2.3.4', 'major')).toBe('3.0.0')
    expect(version.nextVersion('2.0.0', '2.5.0')).toBe('2.5.0')
    expect(() => version.nextVersion('2.0.0', '1.9.9')).toThrow(/must be greater/)
    expect(() => version.nextVersion('2.0.0', 'huge')).toThrow(/patch\|minor\|major/)
    expect(version.compareSemver('2.10.0', '2.9.9')).toBe(1)
  })
})
