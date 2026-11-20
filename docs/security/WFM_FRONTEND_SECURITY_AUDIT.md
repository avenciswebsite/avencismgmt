# AVENCIS WFM — MILESTONE 2.4F
# FRONTEND & APPLICATION SECURITY AUDIT
## Client Security Architecture, Route Guards & Credential Hygiene Verification

**Project:** Avencis Workforce Management (WFM) Enterprise Platform  
**Target Environment:** Vite + React 18 Single-Page Application (SPA)  
**Evaluation Date:** November 15, 2026  
**Auditor:** Antigravity Autonomous Security Verification Engine  

---

## 1. Executive Summary

This audit assesses the frontend and application client security architecture of the Avencis Workforce Management (WFM) platform. The application is built using React 18, TypeScript, Tailwind CSS, and the `@supabase/supabase-js` client SDK.

The audit evaluates:
1. **Supabase Client Initialization & Credential Safety**
2. **Environment Separation & Production Boundaries**
3. **Session Management & Token Storage Security**
4. **Route Guards & Role-Based Navigation Protection**
5. **Sensitive Information Disclosure & Error Sanitization**

---

## 2. Client Initialization & Credential Safety

### 2.1. Credential Exposure Audit
A comprehensive inspection of the entire codebase (`src/`, `scripts/`, `vite.config.ts`, `.env.example`) was performed to verify credential handling.
- **Service-Role Key Check:** ZERO references to Supabase `service_role` or secret keys exist in application code or client-side bundles.
- **Client Configuration:** All client-side requests utilize exclusively the public anonymous API key (`VITE_SUPABASE_ANON_KEY`) and HTTPS project URL (`VITE_SUPABASE_URL`).
- **Build Inspection:** Production build artifact inspection (`dist/assets/*.js`) confirmed that no secret environment variables or local credentials are baked into the compiled JavaScript chunks.

### 2.2. Environment Validator (`src/lib/supabase.ts`)
The Supabase client singleton enforces strict runtime validation before client instantiation:
```typescript
export function validateSupabaseEnv(): { isValid: boolean; error?: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      isValid: false,
      error: 'Supabase configuration missing: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env',
    };
  }

  // Check if URL is still placeholder
  if (supabaseUrl.includes('your-project-id') || supabaseAnonKey.includes('your-anon-public-key')) {
    return {
      isValid: false,
      error: 'Supabase configuration contains placeholder values. Please update .env with live credentials.',
    };
  }

  try {
    const parsed = new URL(supabaseUrl);
    if (!parsed.protocol.startsWith('https')) {
      return {
        isValid: false,
        error: 'VITE_SUPABASE_URL must be a valid HTTPS URL.',
      };
    }
  } catch {
    return {
      isValid: false,
      error: 'VITE_SUPABASE_URL is not a valid URL format.',
    };
  }

  return { isValid: true };
}
```
- **HTTPS Enforcement:** Enforces `https://` protocol; unencrypted HTTP connections are rejected.
- **Placeholder Detection:** Rejects boilerplate placeholders.
- **Fail-Safe Fallback:** If environment variables are absent in local development, creates a dummy offline instance rather than crashing the build.

---

## 3. Environment Separation & Production Boundaries

In `src/services/serviceConfig.ts`, a strict boundary is enforced between local development previews and commercial production:

```typescript
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
  ...
}

export function isDevPersonaAllowed(): boolean {
  if (isProd()) {
    return false;
  }
  return isMockMode();
}
```

### Verified Security Guarantees:
1. **Mock Mode Prohibition in Production:** In production builds (`import.meta.env.PROD === true`), `getDataSourceMode()` unconditionally returns `'supabase'`. Mock mode overrides cannot be enabled via URL parameters, `localStorage`, or developer console commands.
2. **Persona Switcher Banned in Production:** The developer persona switcher tool (used in design reviews) checks `isDevPersonaAllowed()`, which unconditionally returns `false` in production builds.

---

## 4. Session Management & Token Storage

### 4.1. Token Persistence
- Client session persistence is managed by `@supabase/supabase-js` GoTrue engine.
- Session tokens are stored in the browser's `localStorage` under the key:
  `'avencis_wfm_auth_token'`
- The client is configured with:
  ```typescript
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'avencis_wfm_auth_token',
  }
  ```
- **Refresh Lifecycle:** Tokens are automatically refreshed prior to expiration.
- **Sign-Out Cleansing:** Executing `authService.signOut()` terminates the remote GoTrue session and removes the JWT and refresh token from `localStorage`.

### 4.2. Profile Provisioning Gate (No Default Elevation)
In `src/context/AuthContext.tsx`, when an authenticated user session is detected, the context resolves the user profile via `authService.resolveUserContext()`.
- **Handling of Unprovisioned Accounts:** If an account exists in GoTrue (`auth.users`) but has no corresponding record in `public.user_profiles`:
  1. `isProfileMissing` is set to `true`.
  2. `currentUser` is set to `null`.
  3. The `AppShell` intercepts rendering and displays an explicit "Access Restricted" screen:
     `"Authenticated user account has no provisioned user profile in the database. Administrative role elevation is prohibited."`
  4. The user is prevented from viewing any workspace or portal routes and is presented solely with a sign-out button.

---

## 5. Route Guards & Navigation Protection

### 5.1. Three-Tier Routing Shell (`src/components/layout/AppShell.tsx`)
The `AppShell` component wraps all application routes and enforces three strict access checks prior to rendering child views:
1. **Session Loading Check (`isLoading`):** Displays a branded loading state while verifying JWT validity and security scope. Prevents race-condition flashing of unauthorized dashboards.
2. **Profile Provisioning Check (`isProfileMissing`):** Renders the security lockdown screen if unprovisioned.
3. **Authentication Check (`!currentUser`):** Redirects unauthenticated callers to `/login`.

### 5.2. Role-Based Navigation Scoping (`src/components/layout/Sidebar.tsx`)
Navigation menus are dynamically filtered based on `currentUser.role`:
- **Employee (`employee`):** Rendered with a dedicated Self-Service portal sidebar (`/portal`, `/portal/punch`, `/portal/leave`, `/portal/regularisations`, `/portal/payslips`). Admin and workspace links are completely excluded from the DOM.
- **Tenant Administrators (`client_admin`, `hr_admin`, `payroll_admin`, `client_manager`, `location_manager`):** Rendered with Client Workspace operations. Master Admin links are excluded.
- **Super Administrator (`super_admin`):** Granted access to both Master Dashboard (`/admin/*`) and cross-tenant workspace views.

### 5.3. Defense-in-Depth Principle
While the frontend navigation hides unauthorized links and forms, frontend hiding is NOT treated as a security boundary. All data retrieval and mutation actions execute against PostgreSQL PostgREST endpoints and stored procedures, where database-level Row-Level Security (RLS) independently verifies tenant scoping and role permissions.

---

## 6. Information Disclosure & Error Sanitization

In `src/services/serviceErrors.ts`, all database exceptions and PostgREST errors are intercepted and translated into structured domain errors before reaching the UI:

```typescript
export function handleSupabaseError(error: unknown, context: string): ServiceError {
  // Categorizes PostgreSQL error codes:
  // 42501 -> PERMISSION_ERROR (HTTP 403)
  // PGRST116 -> NOT_FOUND (HTTP 404)
  // 23505 -> CONFLICT_ERROR (HTTP 409)
  // Network/Socket exceptions -> NETWORK_ERROR (HTTP 503)
}
```

### Verified Protections:
- **Zero Credential Leakage:** Database passwords, connection strings, and service tokens are never printed in error toasts or console warnings.
- **Zero SQL Leakage:** Raw SQL queries and internal database schema definitions are omitted from user-facing error messages.
- **Sanitized User Feedback:** Error messages presented to the user are generic and informative (e.g., `"Access Denied: You do not have permission to perform this action."`).

---

## 7. Frontend Security Audit Conclusion

The frontend application exhibits **sound security hygiene**, clean environment isolation, and robust fail-closed state machines for session restoration and profile hydration.
