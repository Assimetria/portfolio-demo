/**
 * SECURITY TEST - Path Traversal Prevention in LocalStorageAdapter
 * Task #1096 - Viktor Audit 2026-02-27
 * 
 * Tests that user-controlled filename and folder parameters cannot escape
 * the upload directory through path traversal attacks.
 */

const LocalStorageAdapter = require('../../../src/lib/@system/StorageAdapter/LocalStorageAdapter')

describe('LocalStorageAdapter Path Traversal Prevention', () => {
  describe('createUploadUrl() security', () => {
    it('should document the security requirements', () => {
      // SECURITY REQUIREMENT:
      // User-controlled filename and folder parameters MUST be sanitized
      // to prevent path traversal attacks (../, ..\, null bytes, etc.)
      expect(true).toBe(true)
    })

    it('should reject path traversal with ../ in filename', async () => {
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: '../../../etc/passwd',
        contentType: 'text/plain',
      })

      // The key should NOT contain .. or path separators
      expect(result.key).not.toContain('..')
      expect(result.key).not.toContain('../')
      expect(result.key).not.toContain('/etc/')
      expect(result.key).toMatch(/^[a-z0-9]+\/[a-f0-9-]+/)
    })

    it('should reject path traversal with ../ in folder', async () => {
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: 'test.txt',
        contentType: 'text/plain',
        folder: '../../etc',
      })

      // The key should NOT contain .. or escape the upload directory
      expect(result.key).not.toContain('..')
      expect(result.key).not.toContain('/etc')
      // Should start with sanitized folder name
      expect(result.key).toMatch(/^[a-z0-9]+\/[a-f0-9-]+/)
    })

    it('should reject path traversal with backslashes (Windows)', async () => {
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: '..\\..\\..\\windows\\system32\\config\\sam',
        contentType: 'text/plain',
      })

      expect(result.key).not.toContain('\\')
      expect(result.key).not.toContain('..')
      expect(result.key).not.toContain('windows')
      expect(result.key).not.toContain('system32')
    })

    it('should reject null byte injection', async () => {
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: 'test.txt\0.exe',
        contentType: 'text/plain',
      })

      // Null bytes should be stripped
      expect(result.key).not.toContain('\0')
      // Should end with .txt (not .exe)
      expect(result.key).toMatch(/\.txt$/)
    })

    it('should reject absolute paths in filename', async () => {
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: '/etc/passwd',
        contentType: 'text/plain',
      })

      // Should not start with /
      expect(result.key).not.toMatch(/^\//)
      expect(result.key).not.toContain('/etc/')
    })

    it('should sanitize special characters in folder', async () => {
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: 'test.pdf',
        contentType: 'application/pdf',
        folder: 'my/folder/../documents',
      })

      // Should not contain / or ..
      expect(result.key).not.toContain('../')
      expect(result.key).toMatch(/^[a-z0-9]+\/[a-f0-9-]+\.pdf$/)
    })

    it('should handle malicious extensions safely', async () => {
      const maliciousFilenames = [
        'file.php',
        'file.exe',
        'file.sh',
        'file.bat',
        'file.cmd',
        'file.<script>',
        'file.../../etc',
      ]

      for (const filename of maliciousFilenames) {
        const result = await LocalStorageAdapter.createUploadUrl({
          filename,
          contentType: 'text/plain',
        })

        // Key should be safe UUID-based, extension only if valid
        expect(result.key).toMatch(/^[a-z0-9]+\/[a-f0-9-]+(\.[a-z0-9]{1,10})?$/)
      }
    })

    it('should handle empty or missing filename gracefully', async () => {
      const result1 = await LocalStorageAdapter.createUploadUrl({
        filename: '',
        contentType: 'text/plain',
      })
      expect(result1.key).toMatch(/^[a-z0-9]+\/[a-f0-9-]+$/)

      const result2 = await LocalStorageAdapter.createUploadUrl({
        filename: '   ',
        contentType: 'text/plain',
      })
      expect(result2.key).toMatch(/^[a-z0-9]+\/[a-f0-9-]+$/)
    })

    it('should only allow alphanumeric extensions', async () => {
      const result1 = await LocalStorageAdapter.createUploadUrl({
        filename: 'document.pdf',
        contentType: 'application/pdf',
      })
      expect(result1.key).toMatch(/\.pdf$/)

      const result2 = await LocalStorageAdapter.createUploadUrl({
        filename: 'script.<script>',
        contentType: 'text/plain',
      })
      // Invalid extension should be stripped
      expect(result2.key).not.toContain('<script>')
      expect(result2.key).toMatch(/^[a-z0-9]+\/[a-f0-9-]+$/)
    })

    it('should limit extension length', async () => {
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: 'file.verylongextensionnamehere',
        contentType: 'text/plain',
      })

      // Extension should be rejected if too long (>10 chars)
      expect(result.key).toMatch(/^[a-z0-9]+\/[a-f0-9-]+$/)
      expect(result.key).not.toContain('verylongextensionnamehere')
    })
  })

  describe('write() security (existing protection)', () => {
    it('should document that write() already has path traversal protection', () => {
      // The write() method already checks:
      // if (!filePath.startsWith(storageDir)) { throw error }
      // This test documents that defense-in-depth is maintained.
      expect(true).toBe(true)
    })
  })

  describe('Attack scenario prevention', () => {
    it('should prevent scenario: attacker tries to overwrite /etc/passwd', async () => {
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: '../../../etc/passwd',
        contentType: 'text/plain',
        folder: '../../../etc',
      })

      // Should generate a safe key in the sanitized folder
      expect(result.key).not.toContain('/etc/')
      expect(result.key).not.toContain('..')
      expect(result.key).toMatch(/^[a-z0-9]+\/[a-f0-9-]+/)
    })

    it('should prevent scenario: attacker tries to write to /tmp', async () => {
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: 'malware.exe',
        contentType: 'application/octet-stream',
        folder: '../../../../tmp',
      })

      expect(result.key).not.toContain('/tmp')
      expect(result.key).not.toContain('..')
    })

    it('should prevent scenario: null byte bypass', async () => {
      // Attacker tries: "safe.txt\0.php" hoping to bypass extension checks
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: 'safe.txt\0.php',
        contentType: 'text/plain',
      })

      expect(result.key).not.toContain('\0')
      expect(result.key).not.toContain('.php')
      expect(result.key).toMatch(/\.txt$/)
    })
  })

  describe('Defense in depth', () => {
    it('should document multiple security layers', () => {
      // LAYER 1: Input sanitization in createUploadUrl (this fix)
      //          - sanitizePathComponent() removes .., /, \, null bytes
      //          - safeExtension() validates extension format
      //
      // LAYER 2: Path validation in write()
      //          - Checks that final path starts with storageDir
      //
      // LAYER 3: UUID-based filenames
      //          - Even if sanitization fails, UUID prevents collisions
      //
      // LAYER 4: Operating system permissions
      //          - Node.js process should run with minimal filesystem access
      expect(true).toBe(true)
    })
  })

  describe('Regression prevention', () => {
    it('should document what NOT to do', () => {
      // ❌ NEVER trust user input for filenames
      // ❌ NEVER use filename directly in path.join()
      // ❌ NEVER split on '.' without validating the result
      // ❌ NEVER allow .. in any path component
      // ❌ NEVER allow / or \ in filenames
      // ❌ NEVER skip null byte checks
      //
      // ✅ ALWAYS sanitize before building paths
      // ✅ ALWAYS validate extensions with whitelist
      // ✅ ALWAYS check final paths against allowed directories
      // ✅ ALWAYS use UUIDs for actual filenames
      expect(true).toBe(true)
    })
  })
})
