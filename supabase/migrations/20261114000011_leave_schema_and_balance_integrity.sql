-- ==============================================================================
-- MIGRATION 11: Leave Schema & Balance Ledger Integrity
-- File: supabase/migrations/20261114000011_leave_schema_and_balance_integrity.sql
-- Milestone: 2.4D.1 Remediation
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT APPROVAL)
-- ==============================================================================
-- Dependencies: 20261103000006_leave_management.sql
-- Summary:
--   1. Expands leave_type check constraint on leave_balances to support 'COMP_OFF'.
--   2. Expands leave_type check constraint on leave_requests to support 'COMP_OFF'.
--   3. Enforces mathematical balance identity: closing = opening + credited - used.
-- ==============================================================================

-- 1. Expand leave_balances leave_type check constraint
ALTER TABLE public.leave_balances
DROP CONSTRAINT IF EXISTS leave_balances_leave_type_check;

ALTER TABLE public.leave_balances
ADD CONSTRAINT leave_balances_leave_type_check
CHECK (leave_type IN ('PL', 'CL', 'SL', 'COMP_OFF'));

-- 2. Expand leave_requests leave_type check constraint
ALTER TABLE public.leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;

ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_leave_type_check
CHECK (leave_type IN ('PL', 'CL', 'SL', 'LWP', 'COMP_OFF'));

-- 3. Strict Balance Ledger Arithmetic Identity Constraint
-- Guarantees closing cannot diverge from opening + credited - used
ALTER TABLE public.leave_balances
DROP CONSTRAINT IF EXISTS chk_leave_balance_identity;

ALTER TABLE public.leave_balances
ADD CONSTRAINT chk_leave_balance_identity
CHECK (closing = (opening + credited - used));

-- Comment on objects
COMMENT ON CONSTRAINT leave_balances_leave_type_check ON public.leave_balances IS 
'Enforces supported entitlement leave categories including Compensatory Off (COMP_OFF).';

COMMENT ON CONSTRAINT chk_leave_balance_identity ON public.leave_balances IS 
'Enforces fundamental accounting identity: closing = opening + credited - used.';
