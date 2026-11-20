# Avencis Workforce Management (Module 01)
# Implementation Gap & Ambiguity Register (Reconciled)

---

**Document Reference:** `docs/IMPLEMENTATION_GAP_REGISTER.md`  
**Last Updated:** 03 November 2026  
**Status:** **RECONCILED & UNLOCKED FOR IMPLEMENTATION**  
**Governing Authority:** Master Implementation Directive (Part 5, 6, 7 & 14)  

---

## 1. Executive Reconciliation Summary

All 10 issues previously cataloged in the Gap Register have been formally addressed and resolved by the Master Implementation Directive.

| Issue ID | Affected Module | Previous Severity | Confirmed Resolution from Master Directive | Status |
| :--- | :--- | :---: | :--- | :---: |
| **GAP-01** | Multi-Entity / Payroll | **CRITICAL** | **RESOLVED:** Client-only payroll model confirmed. Avencis is provider, not employer. Each client has own legal entities. | ✅ **RESOLVED** |
| **GAP-02** | Attendance / Mobile UX | **HIGH** | **RESOLVED:** Dedicated responsive mobile viewport ($390\times 844\text{px}$) authorized for field worker punch card. | ✅ **RESOLVED** |
| **GAP-03** | Security / GPS Telemetry| **HIGH** | **RESOLVED:** Server/client telemetry anomaly logging enabled; suspicious flags recorded for manager review. | ✅ **RESOLVED** |
| **GAP-04** | Overtime Formulation | **MEDIUM** | **RESOLVED:** Configured at CLIENT LEVEL via the 20 Policy Domains engine. | ✅ **RESOLVED** |
| **GAP-05** | Late Arrival Penalty | **MEDIUM** | **RESOLVED:** Configured at CLIENT LEVEL via the 20 Policy Domains engine. | ✅ **RESOLVED** |
| **GAP-06** | Overnight Shifts | **MEDIUM** | **RESOLVED:** Configured at CLIENT LEVEL (Shift Start vs Shift End attribution). | ✅ **RESOLVED** |
| **GAP-07** | Client Geofence Mapping | **MEDIUM** | **RESOLVED:** Implemented as interactive radius/coordinate configuration in client settings. | ✅ **RESOLVED** |
| **GAP-08** | Automated Leave Accrual | **MEDIUM** | **RESOLVED:** Handled via idempotent ledger service checking 1st of month accruals. | ✅ **RESOLVED** |
| **GAP-09** | Photo/Selfie Verification| **LOW** | **RESOLVED:** Configured at CLIENT LEVEL via policy toggle (`require_selfie_verification`). | ✅ **RESOLVED** |
| **GAP-10** | Salary Grade Catalog | **LOW** | **RESOLVED:** Structured component packages defined per client organisation. | ✅ **RESOLVED** |

---

## 2. Unconfigured Policy Safety Protocol

In strict adherence to Part 6 of the Master Directive:
* If a client administrator or Super Admin has not yet configured a specific policy value (e.g., Overtime rate or Late Mark penalty), the system displays the status as `UNCONFIGURED`.
* The payroll engine **gates and prevents payroll finalisation** if a mandatory calculation rule is missing, displaying clear descriptive validation warnings.
* The system never invents or silently applies arbitrary penalties or statutory withholding rates.
