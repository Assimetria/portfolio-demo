/**
 * Image Processing System
 * 
 * Automatically optimize, resize, and transform uploaded images.
 * Generates thumbnails and multiple sizes for responsive delivery.
 * 
 * Requires: npm install sharp
 */

'use strict'

const logger = require('../Logger')

let sharp = null
let isAvailable = false

// Try to load Sharp (optional dependency)
try {
  sharp = require('sharp')
  isAvailable = true
  logger.info('[ImageProcessor] Sharp loaded successfully')
} catch (err) {
  logger.warn('[ImageProcessor] Sharp not installed - image processing disabled. Install with: npm install sharp')
}

// Standard image sizes for responsive delivery
const SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 320, height: 320 },
  medium: { width: 640, height: 640 },
  large: { width: 1280, height: 1280 },
  avatar: { width: 200, height: 200 },
  cover: { width: 1200, height: 630 }, // Social media cover size
}

/**
 * Optimize an image buffer
 * 
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Optimization options
 * @param {string} options.format - Output format ('jpeg', 'png', 'webp', 'avif')
 * @param {number} options.quality - Quality 1-100 (default: 80)
 * @param {boolean} options.progressive - Progressive/interlaced encoding
 * @returns {Promise<Buffer>} Optimized image buffer
 */
async function optimize(buffer, options = {}) {
  if (!isAvailable) {
    throw new Error('Sharp not installed - image processing unavailable')
  }

  const {
    format = 'webp',
    quality = 80,
    progressive = true,
  } = options

  try {
    let pipeline = sharp(buffer)

    // Rotate based on EXIF orientation
    pipeline = pipeline.rotate()

    // Apply format-specific settings
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality, progressive })
        break
      case 'png':
        pipeline = pipeline.png({ compressionLevel: 9, progressive })
        break
      case 'webp':
        pipeline = pipeline.webp({ quality, effort: 6 })
        break
      case 'avif':
        pipeline = pipeline.avif({ quality, effort: 6 })
        break
      default:
        throw new Error(`Unsupported format: ${format}`)
    }

    const output = await pipeline.toBuffer()

    logger.info({
      originalSize: buffer.length,
      optimizedSize: output.length,
      reduction: Math.round(((buffer.length - output.length) / buffer.length) * 100),
      format,
    }, '[ImageProcessor] Image optimized')

    return output
  } catch (err) {
    logger.error({ err, format }, '[ImageProcessor] Optimization failed')
    throw err
  }
}

/**
 * Resize image to specific dimensions
 * 
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Resize options
 * @param {number} options.width - Target width
 * @param {number} options.height - Target height
 * @param {string} options.fit - Fit mode ('cover', 'contain', 'fill', 'inside', 'outside')
 * @param {string} options.position - Position ('centre', 'top', 'bottom', 'left', 'right')
 * @param {string} options.background - Background color for letterboxing
 * @param {boolean} options.withoutEnlargement - Don't upscale small images
 * @returns {Promise<Buffer>} Resized image buffer
 */
async function resize(buffer, options = {}) {
  if (!isAvailable) {
    throw new Error('Sharp not installed - image processing unavailable')
  }

  const {
    width,
    height,
    fit = 'cover',
    position = 'centre',
    background = { r: 255, g: 255, b: 255, alpha: 0 },
    withoutEnlargement = true,
  } = options

  if (!width && !height) {
    throw new Error('Either width or height must be specified')
  }

  try {
    const output = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF
      .resize({
        width,
        height,
        fit,
        position,
        background,
        withoutEnlargement,
      })
      .toBuffer()

    logger.debug({ width, height, fit }, '[ImageProcessor] Image resized')

    return output
  } catch (err) {
    logger.error({ err, width, height }, '[ImageProcessor] Resize failed')
    throw err
  }
}

/**
 * Generate thumbnail
 * 
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Thumbnail options
 * @param {number} options.size - Thumbnail size (default: 150)
 * @param {boolean} options.square - Force square (default: true)
 * @returns {Promise<Buffer>} Thumbnail buffer
 */
async function thumbnail(buffer, options = {}) {
  const { size = 150, square = true } = options

  return resize(buffer, {
    width: size,
    height: square ? size : undefined,
    fit: 'cover',
    position: 'attention', // Smart crop focusing on interesting areas
  })
}

/**
 * Generate avatar (circular thumbnail)
 * 
 * @param {Buffer} buffer - Image buffer
 * @param {number} size - Avatar size (default: 200)
 * @returns {Promise<Buffer>} Avatar buffer (PNG with alpha)
 */
async function avatar(buffer, size = 200) {
  if (!isAvailable) {
    throw new Error('Sharp not installed - image processing unavailable')
  }

  try {
    // Create circular mask
    const circle = Buffer.from(
      `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" /></svg>`
    )

    const output = await sharp(buffer)
      .rotate()
      .resize(size, size, { fit: 'cover', position: 'attention' })
      .composite([{
        input: circle,
        blend: 'dest-in'
      }])
      .png()
      .toBuffer()

    logger.debug({ size }, '[ImageProcessor] Avatar generated')

    return output
  } catch (err) {
    logger.error({ err, size }, '[ImageProcessor] Avatar generation failed')
    throw err
  }
}

/**
 * Generate multiple sizes from one image
 * 
 * @param {Buffer} buffer - Image buffer
 * @param {Array<string>} sizeNames - Size names to generate (from SIZES constant)
 * @param {Object} options - Additional options
 * @param {string} options.format - Output format (default: 'webp')
 * @returns {Promise<Object>} Object with size names as keys, buffers as values
 */
async function generateSizes(buffer, sizeNames = ['thumbnail', 'small', 'medium'], options = {}) {
  if (!isAvailable) {
    throw new Error('Sharp not installed - image processing unavailable')
  }

  const { format = 'webp', quality = 80 } = options
  const results = {}

  for (const sizeName of sizeNames) {
    const sizeConfig = SIZES[sizeName]
    if (!sizeConfig) {
      logger.warn({ sizeName }, '[ImageProcessor] Unknown size name, skipping')
      continue
    }

    try {
      const resized = await resize(buffer, {
        width: sizeConfig.width,
        height: sizeConfig.height,
        fit: 'cover',
      })

      results[sizeName] = await optimize(resized, { format, quality })

      logger.debug({
        sizeName,
        width: sizeConfig.width,
        height: sizeConfig.height,
      }, '[ImageProcessor] Size variant generated')
    } catch (err) {
      logger.error({ err, sizeName }, '[ImageProcessor] Failed to generate size variant')
    }
  }

  return results
}

/**
 * Get image metadata
 * 
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} Image metadata
 */
async function getMetadata(buffer) {
  if (!isAvailable) {
    throw new Error('Sharp not installed - image processing unavailable')
  }

  try {
    const metadata = await sharp(buffer).metadata()

    return {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
      isProgressive: metadata.isProgressive,
      size: buffer.length,
    }
  } catch (err) {
    logger.error({ err }, '[ImageProcessor] Failed to get metadata')
    throw err
  }
}

/**
 * Validate if buffer is a valid image
 * 
 * @param {Buffer} buffer - Buffer to check
 * @returns {Promise<boolean>} True if valid image
 */
async function isImage(buffer) {
  if (!isAvailable) {
    return false // Can't validate without Sharp
  }

  try {
    await sharp(buffer).metadata()
    return true
  } catch {
    return false
  }
}

/**
 * Convert image to another format
 * 
 * @param {Buffer} buffer - Image buffer
 * @param {string} format - Target format ('jpeg', 'png', 'webp', 'avif')
 * @param {Object} options - Format options
 * @returns {Promise<Buffer>} Converted image buffer
 */
async function convert(buffer, format, options = {}) {
  return optimize(buffer, { ...options, format })
}

/**
 * Process uploaded image (optimize + resize to common sizes)
 * This is a convenience function for typical upload workflow
 * 
 * @param {Buffer} buffer - Original image buffer
 * @param {Object} options - Processing options
 * @param {boolean} options.generateVariants - Generate size variants (default: true)
 * @param {string} options.format - Output format (default: 'webp')
 * @param {number} options.quality - Quality (default: 80)
 * @param {Array<string>} options.sizes - Size variants to generate
 * @returns {Promise<Object>} Processed images { original, thumbnail, small, medium, ... }
 */
async function processUpload(buffer, options = {}) {
  if (!isAvailable) {
    logger.warn('[ImageProcessor] Sharp not available, returning original buffer')
    return { original: buffer }
  }

  const {
    generateVariants = true,
    format = 'webp',
    quality = 80,
    sizes = ['thumbnail', 'small', 'medium'],
  } = options

  try {
    // Optimize original
    const optimized = await optimize(buffer, { format, quality })

    const result = { original: optimized }

    // Generate variants if requested
    if (generateVariants) {
      const variants = await generateSizes(buffer, sizes, { format, quality })
      Object.assign(result, variants)
    }

    logger.info({
      format,
      quality,
      sizes: generateVariants ? sizes : [],
      originalSize: buffer.length,
      optimizedSize: optimized.length,
    }, '[ImageProcessor] Upload processed')

    return result
  } catch (err) {
    logger.error({ err }, '[ImageProcessor] Upload processing failed')
    throw err
  }
}

/**
 * Check if Sharp is available
 * 
 * @returns {boolean} True if Sharp is loaded
 */
function isSharpAvailable() {
  return isAvailable
}

module.exports = {
  optimize,
  resize,
  thumbnail,
  avatar,
  generateSizes,
  getMetadata,
  isImage,
  convert,
  processUpload,
  isSharpAvailable,
  SIZES,
}
