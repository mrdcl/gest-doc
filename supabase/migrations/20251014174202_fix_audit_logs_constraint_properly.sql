/*
  # Fix audit_logs action constraint properly
  
  1. Changes
    - Drop existing check constraint
    - Update all existing actions to uppercase
    - Create new constraint with uppercase actions
  
  2. Actions Supported
    - CREATE, UPDATE, DELETE, VIEW, DOWNLOAD, UPLOAD, SHARE
    - LOGIN, LOGOUT, ENABLE_2FA, DISABLE_2FA
    - RESTORE, PERMANENT_DELETE
  
  3. Security
    - Maintains data integrity with allowed action values
*/

-- Step 1: Drop the old constraint first
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

-- Step 2: Now update existing data to uppercase
UPDATE audit_logs SET action = UPPER(action);

-- Step 3: Add new constraint with uppercase actions
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check 
  CHECK (action IN (
    'CREATE',
    'UPDATE', 
    'DELETE',
    'VIEW',
    'DOWNLOAD',
    'UPLOAD',
    'SHARE',
    'LOGIN',
    'LOGOUT',
    'ENABLE_2FA',
    'DISABLE_2FA',
    'RESTORE',
    'PERMANENT_DELETE'
  ));
