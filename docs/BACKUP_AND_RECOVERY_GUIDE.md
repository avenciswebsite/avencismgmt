# AVENCIS WORKFORCE MANAGEMENT (WFM)
## DATABASE BACKUP, DISASTER RECOVERY & ROLLBACK GUIDE

**Project:** Avencis ERP / Business Management Platform  
**Target Backend:** PostgreSQL 15+ / Supabase Pro/Team Tier  
**Criticality:** High (Labour Law Statutory Compliance, Financial Disbursals, Audit Logs)  
**Status:** **AUTHORITATIVE OPERATIONAL GUIDE**  

---

## 1. Recovery Objectives (RTO & RPO)

| Metric | Target Standard | Operational Meaning |
|---|:---:|---|
| **Recovery Point Objective (RPO)** | **$\le 5$ Minutes** | Maximum allowable data loss during a catastrophic outage. |
| **Recovery Time Objective (RTO)** | **$\le 30$ Minutes** | Maximum allowable downtime before services are restored. |

---

## 2. Backup Architecture & Tiers

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE CLOUD POSTGRES                         │
├────────────────────────────────────────────────────────────────────────┤
│ WAL Streaming (Continuous) ──────► Supabase PITR (Point-in-Time)       │
│                                    (Retention: 7 to 30 Days)           │
│                                                                        │
│ Scheduled Daily Snapshots ───────► Supabase Automated Backups          │
│                                    (Physical EBS/Storage Snapshots)    │
│                                                                        │
│ On-Demand Schema/Data Dumps ────► pg_dump (Encrypted Offline Off-Site) │
│                                    (Retention: Monthly Form XIX Audit) │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backup Procedures

### 3.1. Continuous Point-In-Time-Recovery (PITR)
- Supabase automatically streams PostgreSQL Write-Ahead Logs (WAL) continuously to encrypted object storage.
- Enables restoration to any arbitrary second within the retention window (e.g., restoring database state to 1 second prior to an erroneous administrative command).

### 3.2. Automated Daily Logical Dumps via GitHub Actions / Cron
```bash
# Export full public schema and data excluding passwords
pg_dump "postgresql://postgres:[YOUR-PASSWORD]@db.mlopgvkvzhwhkbewhefb.supabase.co:5432/postgres" \
  --format=custom \
  --schema=public \
  --clean \
  --if-exists \
  --file="avencis_wfm_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### 3.3. Statutory Form XIX Compliance Backups
Prior to finalizing and locking monthly payroll, an on-demand snapshot of `daily_attendance_records`, `payroll_runs`, and `payroll_items` must be exported and archived to permanent offline storage to satisfy Indian State Factories Rules (Rule 78) requiring retention of register records for three years.

---

## 4. Disaster Recovery & Restoration Procedures

### Scenario A: Accidental Malicious Mutation / Data Corruption
1. Log in to the Supabase Cloud Management Console.
2. Navigate to **Project Settings** $\to$ **Database** $\to$ **Backups**.
3. Select **Point in Time Recovery (PITR)**.
4. Input the timestamp immediately preceding the incident (e.g. `2026-11-03 18:45:00 UTC`).
5. Confirm restoration. The engine provisions a cloned database with point-in-time state.

### Scenario B: Restoring from a Logical pg_dump Archive
```bash
# Restore specific table or complete public schema
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="postgresql://postgres:[YOUR-PASSWORD]@db.mlopgvkvzhwhkbewhefb.supabase.co:5432/postgres" \
  avencis_wfm_backup_20261103.dump
```

---

## 5. Verification & Drill Schedule
- **Monthly Drill:** Restore a backup dump into a staging Supabase instance and verify that `clients`, `employees`, and `payroll_items` match hash checksums.
- **Failover Verification:** Validate that RLS policies remain intact and active upon database restore.
