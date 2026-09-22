/**
 * File Upload Validators
 * 
 * Provides validation for file uploads including size, MIME type,
 * and extension checks to prevent malicious uploads.
 */

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024 // Default 50MB

const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  archive: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
}

// Dangerous file extensions that should never be allowed
const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
  'app', 'deb', 'rpm', 'dmg', 'pkg', 'run', 'bin', 'sh', 'msi',
  'apk', 'gadget', 'workflow', 'hta', 'cpl', 'msc', 'inf', 'reg',
]

/**
 * Validate a file upload
 * @param {Object} options - File details
 * @param {string} options.filename - Original filename
 * @param {string} options.contentType - MIME type
 * @param {number} options.size - File size in bytes
 * @param {string[]} options.allowedTypes - Optional: specific types allowed (e.g., ['image'])
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateUpload({ filename, contentType, size, allowedTypes = null }) {
  const errors = []

  // Size validation
  if (size > MAX_FILE_SIZE) {
    errors.push(`File size ${formatBytes(size)} exceeds maximum allowed size of ${formatBytes(MAX_FILE_SIZE)}`)
  }

  // Zero-byte files
  if (size === 0) {
    errors.push('File is empty (0 bytes)')
  }

  // Extension validation
  const extension = getFileExtension(filename)
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    errors.push(`File extension '.${extension}' is not allowed for security reasons`)
  }

  // MIME type validation
  if (contentType) {
    const isAllowed = validateMimeType(contentType, allowedTypes)
    if (!isAllowed) {
      errors.push(`File type '${contentType}' is not allowed`)
    }
  } else {
    errors.push('Content type not specified')
  }

  // Filename validation
  if (!filename || filename.trim().length === 0) {
    errors.push('Filename is required')
  } else if (filename.length > 255) {
    errors.push('Filename is too long (max 255 characters)')
  }

  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    errors.push('Invalid filename: path traversal detected')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate MIME type against allowed list
 * @param {string} contentType - MIME type to validate
 * @param {string[]} allowedCategories - Optional: specific categories (e.g., ['image', 'document'])
 * @returns {boolean}
 */
function validateMimeType(contentType, allowedCategories = null) {
  // Normalize content type (remove charset, etc.)
  const normalizedType = contentType.split(';')[0].trim().toLowerCase()

  // If specific categories are requested, check those only
  if (allowedCategories && allowedCategories.length > 0) {
    for (const category of allowedCategories) {
      if (ALLOWED_MIME_TYPES[category]?.includes(normalizedType)) {
        return true
      }
    }
    return false
  }

  // Otherwise, check all categories
  const allAllowedTypes = Object.values(ALLOWED_MIME_TYPES).flat()
  return allAllowedTypes.includes(normalizedType)
}

/**
 * Get file extension from filename
 * @param {string} filename
 * @returns {string} Extension in lowercase without dot
 */
function getFileExtension(filename) {
  if (!filename || !filename.includes('.')) return ''
  return filename.split('.').pop().toLowerCase()
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Express middleware for file upload validation
 * @param {Object} options - Validation options
 * @param {string[]} options.allowedTypes - Optional: specific categories allowed
 * @returns {Function} Express middleware
 */
function validateFileMiddleware(options = {}) {
  return (req, res, next) => {
    const { filename, contentType, size } = req.body

    if (!filename || !contentType || size === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required file information (filename, contentType, size)',
      })
    }

    const validation = validateUpload({
      filename,
      contentType,
      size: parseInt(size),
      allowedTypes: options.allowedTypes,
    })

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'File validation failed',
        details: validation.errors,
      })
    }

    next()
  }
}

module.exports = {
  validateUpload,
  validateMimeType,
  validateFileMiddleware,
  getFileExtension,
  formatBytes,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  BLOCKED_EXTENSIONS,
}
