# Infrastructure Migration Guide
## From Supabase to Neon + Cloudflare R2 + Keycloak

This guide provides detailed instructions for migrating the document management system from Supabase to a self-hosted infrastructure stack.

---

## Table of Contents
1. [Migration Overview](#migration-overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Setup Infrastructure](#phase-1-setup-infrastructure)
4. [Phase 2: Database Migration](#phase-2-database-migration)
5. [Phase 3: Storage Migration](#phase-3-storage-migration)
6. [Phase 4: Authentication Migration](#phase-4-authentication-migration)
7. [Phase 5: Application Updates](#phase-5-application-updates)
8. [Phase 6: Testing](#phase-6-testing)
9. [Phase 7: Cutover](#phase-7-cutover)
10. [Rollback Procedures](#rollback-procedures)
11. [Post-Migration Tasks](#post-migration-tasks)

---

## Migration Overview

### Current Stack (Supabase)
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **API**: Supabase Client SDK

### Target Stack
- **Authentication**: Keycloak (OIDC)
- **Database**: Neon PostgreSQL
- **Storage**: Cloudflare R2
- **API**: PostgREST + Custom Adapters

### Migration Timeline
- **Phase 1**: Infrastructure Setup (1-2 days)
- **Phase 2**: Database Migration (1 day)
- **Phase 3**: Storage Migration (2-3 days depending on data size)
- **Phase 4**: Auth Migration (1 day)
- **Phase 5**: Application Updates (2 days)
- **Phase 6**: Testing (2-3 days)
- **Phase 7**: Cutover (1 day)

**Total Estimated Time**: 10-14 days

### Risk Assessment
- **High Risk**: Data loss during storage migration
- **Medium Risk**: Authentication disruption
- **Low Risk**: Application bugs (mitigated by feature flags)

---

## Prerequisites

### Required Access
- [ ] Supabase project admin access
- [ ] Neon account with billing setup
- [ ] Cloudflare account with R2 enabled
- [ ] Keycloak server with admin access
- [ ] Production deployment credentials

### Required Tools
```bash
# Install required CLI tools
npm install -g supabase
npm install -g @neon/cli
npm install -g wrangler  # Cloudflare CLI

# Verify installations
supabase --version
neon --version
wrangler --version
```

### Infrastructure Costs
- **Neon**: ~$20-50/month (Starter plan)
- **Cloudflare R2**: ~$15/TB/month storage + $0.36/million requests
- **Keycloak**: Self-hosted (VM costs ~$20-50/month)

---

## Phase 1: Setup Infrastructure

### Step 1.1: Provision Neon Database

```bash
# Login to Neon
neon auth

# Create new project
neon projects create \
  --name "documento-management" \
  --region aws-us-east-1

# Get connection string
neon connection-string "documento-management"

# Save connection string securely
export NEON_DATABASE_URL="postgresql://user:pass@host.neon.tech/db"
```

### Step 1.2: Setup Cloudflare R2

```bash
# Login to Cloudflare
wrangler login

# Create R2 bucket
wrangler r2 bucket create documents-production

# Create API token
wrangler r2 bucket credentials create documents-production

# Save credentials
export R2_ACCOUNT_ID="your-account-id"
export R2_ACCESS_KEY_ID="your-access-key"
export R2_SECRET_ACCESS_KEY="your-secret-key"
export R2_BUCKET_NAME="documents-production"
```

#### Configure R2 CORS
```bash
cat > r2-cors-config.json << EOF
{
  "AllowedOrigins": ["https://your-app-domain.com"],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
EOF

wrangler r2 bucket cors set documents-production \
  --config r2-cors-config.json
```

### Step 1.3: Setup Keycloak

#### Docker Compose Setup
```yaml
version: '3'

services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: changeme123!
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://db:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: keycloak
      KC_HOSTNAME: auth.your-domain.com
      KC_PROXY: edge
    ports:
      - "8080:8080"
    command:
      - start
      - --optimized
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak
      POSTGRES_PASSWORD: keycloak
    volumes:
      - keycloak_data:/var/lib/postgresql/data

volumes:
  keycloak_data:
```

```bash
# Start Keycloak
docker-compose up -d

# Wait for startup
sleep 30

# Access admin console
open http://localhost:8080/admin
```

#### Configure Keycloak Realm

1. **Create Realm**
   - Navigate to: http://localhost:8080/admin
   - Click "Create Realm"
   - Name: `documento-management`
   - Click "Create"

2. **Create Client**
   - Go to: Clients → Create Client
   - Client ID: `documento-web-app`
   - Client Protocol: `openid-connect`
   - Access Type: `public`
   - Valid Redirect URIs: `https://your-app.com/*`
   - Web Origins: `https://your-app.com`
   - Save

3. **Configure Authentication Flow**
   - Go to: Authentication → Flows
   - Copy "Browser" flow
   - Name: `documento-browser-flow`
   - Add: OTP Form (for 2FA support)
   - Set as default

4. **Create User Federation**
   - Go to: User Federation
   - Add provider: "User Storage SPI"
   - Configure to sync with existing user database

### Step 1.4: Setup PostgREST

```bash
# Download PostgREST
wget https://github.com/PostgREST/postgrest/releases/download/v11.2.0/postgrest-v11.2.0-linux-static-x64.tar.xz
tar xJf postgrest-v11.2.0-linux-static-x64.tar.xz

# Create configuration
cat > postgrest.conf << EOF
db-uri = "${NEON_DATABASE_URL}"
db-schema = "public"
db-anon-role = "web_anon"
db-pool = 10

server-host = "0.0.0.0"
server-port = 3000

jwt-secret = "your-jwt-secret-min-32-chars"
jwt-aud = "documento-web-app"

max-rows = 1000
EOF

# Start PostgREST
./postgrest postgrest.conf
```

---

## Phase 2: Database Migration

### Step 2.1: Backup Current Database

```bash
# Full backup from Supabase
pg_dump -h db.PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -f supabase_backup_$(date +%Y%m%d).dump

# Verify backup
pg_restore --list supabase_backup_*.dump | wc -l
```

### Step 2.2: Prepare Neon Database

```bash
# Enable required extensions on Neon
psql $NEON_DATABASE_URL << EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOF
```

### Step 2.3: Migrate Schema

```bash
# Extract schema from Supabase
pg_dump -h db.PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  --schema-only \
  -f schema_export.sql

# Clean up Supabase-specific elements
sed -i '/auth\./d' schema_export.sql
sed -i '/storage\./d' schema_export.sql
sed -i '/realtime\./d' schema_export.sql

# Apply to Neon
psql $NEON_DATABASE_URL -f schema_export.sql
```

### Step 2.4: Migrate Data

```bash
# Export data from Supabase
pg_dump -h db.PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  --data-only \
  --exclude-table='auth.*' \
  --exclude-table='storage.*' \
  -f data_export.sql

# Import to Neon
psql $NEON_DATABASE_URL -f data_export.sql

# Verify record counts
psql $NEON_DATABASE_URL << EOF
SELECT 'clients' as table_name, COUNT(*) FROM clients
UNION ALL
SELECT 'entities', COUNT(*) FROM entities
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;
EOF
```

### Step 2.5: Setup RLS on Neon

```bash
# Apply RLS policies
psql $NEON_DATABASE_URL -f supabase/migrations/*.sql

# Verify RLS is enabled
psql $NEON_DATABASE_URL << EOF
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true;
EOF
```

---

## Phase 3: Storage Migration

### Step 3.1: Inventory Documents

```bash
# List all documents
psql $SUPABASE_URL << EOF > documents_inventory.csv
COPY (
  SELECT
    d.id,
    d.storage_path,
    d.metadata->>'size' as size_bytes,
    d.metadata->>'type' as mime_type
  FROM documents d
  WHERE d.storage_path IS NOT NULL
  ORDER BY d.uploaded_at
) TO STDOUT WITH CSV HEADER;
EOF

# Calculate total size
awk -F',' '{sum += $3} END {print "Total size:", sum/1024/1024/1024, "GB"}' documents_inventory.csv
```

### Step 3.2: Create Migration Script

```typescript
// migrate-storage.ts
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function migrateDocument(
  documentId: string,
  storagePath: string
): Promise<boolean> {
  try {
    // Download from Supabase
    const { data, error } = await supabase.storage
      .from('documents')
      .download(storagePath);

    if (error) throw error;

    // Upload to R2
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: storagePath,
        Body: Buffer.from(await data.arrayBuffer()),
        ContentType: data.type,
      })
    );

    // Update database with new location
    await supabase
      .from('documents')
      .update({
        storage_provider: 'r2',
        storage_path: storagePath,
      })
      .eq('id', documentId);

    console.log(`✓ Migrated: ${storagePath}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed: ${storagePath}`, error);
    return false;
  }
}

async function main() {
  const parser = createReadStream('documents_inventory.csv').pipe(
    parse({ columns: true })
  );

  let success = 0;
  let failed = 0;

  for await (const record of parser) {
    const result = await migrateDocument(record.id, record.storage_path);
    result ? success++ : failed++;

    // Progress
    if ((success + failed) % 100 === 0) {
      console.log(`Progress: ${success + failed} documents processed`);
    }

    // Rate limiting (adjust as needed)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\nMigration complete: ${success} success, ${failed} failed`);
}

main();
```

### Step 3.3: Run Migration

```bash
# Install dependencies
npm install @aws-sdk/client-s3 csv-parse

# Set environment variables
export SUPABASE_URL="https://PROJECT_REF.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"
export R2_ACCOUNT_ID="your-account-id"
export R2_ACCESS_KEY_ID="your-access-key"
export R2_SECRET_ACCESS_KEY="your-secret-key"
export R2_BUCKET_NAME="documents-production"

# Run migration (dry run first)
npx tsx migrate-storage.ts --dry-run

# Run actual migration
npx tsx migrate-storage.ts

# Verify migration
psql $NEON_DATABASE_URL << EOF
SELECT
  storage_provider,
  COUNT(*) as count
FROM documents
GROUP BY storage_provider;
EOF
```

### Step 3.4: Verify Data Integrity

```bash
# Generate checksums from Supabase
psql $SUPABASE_URL << EOF > supabase_checksums.csv
COPY (
  SELECT
    d.id,
    d.storage_path,
    encode(digest(s.metadata->>'httpContentLength', 'sha256'), 'hex') as checksum
  FROM documents d
  JOIN storage.objects s ON s.name = d.storage_path
) TO STDOUT WITH CSV;
EOF

# Compare with R2
# (Implementation depends on R2 API for bulk checksum retrieval)
```

---

## Phase 4: Authentication Migration

### Step 4.1: Export Users from Supabase

```bash
# Export user data
psql $SUPABASE_URL << EOF > users_export.csv
COPY (
  SELECT
    u.id,
    u.email,
    u.encrypted_password,
    u.email_confirmed_at,
    u.created_at,
    p.full_name,
    p.role,
    p.two_factor_secret
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.deleted_at IS NULL
) TO STDOUT WITH CSV HEADER;
EOF
```

### Step 4.2: Import Users to Keycloak

```typescript
// import-users-keycloak.ts
import KcAdminClient from '@keycloak/keycloak-admin-client';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';

const kcAdminClient = new KcAdminClient({
  baseUrl: 'http://localhost:8080',
  realmName: 'documento-management',
});

await kcAdminClient.auth({
  username: 'admin',
  password: process.env.KEYCLOAK_ADMIN_PASSWORD!,
  grantType: 'password',
  clientId: 'admin-cli',
});

const users = parse(readFileSync('users_export.csv'), {
  columns: true,
});

for (const user of users) {
  try {
    // Create user in Keycloak
    await kcAdminClient.users.create({
      realm: 'documento-management',
      username: user.email,
      email: user.email,
      firstName: user.full_name?.split(' ')[0],
      lastName: user.full_name?.split(' ').slice(1).join(' '),
      enabled: true,
      emailVerified: !!user.email_confirmed_at,
      attributes: {
        original_user_id: user.id,
        role: user.role,
        migrated_at: new Date().toISOString(),
      },
      // Note: Passwords cannot be directly migrated
      // Users will need to reset password on first login
      requiredActions: ['UPDATE_PASSWORD'],
    });

    console.log(`✓ Imported: ${user.email}`);
  } catch (error) {
    console.error(`✗ Failed: ${user.email}`, error);
  }
}
```

### Step 4.3: Configure OIDC Client

```bash
# Export Keycloak OIDC configuration
curl -X GET \
  "http://localhost:8080/realms/documento-management/.well-known/openid-configuration" \
  > keycloak-oidc-config.json

# Extract important values
cat keycloak-oidc-config.json | jq '{
  issuer,
  authorization_endpoint,
  token_endpoint,
  userinfo_endpoint,
  jwks_uri
}'
```

---

## Phase 5: Application Updates

### Step 5.1: Install New Dependencies

```bash
# Add Keycloak adapter
npm install keycloak-js

# Add R2 SDK
npm install @aws-sdk/client-s3

# Add PostgREST client (or use fetch)
npm install @supabase/postgrest-js
```

### Step 5.2: Create Provider Adapters

Already implemented in the codebase:
- `src/lib/featureFlags.ts` - Feature flag system
- Feature flags admin UI available via Dashboard → Settings

### Step 5.3: Update Environment Variables

```bash
# .env.production
# Feature Flags
VITE_USE_KEYCLOAK_AUTH=false  # Will switch to true after migration
VITE_USE_CLOUDFLARE_R2=false  # Will switch to true after migration
VITE_USE_NEON_DATABASE=false  # Will switch to true after migration
VITE_USE_POSTGREST=false      # Will switch to true after migration

# Keycloak Configuration
VITE_KEYCLOAK_URL=https://auth.your-domain.com
VITE_KEYCLOAK_REALM=documento-management
VITE_KEYCLOAK_CLIENT_ID=documento-web-app

# Cloudflare R2 Configuration
VITE_R2_ACCOUNT_ID=your-account-id
VITE_R2_ACCESS_KEY_ID=your-access-key-id
VITE_R2_BUCKET=documents-production
VITE_R2_PUBLIC_URL=https://documents.your-domain.com

# Neon Database Configuration
VITE_NEON_DATABASE_URL=postgresql://user:pass@host.neon.tech/db

# PostgREST Configuration
VITE_POSTGREST_URL=https://api.your-domain.com
```

---

## Phase 6: Testing

### Step 6.1: Setup Staging Environment

```bash
# Deploy to staging with new infrastructure
VITE_USE_KEYCLOAK_AUTH=true \
VITE_USE_CLOUDFLARE_R2=true \
VITE_USE_NEON_DATABASE=true \
VITE_USE_POSTGREST=true \
npm run build

# Deploy to staging server
```

### Step 6.2: Test Authentication

```bash
# Test scenarios:
# 1. New user registration
# 2. Existing user login
# 3. Password reset
# 4. 2FA enrollment
# 5. Token refresh
# 6. Session timeout
# 7. Logout
```

### Step 6.3: Test Document Operations

```bash
# Test scenarios:
# 1. Upload new document
# 2. Download existing document
# 3. Update document metadata
# 4. Delete document
# 5. Search documents
# 6. Share document link
# 7. OCR processing
```

### Step 6.4: Performance Testing

```bash
# Load test with k6
cat > load-test.js << EOF
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  const res = http.get('https://staging.your-app.com/api/documents');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
EOF

k6 run load-test.js
```

### Step 6.5: Data Integrity Verification

```sql
-- Compare record counts
-- Supabase
SELECT 'documents' as table, COUNT(*) as count FROM documents
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'entities', COUNT(*) FROM entities;

-- Neon (should match)
-- Run same query on Neon
```

---

## Phase 7: Cutover

### Step 7.1: Pre-Cutover Checklist

- [ ] All tests passing on staging
- [ ] Load tests successful
- [ ] Data integrity verified
- [ ] Rollback plan documented
- [ ] Team trained on new infrastructure
- [ ] Monitoring and alerts configured
- [ ] Backup completed
- [ ] Maintenance window scheduled
- [ ] Users notified

### Step 7.2: Cutover Procedure

```bash
# T-60 minutes: Enable maintenance mode
# Update DNS to show maintenance page

# T-30 minutes: Stop accepting new writes
# Configure application to be read-only

# T-15 minutes: Final data sync
# Run incremental sync for any changes since last migration

# T-10 minutes: Verify data integrity
# Run checksums and record counts

# T-5 minutes: Update environment variables
# Switch feature flags to new infrastructure

# T-0 minutes: Deploy new application
npm run build
# Deploy to production

# T+5 minutes: Verify deployment
# Test critical user flows

# T+10 minutes: Enable writes
# Remove read-only mode

# T+15 minutes: Monitor metrics
# Watch error rates, response times, user activity

# T+30 minutes: Disable maintenance mode
# Update DNS to production application

# T+60 minutes: All clear
# Continue monitoring for next 24 hours
```

### Step 7.3: Post-Cutover Verification

```bash
# Verify all services
curl https://your-app.com/health
curl https://api.your-domain.com/
curl https://auth.your-domain.com/realms/documento-management

# Check key metrics
# - Authentication success rate > 99%
# - API response time < 200ms p95
# - Document upload success rate > 99%
# - Error rate < 0.1%

# Monitor for 24-48 hours
```

---

## Rollback Procedures

### Scenario 1: Issues During Testing

```bash
# Simply redeploy previous version
git checkout main
npm run build
# Deploy to staging/production

# Re-enable Supabase in feature flags
featureFlags.disable('useKeycloakAuth');
featureFlags.disable('useCloudflareR2');
featureFlags.disable('useNeonDatabase');
featureFlags.disable('usePostgREST');
```

### Scenario 2: Issues After Cutover

```bash
# Emergency rollback (< 1 hour after cutover)

# Step 1: Enable maintenance mode
# Update DNS immediately

# Step 2: Rollback application
git revert <migration-commit>
git push origin main
npm run build
# Deploy previous version

# Step 3: Revert environment variables
# Switch back to Supabase configuration

# Step 4: Verify Supabase access
# Test authentication and data access

# Step 5: Resume service
# Update DNS to previous application

# Step 6: Post-rollback data sync
# Sync any data created during cutover window back to Supabase
```

### Scenario 3: Partial Failure

```bash
# Use feature flags to selectively rollback components

# Example: Rollback auth only, keep new database
featureFlags.disable('useKeycloakAuth');  # Back to Supabase Auth
featureFlags.enable('useNeonDatabase');   # Keep Neon
featureFlags.enable('useCloudflareR2');   # Keep R2

# Deploy with partial rollback
npm run build
# Deploy
```

---

## Post-Migration Tasks

### Immediate (Day 1-3)
- [ ] Monitor error rates continuously
- [ ] Check user feedback channels
- [ ] Verify billing for new services
- [ ] Document any issues encountered
- [ ] Update runbook with learnings

### Short-term (Week 1-2)
- [ ] Optimize database queries for Neon
- [ ] Fine-tune PostgREST configuration
- [ ] Configure CDN for R2 if needed
- [ ] Set up automated backups for new infrastructure
- [ ] Performance benchmarking vs. old system

### Medium-term (Month 1-3)
- [ ] Decommission Supabase (after retention period)
- [ ] Archive old backups
- [ ] Update all documentation
- [ ] Team training on new infrastructure
- [ ] Cost optimization review

### Cleanup Supabase

```bash
# After 30-90 days of stable operation

# Step 1: Verify no dependencies on Supabase
# Check application logs for any Supabase API calls

# Step 2: Download final backup
pg_dump -h db.PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -f supabase_final_backup_$(date +%Y%m%d).dump

# Download all storage files
supabase storage download documents --recursive

# Step 3: Archive backups securely
# Store in multiple locations (S3, local, etc.)

# Step 4: Delete Supabase project
# Via Supabase dashboard: Settings → General → Delete Project

# Step 5: Cancel subscription
# Via Supabase dashboard: Organization Settings → Billing
```

---

## Troubleshooting

### Issue: Slow Neon Queries

```sql
-- Enable query stats
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_name ON table(column);
```

### Issue: R2 Upload Failures

```typescript
// Add retry logic
import { retry } from '@aws-sdk/retry';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  retryStrategy: retry.ConfiguredRetryStrategy({
    maxAttempts: 3,
  }),
});
```

### Issue: Keycloak Token Refresh

```typescript
// Implement automatic token refresh
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

// Auto-refresh 60 seconds before expiry
keycloak.onTokenExpired = () => {
  keycloak.updateToken(60);
};
```

---

## Support Contacts

### Internal Team
- **Migration Lead**: [name/email]
- **Database Admin**: [name/email]
- **DevOps**: [name/email]

### External Support
- **Neon Support**: https://neon.tech/docs/introduction/support
- **Cloudflare Support**: https://support.cloudflare.com/
- **Keycloak Community**: https://www.keycloak.org/community

---

**Document Version**: 1.0
**Last Updated**: 2024-10-17
**Migration Status**: Not Started
**Owner**: DevOps/Infrastructure Team
