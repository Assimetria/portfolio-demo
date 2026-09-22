// @custom — NotificationUpload component
// Provides file upload capability for notifications using S3 presigned URLs.
// Supports drag-and-drop and file selection, with upload progress display.

import { useState, useRef, useCallback } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Button } from '@/app/components/@system/ui/button'

/**
 * NotificationUpload — Upload files and attach them to a notification.
 *
 * @param {Object} props
 * @param {number} props.notificationId - The notification to attach files to
 * @param {string[]} [props.accept] - Accepted MIME types (default: images, PDFs, docs)
 * @param {number} [props.maxSizeMB] - Maximum file size in MB (default: 10)
 * @param {Function} [props.onUploadComplete] - Called with file record after upload
 * @param {Function} [props.onUploadError] - Called with error message on failure
 * @param {string} [props.className] - Additional CSS classes
 */
export function NotificationUpload({
  notificationId,
  accept = ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  maxSizeMB = 10,
  onUploadComplete,
  onUploadError,
  className,
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleUpload = useCallback(async (file) => {
    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      const msg = `File exceeds ${maxSizeMB}MB limit`
      setError(msg)
      onUploadError?.(msg)
      return
    }

    setUploading(true)
    setError(null)
    setUploadProgress({ filename: file.name, percent: 0 })

    try {
      // Step 1: Get presigned upload URL
      const urlRes = await fetch('/api/notification-uploads/upload-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          notificationId,
        }),
      })

      if (!urlRes.ok) {
        const errData = await urlRes.json().catch(() => ({}))
        throw new Error(errData.message || 'Failed to get upload URL')
      }

      const urlData = await urlRes.json()
      setUploadProgress({ filename: file.name, percent: 30 })

      // Step 2: Upload file directly to S3 via presigned URL
      const uploadRes = await fetch(urlData.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })

      if (!uploadRes.ok) {
        throw new Error('Upload to storage failed')
      }
      setUploadProgress({ filename: file.name, percent: 70 })
      // Step 3: Confirm upload with the server
      const confirmRes = await fetch('/api/notification-uploads/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: urlData.key,
          notificationId,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
        }),
      })

      if (!confirmRes.ok) {
        throw new Error('Failed to confirm upload')
      }

      const confirmData = await confirmRes.json()
      setUploadProgress({ filename: file.name, percent: 100 })
      onUploadComplete?.(confirmData.file)

      // Clear progress after a short delay
      setTimeout(() => setUploadProgress(null), 2000)
    } catch (err) {
      const msg = err.message || 'Upload failed'
      setError(msg)
      onUploadError?.(msg)
      setUploadProgress(null)
    } finally {
      setUploading(false)
    }
  }, [notificationId, maxSizeMB, onUploadComplete, onUploadError])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0]
    if (file) handleUpload(file)
    // Reset input so the same file can be selected again
    e.target.value = ''
  }, [handleUpload])

  const clearError = useCallback(() => setError(null), [])
  return (
    <div className={cn('w-full', className)}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
          isDragging
            ? 'border-brand-primary bg-brand-primary/5'
            : 'border-brand-border hover:border-brand-border-strong hover:bg-brand-surface-hover/50',
          uploading && 'pointer-events-none opacity-60',
        )}
        role="button"
        tabIndex={0}
        aria-label="Upload file"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />

        {uploadProgress ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            <div className="text-sm font-medium text-brand-text">{uploadProgress.filename}</div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 rounded-full bg-brand-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-primary transition-all duration-300"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
              <span className="text-xs text-brand-text-muted">{uploadProgress.percent}%</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-[var(--color-error)]">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm font-medium">{error}</p>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); clearError() }}>
              Dismiss
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-brand-text-muted" />
            <p className="text-sm font-medium text-brand-text">
              Drop a file here or click to upload
            </p>
            <p className="text-xs text-brand-text-muted">
              PDF, Word, or images up to {maxSizeMB}MB
            </p>
          </div>
        )}
      </div>

      {/* Success toast-like indicator */}
      {uploadProgress?.percent === 100 && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-success)]">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>{uploadProgress.filename} uploaded successfully</span>
        </div>
      )}
    </div>
  )
}