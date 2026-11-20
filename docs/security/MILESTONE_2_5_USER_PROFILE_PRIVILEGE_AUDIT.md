# Avencis WFM — Milestone 2.5: User Profile Security & Privilege Escalation Audit
**Document ID:** `DOC-WFM-2.5-UPPROF-001`  
**Date:** 2026-11-16  
**Status:** COMPLETE / RIGOROUSLY AUDITED  
**Target Table:** `public.user_profiles`  
**PostgreSQL Version:** 17.11  

---

## 1. Executive Summary & Audit Mandate

The `public.user_profiles` table is the security root of the Avencis platform. All Row-Level Security policies evaluate `get_user_role()`, `get_user_client_id()`, and `get_user_employee_id()`, which read directly from this table. Any vulnerability allowing a user to manipulate their own `role`, `client_id`, or `employee_id` would compromise tenant isolation and horizontal privacy.

This audit evaluates the combined defense-in-depth protections on `public.user_profiles`, comprising:
1. Five active PostgreSQL RLS policies deployed in Migration 20.
2. The `guard_user_profile_privilege_escalation()` BEFORE trigger deployed in Migration 21.
3. Fail-closed role resolution via `get_user_role()`.

---

## 2. Combined RLS Policy Analysis on `user_profiles`

The live catalog defines 5 active policies on `public.user_profiles`:

### Policy 1: `user_profiles_self_select`
- `CMD`: `SELECT` | `ROLES`: `{authenticated}`
- `USING`: `(id = auth.uid())`
- *Security Guarantee:* A user can view their own profile information (name, email, role, avatar).

### Policy 2: `user_profiles_self_update`
- `CMD`: `UPDATE` | `ROLES`: `{authenticated}`
- `USING`: `(id = auth.uid())`
- `WITH CHECK`:
  ```sql
  (id = auth.uid()) 
  AND (role = (SELECT up.role FROM user_profiles up WHERE up.id = auth.uid()))
  AND (NOT (client_id IS DISTINCT FROM (SELECT up.client_id FROM user_profiles up WHERE up.id = auth.uid())))
  AND (NOT (employee_id IS DISTINCT FROM (SELECT up.employee_id FROM user_profiles up WHERE up.id = auth.uid())))
  ```
- *Security Guarantee:* When users update their own profile (e.g. changing display name), the `WITH CHECK` clause verifies that `role`, `client_id`, and `employee_id` remain strictly identical to their pre-existing values.

### Policy 3: `user_profiles_tenant_admin_select`
- `CMD`: `SELECT` | `ROLES`: `{authenticated}`
- `USING`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text))`
- *Security Guarantee:* Client Admins can view user profiles belonging exclusively to their client organization.

### Policy 4: `user_profiles_tenant_admin_modify`
- `CMD`: `ALL` | `ROLES`: `{authenticated}`
- `USING`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text) AND (role <> 'super_admin'::text))`
- `WITH CHECK`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text) AND (role <> 'super_admin'::text))`
- *Security Guarantee:* Client Admins can provision and manage user profiles within their tenant, but are strictly forbidden from creating, updating, or deleting `super_admin` profiles.

### Policy 5: `user_profiles_super_admin_all`
- `CMD`: `ALL` | `ROLES`: `{authenticated}`
- `USING`: `(get_user_role() = 'super_admin'::text)`
- `WITH CHECK`: `(get_user_role() = 'super_admin'::text)`
- *Security Guarantee:* Global platform administrators retain full catalog governance.

---

## 3. Evaluation of 10 Specific Attack Scenarios

| Attack Scenario | Attack Vector Attempted | Protective Mechanism | Live Catalog Defense | Audit Verdict |
| :---: | :--- | :--- | :--- | :---: |
| **Scenario 1** | Can a user change their own role? | Employee executes `UPDATE user_profiles SET role = 'super_admin' WHERE id = auth.uid()` | `user_profiles_self_update` WITH CHECK constraint & `guard_user_profile_privilege_escalation` trigger | **BLOCKED** |
| **Scenario 2** | Can a client admin promote themselves? | Client Admin executes `UPDATE user_profiles SET role = 'super_admin' WHERE id = auth.uid()` | `user_profiles_tenant_admin_modify` prohibits `role = 'super_admin'`; trigger blocks self-role modification | **BLOCKED** |
| **Scenario 3** | Can a client admin promote another user to `super_admin`? | Client Admin executes `UPDATE user_profiles SET role = 'super_admin' WHERE id = <subordinate_id>` | Policy WITH CHECK enforces `role <> 'super_admin'`; trigger raises error 42501 | **BLOCKED** |
| **Scenario 4** | Can a client admin promote another user to `client_admin`? | Client Admin elevates HR specialist to Client Admin within their tenant | Permitted by `user_profiles_tenant_admin_modify` within same tenant (`client_id = get_user_client_id()`) | **AUTHORIZED DELEGATION** |
| **Scenario 5** | Can a user change their own `client_id`? | Tenant 1 user executes `UPDATE user_profiles SET client_id = Tenant_2_UUID WHERE id = auth.uid()` | `WITH CHECK` enforces `NOT (client_id IS DISTINCT FROM old)`; trigger raises error 42501 | **BLOCKED** |
| **Scenario 6** | Can a user change their own `employee_id`? | Employee executes `UPDATE user_profiles SET employee_id = Peer_UUID WHERE id = auth.uid()` | `WITH CHECK` enforces `NOT (employee_id IS DISTINCT FROM old)`; trigger raises error 42501 | **BLOCKED** |
| **Scenario 7** | Can a client admin create a profile for another tenant? | Client Admin executes `INSERT INTO user_profiles (client_id, ...) VALUES (Tenant_2_UUID, ...)` | Policy WITH CHECK enforces `client_id = get_user_client_id()`; trigger blocks cross-tenant insertion | **BLOCKED** |
| **Scenario 8** | Can a client admin delete another administrator? | Client Admin executes `DELETE FROM user_profiles WHERE id = <peer_admin_id>` | Permitted for tenant admins; strictly prohibited for `super_admin` and trigger prevents self-deletion | **CONTROLLED** |
| **Scenario 9** | Can an unprovisioned Auth identity obtain a role? | New unlinked Auth user executes `INSERT INTO user_profiles (id, role) VALUES (auth.uid(), 'client_admin')` | `get_user_role()` returns `NULL`; no policy matches; trigger raises error 42501 | **BLOCKED** |
| **Scenario 10**| Can an employee modify their own profile to gain permissions? | Employee updates administrative metadata or flags | Only non-privileged fields (`full_name`, metadata) may be modified; role and linkage remain immutable | **BLOCKED** |

---

## 4. Architectural Summary

The combination of declarative RLS policies and PostgreSQL engine-level triggers provides multi-layered protection against privilege escalation. Even in the event of an application logic flaw or unexpected query composition, the database engine guarantees that identity linkages remain immutable.
