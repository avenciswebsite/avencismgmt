# Avencis WFM — Milestone 2.5: Frontend Security & State Integrity Audit
**Document ID:** `DOC-WFM-2.5-FEAUD-001`  
**Date:** 2026-11-16  
**Status:** COMPLETE / RIGOROUSLY AUDITED  
**Codebase:** React 18 + TypeScript + Vite  
**Production Build Status:** PASSED (`dist/` verified)  

---

## 1. Executive Summary & Audit Scope

This report audits the frontend security architecture of the Avencis WFM application. In a single-page React application, client-side code must present a secure interface, prevent unauthorized navigation, maintain state integrity, and ensure zero exposure of administrative credentials or mock fallback in production.

### Core Modules Audited:
- `src/context/AuthContext.tsx`
- `src/context/WorkspaceContext.tsx`
- `src/services/serviceConfig.ts`
- `src/services/authService.ts`
- `src/lib/supabase.ts`
- `src/App.tsx`, `src/components/AppShell.tsx`, `src/components/Sidebar.tsx`

---

## 2. Production Mock Mode Ban & Service Configuration

A primary vulnerability audited was the risk of the application silently falling back to mock mode in production environments:
```typescript
// Verified in src/services/serviceConfig.ts
function isProd(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta && (import.meta as any).env) {
    return !!(import.meta as any).env.PROD;
  }
  const proc = (globalThis as any).process;
  if (proc && proc.env) {
    return proc.env.NODE_ENV === 'production';
  }
  return false;
}

export function getDataSourceMode(): DataSourceMode {
  // Production boundary: never allow mock mode in production builds
  if (isProd()) {
    return 'supabase';
  }
  // ... development resolution
}

export function isDevPersonaAllowed(): boolean {
  if (isProd()) {
    return false;
  }
  return isMockMode();
}
```

### Audit Findings:
1. **Production Immunity:** In production builds (`npm run build`), `isProd()` evaluates to `true`. `getDataSourceMode()` unconditionally returns `'supabase'`, completely ignoring any environment variable or localStorage setting attempting to force mock mode.
2. **Developer Persona Switcher Ban:** `isDevPersonaAllowed()` unconditionally returns `false` in production, ensuring developer persona shortcuts cannot be used to bypass authentication in live deployments.
3. **Fail-Closed on Unconfigured Supabase:** If Supabase credentials are missing or invalid in production, the application displays a structured error notification rather than silently presenting fabricated mock data.

---

## 3. Session Management & Fail-Closed Profile Resolution

The identity lifecycle in `src/context/AuthContext.tsx` was inspected for session handling and unprovisioned account protection:

```mermaid
sequenceDiagram
    participant User as Browser Client
    participant AC as AuthContext
    participant AS as authService
    participant SB as Supabase GoTrue
    participant PG as PostgreSQL user_profiles

    User->>AC: Application Startup
    AC->>AS: getSession()
    AS->>SB: Query active auth session
    SB-->>AS: Valid Session JWT
    AC->>AS: resolveUserContext()
    AS->>PG: SELECT * FROM user_profiles WHERE id = auth.uid()
    alt Profile Exists & Active
        PG-->>AS: user_profiles row
        AS-->>AC: ResolvedUserContext (role, client_id, employee_id)
        AC-->>User: Render Authorized Workspace
    else Profile Missing (NOT_FOUND)
        PG-->>AS: 0 rows (PGRST116)
        AS-->>AC: Error NOT_FOUND
        AC->>AC: setIsProfileMissing(true); setCurrentUser(null)
        AC-->>User: Render Access Denied: Unprovisioned Account
    else Profile Inactive / Deactivated
        PG-->>AS: is_active = false
        AS-->>AC: Error PERMISSION_ERROR (42501)
        AC->>AC: setCurrentUser(null)
        AC-->>User: Render Access Denied: Deactivated Profile
    end
```

### Audit Findings:
1. **Session Restoration:** Active JWT sessions are restored seamlessly on page refresh using Supabase GoTrue local storage keys.
2. **Unprovisioned Identity Rejection:** If an authenticated identity has no matching record in `public.user_profiles`, `isProfileMissing` is set to `true` and `currentUser` remains `null`. The user cannot access any workspace or operational views.
3. **Deactivated Account Defense:** Deactivated accounts (`is_active = false`) are rejected at the service layer, preventing revoked users from accessing system functions.

---

## 4. Workspace Isolation & Client Switching Authorization

In `src/context/WorkspaceContext.tsx`, workspace switching is strictly governed:
- `switchClient(targetClientId)` validates that `targetClientId` exists in `availableClients`.
- `availableClients` is populated via `policyService.getAccessibleClients()`, which executes under database RLS.
- Non-super-admin users only ever receive their single assigned tenant organisation. Any attempt to switch to another client ID logs a security warning and returns `false`.

---

## 5. Secrets Hygiene & Client Bundle Inspection

A full static code analysis and bundle inspection was conducted on `dist/assets/index-*.js`:
- **`VITE_SUPABASE_URL`:** Contains public endpoint `https://mlopgvkvzhwhkbewhefb.supabase.co`.
- **`VITE_SUPABASE_ANON_KEY`:** Contains standard public anon key with legacy JWT header.
- **Service-Role Key Check:** Searched bundle for service-role patterns, database master passwords, and JWT secret keys. **Zero administrative secrets found.**

---

## 6. Verification Sign-off

The frontend security architecture adheres strictly to industry best practices, enforces fail-closed identity handling, blocks mock mode in production, and maintains complete separation from administrative secrets.
