# Avencis WFM — Milestone 2.5: Security Remediation Register
**Document ID:** `DOC-WFM-2.5-REMREG-001`  
**Date:** 2026-11-16  
**Status:** COMPLETE / AUTHORITATIVE TRACKING REGISTER  
**Target Architecture:** Avencis Workforce Management (WFM)  

---

## 1. Executive Summary

This register serves as the single authoritative tracking document for all security findings, architectural discrepancies, and hardening measures identified from **Milestone 2.4F** through **Milestone 2.5**.

---

## 2. Master Vulnerability & Remediation Tracking Table

| Finding ID | Component | Vulnerability / Issue | Severity | Status | Remediating Artifact | Empirical Verification Evidence |
| :---: | :--- | :--- | :---: | :---: | :--- | :--- |
| **SEC-01** | Database RLS | 7 tables had RLS enabled but zero policies (`rls_enabled_no_policy`) | **CRITICAL** | **RESOLVED** | `20261115000020_security_hardening.sql` | 22 policies added; `pg_policies` shows 63 total policies. Supabase Advisor reports 0 errors. |
| **SEC-02** | Database Functions| 8 stored routines had mutable `search_path` risking schema hijacking | **HIGH** | **RESOLVED** | `20261115000020_security_hardening.sql` | 13/13 routines verified in `pg_proc` with explicit `search_path=public, auth, pg_temp` or `public, pg_temp`. |
| **SEC-03** | Routine Privileges | 5 routines granted EXECUTE privileges to `anon` and `PUBLIC` | **HIGH** | **RESOLVED** | `20261115000020_security_hardening.sql` | Query on `information_schema.routine_privileges` confirms EXECUTE revoked from anon/PUBLIC. Live REST call blocked (42501). |
| **SEC-04** | Role Resolution | `get_user_role()` featured unsafe `COALESCE(..., 'employee')` fallback | **HIGH** | **RESOLVED** | `20261115000020_security_hardening.sql` | `pg_get_functiondef` confirms no fallback. Returns `NULL`, causing unprovisioned identities to fail closed. |
| **SEC-05** | Identity / Auth | Zero test users in `auth.users`, preventing real multi-user testing | **MEDIUM** | **PREPARED** | `scripts/security/seedAuthTestUsers.ts` | 10 personas planned; script authored in non-destructive dry-run mode awaiting credential injection. |
| **DISC-01** | RBAC Scoping | Managers lacked direct subordinate employee directory SELECT access | **LOW** | **REMEDIATED** | `20261116000021_rbac_discrepancy_remediation.sql` | Authored `get_manager_team()` RPC returning safe directory fields while withholding sensitive statutory PAN/Aadhaar. |
| **DISC-02** | RBAC Scoping | Location Manager omitted from attendance corrections approval policy | **MEDIUM** | **REMEDIATED** | `20261116000021_rbac_discrepancy_remediation.sql` | Authored location-scoped regularisation policy with anti-self-approval (`employee_id <> get_user_employee_id()`). |
| **DISC-03** | RBAC Scoping | Location Manager had broad tenant-wide daily attendance access | **LOW** | **REMEDIATED** | `20261116000021_rbac_discrepancy_remediation.sql` | Authored location-scoped policy restricting site managers strictly to staff at their assigned facility. |
| **DISC-04** | Data Privacy | Separation of HR Admin from Salary Structures vs Payslips | **INFO** | **VALIDATED** | Architecture Specification | Confirmed intentional business rule: HR Admin prints payslips for field staff but cannot view master CTC structures. |
| **UP-01** | Privilege Escalation| Potential self-role or tenant modification via permissive RLS UPDATE | **HIGH** | **REMEDIATED** | `20261116000021_rbac_discrepancy_remediation.sql` | Implemented `guard_user_profile_privilege_escalation()` engine trigger blocking self-promotion and tenant hijacking. |
| **VER-01** | Documentation | Discrepancy regarding database engine (PostgreSQL 15 vs 17.11) | **INFO** | **RESOLVED** | Catalog inspection | `SELECT version();` confirmed live Supabase instance is running **PostgreSQL 17.11.0.011**. |
| **POL-01** | Documentation | Policy count inconsistency in reports (57 vs 63) | **INFO** | **RESOLVED** | Catalog inspection | Catalog query confirms exactly **63 active policies** across all 20 tables in schema `public`. |

---

## 3. Deployment & Execution Instructions for Migration 21

The remediation SQL for **DISC-01, DISC-02, DISC-03, and UP-01** is saved at:  
`supabase/migrations/20261116000021_rbac_discrepancy_remediation.sql`

### Manual Deployment Procedure in Supabase Dashboard:
1. Open the Supabase Dashboard: `https://supabase.com/dashboard/project/mlopgvkvzhwhkbewhefb`.
2. Navigate to the **SQL Editor** tab.
3. Paste the contents of `20261116000021_rbac_discrepancy_remediation.sql`.
4. Click **Run** to apply the changes.
5. All statements are idempotent and safely corrective. Zero business data is altered.
