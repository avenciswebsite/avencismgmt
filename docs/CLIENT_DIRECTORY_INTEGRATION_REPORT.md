# Avencis Workforce Management (WFM)
# Client Directory Integration Report

**Document Reference:** `docs/CLIENT_DIRECTORY_INTEGRATION_REPORT.md`  
**Milestone:** 2.4A — Client Management Module: Live Supabase Integration  
**Component:** `src/app/admin/ClientDirectoryView.tsx`  
**Service Layer:** `src/services/policyService.ts`  
**Database Tables:** `public.clients`, `public.client_legal_entities`, `public.work_locations`, `public.client_policies`, `public.employees`  
**Status:** IMPLEMENTED & FULLY VERIFIED (100% Pass Rate)  
**Date:** 2026-11-14  

---

## 1. Architectural Summary & Scope

Milestone 2.4A connects the Client Directory view ([`src/app/admin/ClientDirectoryView.tsx`](file:///c:/Avencis%20Management/src/app/admin/ClientDirectoryView.tsx)) to the Supabase domain service repository [`src/services/policyService.ts`](file:///c:/Avencis%20Management/src/services/policyService.ts) and the multi-tenant PostgreSQL database.

```mermaid
flowchart TD
    UserCtx["AuthContext (role, clientId)"]
    WS["WorkspaceContext (switchClient, availableClients)"]
    CDV["ClientDirectoryView.tsx"]
    Svc["policyService.ts"]
    DB[("PostgreSQL Database")]
    RLS["Row Level Security (clients_client_admin_select)"]

    UserCtx --> WS
    WS --> CDV
    CDV -->|getAccessibleClients()| Svc
    CDV -->|getClientCardSummary()| Svc
    Svc --> RLS
    RLS --> DB
    DB -->|Client Rows & Counts| Svc
    Svc -->|ClientCardSummary Map| CDV
```

---

## 2. Integrated Features & UI Preservation

All 29 approved Stitch screens serve as the reference design baseline. `ClientDirectoryView.tsx` strictly preserves 100% of its typography, spacing, CSS classes, card layout, and responsive properties while introducing real backend capabilities:

1. **Live Supabase Client Loading:**
   - Accessible client organisations are fetched dynamically through `policyService.getAccessibleClients({ role: currentUser.role, clientId: currentUser.clientId })`.
   - Multi-tenant tenant scoping guarantees that Super Admins see all clients while tenant roles (Client Admin, Client Manager, HR Admin, Payroll Admin, Location Manager, Employee) only ever see their single assigned tenant.
2. **Real Database Metrics & Summaries:**
   - Individual client cards display real counts aggregated via `policyService.getClientCardSummary(clientId)`:
     - **Entities:** Real count of registered `client_legal_entities`.
     - **Locations:** Real count of geofenced `work_locations`.
     - **Headcount:** Live employee count from `employees` table.
     - **Policy Health:** Evaluated against `client_policies.is_configured`.
     - **Primary Operating Entity:** Resolved from `client_legal_entities.is_primary = true`.
3. **Search & Status Filtering:**
   - Real-time client search filtering across client name, code, and industry sector.
   - Status filters ('ALL', 'active', 'onboarding') operate on database-persisted statuses.
4. **State Machine & Error Boundary:**
   - **Loading State:** Clean 3-card pulsing skeleton grid matches the exact card layout, dimensions, and borders of the real cards without visual pop-in.
   - **Empty State:** Neutral empty-slate container with `Building2` icon, descriptive guidance, and a reset button when 0 records match search/filters.
   - **Error Alert:** High-contrast dismissible error alert with retry button wired to `refreshWorkspace()` if network drops or access is denied.
5. **Role-Governed Actions:**
   - "Onboard New Client" button is restricted to `super_admin` users, aligning with PostgreSQL RLS `clients_super_admin_all`.

---

## 3. Database Schema & Field Mapping Reference

| Database Field (`public.clients`) | Service Field (`ClientRow`) | Frontend Type (`Client`) | UI Presentation |
| :--- | :--- | :--- | :--- |
| `id` (UUID PK) | `id: string` | `id: string` | Workspace key (`switchClient(client.id)`) |
| `code` (VARCHAR 20) | `code: string` | `code: string` | Monospace code pill (`client.code`) |
| `name` (VARCHAR 255) | `name: string` | `name: string` | Serif card heading (`client.name`) |
| `industry` (VARCHAR 100) | `industry: string` | `industry: string` | Subheading description |
| `status` (VARCHAR 30) | `status: 'active' \| 'onboarding'` | `status: string` | Emerald / Amber status badge |
| `contact_person` (VARCHAR 150) | `contact_person: string` | `contactPerson?: string` | Portfolio administration records |
| `contact_email` (VARCHAR 255) | `contact_email: string` | `contactEmail?: string` | Support contact email |
| `contact_phone` (VARCHAR 30) | `contact_phone: string` | `contactPhone?: string` | Contact phone number |
| `created_at` (TIMESTAMPTZ) | `created_at: string` | `createdAt?: string` | System audit timestamp |

---

## 4. Verification Evidence

- **Automated Test Suite:** `scripts/testClientManagement.ts` Tests 01, 02, 09, 10, 11, 12, 13, 17, 18, 19 verified 100% pass.
- **Production Build:** Vite production bundle generated cleanly with 0 TypeScript compilation errors.
