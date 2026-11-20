-- ==============================================================================
-- MIGRATION 01: Core Client Organisations & Legal Entities
-- File: supabase/migrations/20261103000001_initial_schema_clients_and_entities.sql
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure API roles have schema usage access
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Configure default privileges for future tables and sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;

-- 1. clients table (Top-level client organizations subscribing to Avencis)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'active', 'suspended')),
    contact_person VARCHAR(150) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. client_legal_entities (Employer of record / legal entities)
-- Explicitly models payroll responsibility and statutory registrations
CREATE TABLE IF NOT EXISTS client_legal_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    registration_type VARCHAR(50) NOT NULL CHECK (registration_type IN ('PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PROPRIETORSHIP')),
    registration_number VARCHAR(100),
    pan VARCHAR(10) NOT NULL,
    tan VARCHAR(10),
    gstin VARCHAR(15),
    pf_establishment_code VARCHAR(50),
    esic_registration_code VARCHAR(50),
    registered_address TEXT NOT NULL,
    payroll_responsibility VARCHAR(40) NOT NULL DEFAULT 'SELF_MANAGED' CHECK (payroll_responsibility IN ('SELF_MANAGED', 'AVENCIS_MANAGED', 'HYBRID')),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_client_pan UNIQUE (client_id, pan)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(code);
CREATE INDEX IF NOT EXISTS idx_legal_entities_client ON client_legal_entities(client_id);

-- Explicit Data API Grants (Post-October 30 Supabase Requirement)
GRANT SELECT ON public.clients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

GRANT SELECT ON public.client_legal_entities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_legal_entities TO authenticated;
GRANT ALL ON public.client_legal_entities TO service_role;
