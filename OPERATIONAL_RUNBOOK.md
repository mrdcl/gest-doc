# Operational Runbook - Sistema de Gestión Documental

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Deployment Procedures](#deployment-procedures)
4. [Database Operations](#database-operations)
5. [Backup and Recovery](#backup-and-recovery)
6. [Monitoring and Alerting](#monitoring-and-alerting)
7. [Incident Response](#incident-response)
8. [Routine Maintenance](#routine-maintenance)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Security Operations](#security-operations)
11. [Performance Optimization](#performance-optimization)
12. [Rollback Procedures](#rollback-procedures)

---

## System Overview

### Purpose
Document management system for corporate legal entities with hierarchical client → entity → document structure.

### Key Components
- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions)
- **OCR**: Tesseract.js for document text extraction
- **Search**: PostgreSQL Full-Text Search + pgvector for semantic search
- **Storage**: Supabase Storage (future: Cloudflare R2)

### Critical Dependencies
- Supabase Platform
- PostgreSQL 15+
- Node.js 18+
- Modern web browsers (Chrome, Firefox, Safari, Edge)

---

## Architecture

### Current Architecture (Production)
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────────────────┐
│         Vite + React Application                │
├─────────────────────────────────────────────────┤
│  • Authentication (Supabase Auth)               │
│  • Document Management                          │
│  • OCR Processing (Client-side Tesseract.js)    │
│  • Search (Full-text + Semantic)                │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────┐
│              Supabase Platform                  │
├─────────────────────────────────────────────────┤
│  • PostgreSQL Database (with pgvector)          │
│  • Row Level Security (RLS)                     │
│  • Storage (documents bucket)                   │
│  • Edge Functions (OCR processing, webhooks)    │
│  • Realtime subscriptions                       │
└─────────────────────────────────────────────────┘
```

### Target Architecture (Migration in Progress)
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────────────────┐
│         Vite + React Application                │
│  (with Feature Flags for provider switching)    │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
┌──────────────┐      ┌──────────────┐
│  Ory Hydra   │      │ PostgREST +  │
│(OAuth2/OIDC) │      │ Neon DB      │
└──────────────┘      └──────────────┘
                              │
                      ┌───────┴────────┐
                      ↓                ↓
              ┌──────────────┐ ┌──────────────┐
              │ Cloudflare   │ │ Neon         │
              │ R2 Storage   │ │ PostgreSQL   │
              └──────────────┘ └──────────────┘
```

---

## Deployment Procedures

### Pre-Deployment Checklist
- [ ] All tests passing (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Database migrations tested on staging
- [ ] Environment variables verified
- [ ] Backup completed
- [ ] Rollback plan documented
- [ ] Team notified of deployment window

### Standard Deployment

#### 1. Build and Test
```bash
# Install dependencies
npm install

# Run type checking
npm run typecheck

# Build for production
npm run build

# Test build locally
npm run preview
```

#### 2. Database Migrations
```bash
# Review pending migrations
supabase migration list

# Apply migrations to staging
supabase db push --db-url "postgresql://staging-url"

# Verify migration success
supabase migration list --db-url "postgresql://staging-url"

# Apply to production (with backup)
supabase db push --db-url "postgresql://production-url"
```

#### 3. Deploy Application
```bash
# Deploy to hosting platform (example: Vercel)
vercel deploy --prod

# Or manual deployment
npm run build
# Upload dist/ to hosting provider
```

#### 4. Post-Deployment Verification
- [ ] Health check: `/` loads correctly
- [ ] Authentication works
- [ ] Document upload works
- [ ] Search functionality works
- [ ] Check error logs for anomalies
- [ ] Verify monitoring alerts

### Edge Function Deployment

```bash
# Test edge function locally
supabase functions serve function-name

# Deploy to production
supabase functions deploy function-name

# Verify deployment
curl https://[project-ref].supabase.co/functions/v1/function-name
```

### Environment Variables

#### Required Variables
```bash
# Supabase
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]

# HMAC for shared links
VITE_HMAC_SECRET=[secure-random-32-chars]
```

#### Optional Variables
```bash
# AI Features (Ollama)
VITE_OLLAMA_BASE_URL=http://localhost:11434

# Telemetry
VITE_POSTHOG_API_KEY=[posthog-key]
VITE_POSTHOG_HOST=https://app.posthog.com
```

---

## Database Operations

### Routine Queries

#### Check Database Size
```sql
SELECT
  pg_size_pretty(pg_database_size(current_database())) as size;
```

#### Monitor Active Connections
```sql
SELECT
  count(*),
  state,
  usename
FROM pg_stat_activity
GROUP BY state, usename;
```

#### Check Table Sizes
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Vacuum Statistics
```sql
SELECT
  schemaname,
  relname,
  last_vacuum,
  last_autovacuum,
  vacuum_count,
  autovacuum_count
FROM pg_stat_user_tables
ORDER BY last_autovacuum DESC NULLS LAST;
```

### Performance Monitoring

#### Slow Query Detection
```sql
SELECT
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

#### Index Usage
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_size_pretty(pg_relation_size(indexrelid::regclass)) DESC;
```

### Data Integrity Checks

#### Orphaned Documents
```sql
-- Documents without entities
SELECT d.id, d.name
FROM documents d
LEFT JOIN entities e ON e.id = d.entity_id
WHERE e.id IS NULL;

-- Documents without storage files
SELECT d.id, d.name, d.storage_path
FROM documents d
WHERE d.storage_path IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE name = d.storage_path
  );
```

#### Audit Log Integrity
```sql
-- Check for gaps in audit log
SELECT
  COUNT(*) as total_actions,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as oldest_entry,
  MAX(created_at) as newest_entry
FROM audit_logs
WHERE created_at > now() - interval '24 hours';
```

---

## Backup and Recovery

### Automated Backups

Supabase provides automatic daily backups. Verify backup status:

```bash
# List available backups
supabase db backups list

# View backup status
supabase db backups status
```

### Manual Backup

#### Full Database Backup
```bash
# Create backup
pg_dump -h db.PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -f backup_$(date +%Y%m%d_%H%M%S).dump

# Compress backup
gzip backup_*.dump
```

#### Schema-Only Backup
```bash
pg_dump -h db.PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  --schema-only \
  -f schema_$(date +%Y%m%d).sql
```

#### Data-Only Backup
```bash
pg_dump -h db.PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  --data-only \
  -f data_$(date +%Y%m%d).sql
```

### Storage Backup

#### Backup Documents
```bash
# Using Supabase CLI
supabase storage download documents --recursive

# Or using API
curl -X GET \
  'https://PROJECT_REF.supabase.co/storage/v1/object/list/documents' \
  -H 'Authorization: Bearer SERVICE_ROLE_KEY'
```

### Recovery Procedures

#### Database Recovery
```bash
# Stop application traffic (maintenance mode)

# Restore from backup
pg_restore -h db.PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  -c \
  backup_YYYYMMDD_HHMMSS.dump

# Verify data integrity
psql -h db.PROJECT_REF.supabase.co -U postgres -d postgres -c "
  SELECT COUNT(*) FROM documents;
  SELECT COUNT(*) FROM clients;
  SELECT COUNT(*) FROM entities;
"

# Resume application traffic
```

#### Point-in-Time Recovery (PITR)
Supabase Pro plan supports PITR:

```bash
# Restore to specific timestamp
supabase db restore --timestamp "2024-01-15T10:30:00Z"
```

#### Document Recovery
```bash
# Recover from recycle bin (soft delete)
UPDATE documents
SET deleted_at = NULL
WHERE id = 'document-uuid'
  AND deleted_at IS NOT NULL;

# Or use UI: Dashboard → Papelera de Reciclaje → Restaurar
```

---

## Monitoring and Alerting

### Key Metrics to Monitor

#### Application Metrics
- **Uptime**: Target 99.9%
- **Response Time**: < 200ms (p95)
- **Error Rate**: < 0.1%
- **Active Users**: Track daily/monthly active users

#### Database Metrics
- **Connection Pool**: < 80% utilization
- **Query Performance**: < 100ms (p95)
- **Disk Usage**: < 80% capacity
- **Replication Lag**: < 1 second

#### Storage Metrics
- **Storage Usage**: Track growth rate
- **Upload Success Rate**: > 99%
- **Download Speed**: > 1MB/s

### Monitoring Tools

#### Supabase Dashboard
- Navigate to: https://app.supabase.com/project/PROJECT_REF
- Check: Database Health, API Performance, Storage Usage

#### PostgreSQL Monitoring
```sql
-- Create monitoring view
CREATE OR REPLACE VIEW system_health AS
SELECT
  'database_size' as metric,
  pg_size_pretty(pg_database_size(current_database())) as value
UNION ALL
SELECT
  'active_connections',
  COUNT(*)::text
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT
  'cache_hit_ratio',
  ROUND(
    SUM(blks_hit) / NULLIF(SUM(blks_hit) + SUM(blks_read), 0) * 100,
    2
  )::text || '%'
FROM pg_stat_database;

-- Query health status
SELECT * FROM system_health;
```

### Alert Configuration

#### Critical Alerts (Page Immediately)
- Database down
- Storage full (> 95%)
- Authentication service down
- Error rate > 5%
- Response time > 5 seconds (p95)

#### Warning Alerts (Email)
- Disk usage > 80%
- Connection pool > 80%
- Error rate > 1%
- Slow queries (> 1 second)
- Backup failure

#### Info Alerts (Log Only)
- New user registration
- High traffic periods
- Successful deployments

---

## Incident Response

### Severity Levels

#### SEV1 - Critical
- Complete system outage
- Data loss or corruption
- Security breach
- **Response Time**: Immediate
- **Resolution Target**: < 1 hour

#### SEV2 - High
- Major feature unavailable
- Performance severely degraded
- Affecting multiple users
- **Response Time**: < 15 minutes
- **Resolution Target**: < 4 hours

#### SEV3 - Medium
- Minor feature issues
- Performance degradation
- Affecting few users
- **Response Time**: < 1 hour
- **Resolution Target**: < 24 hours

#### SEV4 - Low
- Cosmetic issues
- Feature requests
- Documentation errors
- **Response Time**: < 1 business day
- **Resolution Target**: < 1 week

### Incident Response Process

#### 1. Detection
- Monitor alerts
- User reports
- Automated health checks

#### 2. Initial Response (< 5 minutes)
```bash
# Check system status
curl -I https://your-app.com/

# Check database
supabase db status

# Check recent deployments
git log -n 5 --oneline

# Check error logs
supabase functions logs function-name --limit 50
```

#### 3. Assessment (< 15 minutes)
- Determine severity
- Identify affected components
- Estimate user impact
- Create incident ticket

#### 4. Communication
**SEV1/SEV2**: Immediate status page update
**SEV3/SEV4**: Internal notification

#### 5. Resolution
Follow appropriate troubleshooting guide (see below)

#### 6. Post-Mortem (SEV1/SEV2)
Within 48 hours, document:
- Timeline of events
- Root cause analysis
- Impact assessment
- Action items to prevent recurrence

---

## Routine Maintenance

### Daily Tasks
- [ ] Check monitoring dashboard
- [ ] Review error logs
- [ ] Verify backup completion
- [ ] Check disk usage
- [ ] Review security alerts

### Weekly Tasks
- [ ] Review slow query logs
- [ ] Check index usage
- [ ] Analyze user growth trends
- [ ] Review feature flag configuration
- [ ] Clean up expired shared links

```sql
-- Clean up expired shared links
SELECT cleanup_expired_shared_links();
```

### Monthly Tasks
- [ ] Database vacuum and analyze
- [ ] Review and archive old audit logs
- [ ] Security vulnerability scan
- [ ] Performance benchmark tests
- [ ] Documentation review
- [ ] Test disaster recovery procedure

```sql
-- Archive old audit logs (keep 90 days)
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE created_at < now() - interval '90 days';

DELETE FROM audit_logs
WHERE created_at < now() - interval '90 days';

-- Vacuum and analyze
VACUUM ANALYZE;
```

### Quarterly Tasks
- [ ] Review and update runbook
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Capacity planning
- [ ] Update dependencies

```bash
# Update dependencies
npm outdated
npm update
npm audit fix
```

---

## Troubleshooting Guide

### Common Issues

#### Issue: Users Cannot Login

**Symptoms**: Authentication failures, "Invalid credentials" errors

**Diagnosis**:
```bash
# Check Supabase auth status
supabase status

# Check recent auth attempts
SELECT
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
```

**Resolution**:
1. Verify Supabase project is running
2. Check environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
3. Check browser console for CORS errors
4. Verify user account exists and is not disabled
5. Check for rate limiting or IP blocks

#### Issue: Document Upload Fails

**Symptoms**: Upload errors, 413 errors, timeouts

**Diagnosis**:
```bash
# Check storage bucket configuration
supabase storage get documents

# Check file size limits
SELECT
  bucket_id,
  file_size_limit
FROM storage.buckets
WHERE id = 'documents';

# Check recent uploads
SELECT
  name,
  metadata,
  created_at
FROM storage.objects
WHERE bucket_id = 'documents'
ORDER BY created_at DESC
LIMIT 20;
```

**Resolution**:
1. Verify file size < 50MB (default Supabase limit)
2. Check storage bucket RLS policies
3. Verify user has upload permissions
4. Check network connectivity
5. Verify browser supports File API

#### Issue: Slow Search Performance

**Symptoms**: Search queries taking > 5 seconds

**Diagnosis**:
```sql
-- Check index usage
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE search_vector @@ to_tsquery('english', 'search_term');

-- Check table statistics
SELECT
  schemaname,
  tablename,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE tablename = 'documents';
```

**Resolution**:
1. Ensure GIN index exists on search_vector
2. Run VACUUM ANALYZE on documents table
3. Check for missing WHERE clauses
4. Consider pagination for large result sets
5. Optimize RLS policies

```sql
-- Recreate search index if needed
DROP INDEX IF EXISTS idx_documents_search_vector;
CREATE INDEX idx_documents_search_vector
ON documents USING gin(search_vector);
```

#### Issue: Database Connection Errors

**Symptoms**: "Too many connections", connection timeouts

**Diagnosis**:
```sql
-- Check connection count
SELECT
  count(*),
  state,
  usename,
  application_name
FROM pg_stat_activity
GROUP BY state, usename, application_name;

-- Check connection limit
SHOW max_connections;
```

**Resolution**:
1. Check for connection leaks in application code
2. Verify connection pooling configuration
3. Close idle connections
4. Consider upgrading database tier
5. Implement connection retry logic

```sql
-- Kill idle connections (if necessary)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < now() - interval '10 minutes';
```

#### Issue: OCR Processing Fails

**Symptoms**: Documents uploaded but no OCR content

**Diagnosis**:
```sql
-- Check documents without OCR content
SELECT
  id,
  name,
  ocr_content,
  uploaded_at
FROM documents
WHERE ocr_content IS NULL
  AND uploaded_at > now() - interval '1 day';
```

**Resolution**:
1. Check browser console for Tesseract.js errors
2. Verify document is a supported format (PDF, images)
3. Check file is not corrupted
4. Try manual reprocessing via UI
5. Check browser memory limits (large PDFs)

```typescript
// Manual OCR reprocessing
import { processDocumentOCR } from './lib/ocrService';

await processDocumentOCR(documentId);
```

---

## Security Operations

### Access Control

#### User Roles
- **admin**: Full system access
- **rc_abogados**: Legal firm access
- **cliente**: Limited client access

#### Permission Verification
```sql
-- Check user permissions
SELECT
  u.email,
  p.role,
  p.can_create_entities,
  p.can_delete_documents
FROM auth.users u
JOIN user_profiles p ON p.id = u.id
WHERE u.email = 'user@example.com';
```

### Security Monitoring

#### Failed Login Attempts
```sql
-- Check for suspicious login patterns
SELECT
  email,
  COUNT(*) as failed_attempts,
  MAX(created_at) as last_attempt
FROM audit_logs
WHERE action = 'AUTH_FAILURE'
  AND created_at > now() - interval '1 hour'
GROUP BY email
HAVING COUNT(*) > 5;
```

#### Unusual Activity Patterns
```sql
-- Check for bulk deletions
SELECT
  user_id,
  user_email,
  COUNT(*) as delete_count,
  MAX(created_at) as last_delete
FROM audit_logs
WHERE action = 'DELETE'
  AND entity_type = 'document'
  AND created_at > now() - interval '1 hour'
GROUP BY user_id, user_email
HAVING COUNT(*) > 10;

-- Check for data exports
SELECT
  user_id,
  user_email,
  details,
  created_at
FROM audit_logs
WHERE action = 'EXPORT'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

### Security Incident Response

#### Suspected Breach
1. **Immediate**: Disable affected user accounts
2. Review audit logs for unauthorized access
3. Change database credentials
4. Force password reset for all users
5. Review and tighten RLS policies
6. Contact Supabase support

```sql
-- Disable user account
UPDATE auth.users
SET banned_until = now() + interval '24 hours'
WHERE email = 'suspicious@example.com';

-- Review user activity
SELECT *
FROM audit_logs
WHERE user_email = 'suspicious@example.com'
ORDER BY created_at DESC;
```

### Compliance

#### GDPR - Data Export
```sql
-- Export all user data
SELECT
  u.email,
  p.full_name,
  p.role,
  u.created_at,
  (
    SELECT json_agg(d.*)
    FROM documents d
    WHERE d.uploaded_by = u.id
  ) as documents
FROM auth.users u
LEFT JOIN user_profiles p ON p.id = u.id
WHERE u.email = 'user@example.com';
```

#### GDPR - Data Deletion
```sql
-- Anonymize user data (after retention period)
BEGIN;

-- Delete user documents
DELETE FROM documents
WHERE uploaded_by = 'user-uuid';

-- Anonymize audit logs
UPDATE audit_logs
SET user_email = 'anonymized@deleted.user',
    details = details - 'email'
WHERE user_id = 'user-uuid';

-- Delete user profile
DELETE FROM user_profiles
WHERE id = 'user-uuid';

-- Delete auth user
DELETE FROM auth.users
WHERE id = 'user-uuid';

COMMIT;
```

---

## Performance Optimization

### Database Optimization

#### Index Recommendations
```sql
-- Find missing indexes
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / seq_scan as avg_rows_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND schemaname = 'public'
ORDER BY seq_tup_read DESC;
```

#### Query Optimization
```sql
-- Enable query analysis
SET pg_stat_statements.track = all;

-- Find most expensive queries
SELECT
  substring(query, 1, 100) as short_query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Application Optimization

#### Bundle Size Analysis
```bash
# Analyze bundle size
npm run build -- --mode=analyze

# Check for large dependencies
npx webpack-bundle-analyzer dist/stats.json
```

#### Cache Strategy
```typescript
// Implement query caching
import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});
```

---

## Rollback Procedures

### Application Rollback

#### Emergency Rollback
```bash
# Identify last stable deployment
git log --oneline -n 10

# Rollback to previous commit
git reset --hard <previous-commit>
git push --force origin main

# Or rollback via hosting platform
vercel rollback <deployment-url>
```

#### Database Rollback

```bash
# List migrations
supabase migration list

# Rollback last migration
supabase migration down

# Or manual rollback
psql -h db.PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  -f rollback_migration.sql
```

### Post-Rollback Checklist
- [ ] Verify application is accessible
- [ ] Test critical user flows
- [ ] Check error rates
- [ ] Notify team of rollback
- [ ] Document reason for rollback
- [ ] Schedule fix and re-deployment

---

## Contact Information

### Emergency Contacts
- **On-Call Engineer**: [phone/pager]
- **Database Admin**: [contact]
- **Security Team**: [contact]

### External Support
- **Supabase Support**: support@supabase.io
- **Hosting Provider**: [support contact]

### Escalation Path
1. On-Call Engineer
2. Team Lead
3. CTO
4. CEO (SEV1 only)

---

## Appendix

### Useful SQL Queries

#### Active User Count
```sql
SELECT COUNT(DISTINCT user_id)
FROM audit_logs
WHERE created_at > now() - interval '24 hours';
```

#### Document Statistics
```sql
SELECT
  COUNT(*) as total_docs,
  COUNT(DISTINCT entity_id) as total_entities,
  pg_size_pretty(SUM(COALESCE((metadata->>'size')::bigint, 0))) as total_size,
  AVG(COALESCE((metadata->>'size')::bigint, 0)) as avg_size
FROM documents
WHERE deleted_at IS NULL;
```

#### Storage Usage by Client
```sql
SELECT
  c.name as client_name,
  COUNT(d.id) as document_count,
  pg_size_pretty(SUM(COALESCE((d.metadata->>'size')::bigint, 0))) as storage_used
FROM clients c
LEFT JOIN entities e ON e.client_id = c.id
LEFT JOIN documents d ON d.entity_id = e.id
GROUP BY c.id, c.name
ORDER BY SUM(COALESCE((d.metadata->>'size')::bigint, 0)) DESC;
```

### Feature Flag Quick Reference
```typescript
// Check if feature is enabled
if (featureFlags.isEnabled('enableSemanticSearch')) {
  // Use semantic search
}

// Switch to Ory Hydra auth
featureFlags.enable('useHydraAuth');

// Export configuration
const config = featureFlags.exportConfig();
```

---

**Document Version**: 1.0
**Last Updated**: 2024-10-17
**Next Review**: 2025-01-17
**Owner**: DevOps Team
