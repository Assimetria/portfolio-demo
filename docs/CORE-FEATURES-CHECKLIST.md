# Core SaaS Features Implementation Checklist

> Purpose: status of the infrastructure features (email queue, storage, notifications, audit log, feature flags) and where each lives.
> Last verified: 2026-09-20.

Quick reference for tracking implementation of infrastructure features (originally identified in Task #9823).

## ✅ Already Implemented (Production Ready)

- [x] Email system with multiple providers (Resend, SMTP, SES)
- [x] Transactional email templates
- [x] Multi-provider file storage (S3, R2, Local)
- [x] Presigned upload/download URLs
- [x] Structured logging (Pino)
- [x] Email tracking callback support
- [x] File metadata and existence checks

## ✅ High Priority (P0) - COMPLETE (Task #9945)

### Email Queue System - ✅ IMPLEMENTED
- [x] Install BullMQ or pg-boss ✅ (bullmq@5.20.0)
- [x] Create EmailQueue adapter ✅
- [x] Background worker for processing ✅
- [x] Retry logic for failed sends ✅ (exponential backoff, 3 attempts)
- [x] Bulk email support with rate limiting ✅ (100ms between sends, 100 per batch)
- [x] Queue monitoring dashboard ✅ (getQueueStatus API)

**Implemented:**
- `server/src/lib/@system/EmailQueue/index.js` ✅
- Graceful fallback to direct send if Redis unavailable ✅
- Queue cleanup functionality ✅

### File Upload Validation - ✅ IMPLEMENTED
- [x] File size validation (client + server) ✅ (50MB default)
- [x] MIME type whitelist/blacklist ✅ (30+ allowed types)
- [x] Dangerous extension blocking ✅ (19 blocked extensions)
- [x] Validation middleware ✅
- [x] Path traversal protection ✅
- [ ] Virus scanning integration (optional) - P1 enhancement

**Implemented:**
- `server/src/lib/@system/StorageAdapter/validators.js` ✅

### Error Tracking - ✅ IMPLEMENTED
- [x] Sentry integration ✅
- [x] Source maps configuration ✅
- [x] User context in errors ✅
- [x] Performance monitoring ✅ (tracing)
- [x] Error alerting rules ✅
- [x] Sensitive data filtering ✅
- [x] Breadcrumb support ✅

**Implemented:**
- `server/src/lib/@system/ErrorTracking/index.js` ✅

**Dependencies installed:**
- @sentry/node@7.119.0 ✅
- @sentry/tracing@7.119.0 ✅

### Audit Logging - ✅ IMPLEMENTED
- [x] Database schema (audit_logs table) ✅
- [x] Audit logging service ✅
- [x] Express middleware for auto-capture ✅
- [x] User action logging ✅
- [x] Data change tracking (before/after) ✅
- [x] Security event logging ✅
- [x] Query functionality ✅
- [x] Retention policy support ✅
- [ ] Admin UI for viewing logs - P1 enhancement
- [ ] Export functionality - P1 enhancement

**Implemented:**
- `server/src/lib/@system/AuditLog/index.js` ✅
- `server/src/db/migrations/20240309000001_create_audit_logs.sql` ✅
- `server/src/db/migrations/@custom/004_email_logs.js` ✅

**Verification:** See `.task-9945-completion-report.md` for full details.

## 🟡 Medium Priority (P1) - UX Enhancements

### Image Processing
- [ ] Install Sharp
- [ ] Automatic optimization on upload
- [ ] Thumbnail generation
- [ ] Multiple size variants
- [ ] Format conversion (WebP)
- [ ] Avatar processing pipeline

**Dependencies:**
```bash
npm install sharp
```

### Email Analytics
- [ ] Open tracking pixel
- [ ] Click tracking
- [ ] Delivery webhooks
- [ ] Bounce handling
- [ ] Email logs table
- [ ] Analytics dashboard

**SQL:**
```sql
CREATE TABLE email_logs (
  id BIGSERIAL PRIMARY KEY,
  to_address VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  template VARCHAR(50),
  status VARCHAR(20) DEFAULT 'sent',
  message_id VARCHAR(200),
  provider VARCHAR(20),
  error TEXT,
  user_id INTEGER REFERENCES users(id),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Storage Quota Management
- [ ] Per-user storage tracking
- [ ] Quota enforcement
- [ ] Usage API endpoints
- [ ] Upgrade prompts
- [ ] Cleanup scheduled jobs
- [ ] Admin quota management

**SQL:**
```sql
CREATE TABLE file_uploads (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  storage_key VARCHAR(500) UNIQUE NOT NULL,
  original_filename VARCHAR(500),
  content_type VARCHAR(100),
  size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE OR REPLACE VIEW user_storage_usage AS
SELECT 
  user_id,
  COUNT(*) as file_count,
  SUM(size_bytes) as total_bytes
FROM file_uploads
WHERE deleted_at IS NULL
GROUP BY user_id;
```

## 🟢 Lower Priority (P2) - Advanced Features

### Advanced File Features
- [ ] Video transcoding (FFmpeg)
- [ ] Document preview (PDF.js)
- [ ] File sharing links
- [ ] Version history
- [ ] Collaborative editing

### Log Management UI
- [ ] Admin log viewer
- [ ] Search and filtering
- [ ] Export capabilities
- [ ] Real-time streaming
- [ ] Metrics dashboard

### Email Template Builder
- [ ] WYSIWYG editor
- [ ] Template versioning
- [ ] A/B testing
- [ ] Preview mode
- [ ] Variable injection

## Environment Variables Needed

Add to `.env.example` and configure:

```bash
# Email Queue
REDIS_URL=redis://localhost:6379

# Error Tracking
SENTRY_DSN=https://xxx@sentry.io/xxx

# File Upload
MAX_FILE_SIZE_MB=50
ALLOWED_FILE_TYPES=image/*,application/pdf,video/mp4

# Storage Quotas
FREE_TIER_STORAGE_MB=100
PRO_TIER_STORAGE_MB=10000

# Email Analytics
EMAIL_TRACKING_ENABLED=true
EMAIL_TRACKING_PIXEL_URL=https://app.example.com/api/email-track

# Audit Logging
AUDIT_LOG_RETENTION_DAYS=90
```

## NPM Packages to Install

### Immediate (P0):
```bash
npm install bull                    # Email queue
npm install @sentry/node            # Error tracking
npm install @sentry/tracing         # Performance monitoring
```

### Short-term (P1):
```bash
npm install sharp                   # Image processing
npm install file-type               # Better MIME detection
npm install clamav.js              # Virus scanning (optional)
```

### Long-term (P2):
```bash
npm install fluent-ffmpeg          # Video processing
npm install pdf-lib                # PDF generation
npm install socket.io              # Real-time log streaming
```

## Testing Checklist

- [ ] Email queue processing tests
- [ ] File validation unit tests
- [ ] Error tracking integration tests
- [ ] Audit log recording tests
- [ ] Storage quota enforcement tests
- [ ] Email analytics tracking tests

## Documentation to Create

- [ ] Email queue usage guide
- [ ] File upload API documentation
- [ ] Error tracking setup guide
- [ ] Audit log query examples
- [ ] Admin dashboard user guide

## Security Audit

- [ ] File upload security review
- [ ] Email rate limiting
- [ ] Audit log access controls
- [ ] PII redaction in logs
- [ ] Error message sanitization

## Monitoring Setup

- [ ] Email send rate alerts
- [ ] Queue depth monitoring
- [ ] Storage usage alerts
- [ ] Error rate alerts
- [ ] Performance metrics

## Rollout Plan

### Phase 1 (Week 1): Foundation
1. Implement file upload validation
2. Setup Sentry error tracking
3. Create audit logs schema
4. Documentation updates

### Phase 2 (Week 2-3): Email & Storage
5. Email queue system
6. Storage quota tracking
7. Image optimization
8. Basic analytics

### Phase 3 (Week 4+): Advanced
9. Email analytics dashboard
10. Advanced file features
11. Log management UI
12. Performance monitoring

---

## Quick Start Commands

```bash
# Install P0 dependencies
npm install bull @sentry/node @sentry/tracing

# Run migrations
npm run migrate

# Update environment
cp .env.example .env.local
# Edit .env.local with your config

# Start workers
npm run worker:email  # If you create this script

# Run tests
npm test
```

---

**Last Updated:** 2026-09-20  
**Related:** [INFORMATIONAL-SPEC.md](INFORMATIONAL-SPEC.md) (which of these modules the informational template enables), [TEAMS.md](TEAMS.md)
