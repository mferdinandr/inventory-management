-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.uuidv7() RETURNS uuid
VOLATILE
LANGUAGE plpgsql
AS $$
DECLARE
  ts_ms bigint;
  b bytea;
BEGIN
  ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  b := substr(int8send(ts_ms) || gen_random_bytes(8), 1, 16)
  b := set_byte(b, 6, (get_byte(b, 6) & 15) | 112)
  b := set_byte(b, 8, (get_byte(b, 8) & 63) | 128)
  RETURN (encode(b, 'hex'))::uuid;
END;
$$;



-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLATFORM_OWNER', 'SUPERADMIN', 'ADMIN', 'PIC_ROOM', 'TECHNICIAN', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('BUILDING', 'FLOOR', 'DEPARTMENT', 'ROOM');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'ON_LOAN', 'UNDER_REPAIR', 'AT_VENDOR', 'DAMAGED', 'LOST', 'DISPOSED');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('GOOD', 'MINOR_ISSUE', 'NEEDS_REPAIR', 'UNUSABLE');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CREATED', 'INSPECTION', 'MAINTENANCE', 'REPAIR', 'CALIBRATION', 'LOAN_OUT', 'LOAN_RETURN', 'TRANSFER', 'STATUS_CHANGE', 'NOTE', 'DISPOSAL', 'CORRECTION', 'LABEL_PRINTED');

-- CreateEnum
CREATE TYPE "BorrowerType" AS ENUM ('INTERNAL_USER', 'EXTERNAL_PERSON');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('CALIBRATION', 'PREVENTIVE', 'CORRECTIVE');

-- CreateEnum
CREATE TYPE "MaintenanceResult" AS ENUM ('PASS', 'PASS_WITH_NOTE', 'FAIL');

-- CreateEnum
CREATE TYPE "FundingSource" AS ENUM ('APBD', 'APBN', 'BLUD', 'HIBAH', 'KSO', 'LAINNYA');

-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('SUPPLIER', 'SERVICE', 'CALIBRATION');

-- CreateEnum
CREATE TYPE "DisposalReason" AS ENUM ('RUSAK_TOTAL', 'HILANG', 'DIHIBAHKAN', 'DIJUAL', 'KEDALUWARSA', 'LAINNYA');

-- CreateEnum
CREATE TYPE "PrintReason" AS ENUM ('FIRST_PRINT', 'LABEL_DAMAGED', 'LABEL_LOST', 'LABEL_FADED', 'RELOCATED');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'TRIAL',
    "address" TEXT,
    "logo_object_key" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "loan_overdue_threshold_days" INTEGER NOT NULL DEFAULT 7,
    "quota_assets" INTEGER NOT NULL DEFAULT 2000,
    "quota_storage_bytes" BIGINT NOT NULL DEFAULT 21474836480,
    "quota_users" INTEGER NOT NULL DEFAULT 50,
    "used_storage_bytes" BIGINT NOT NULL DEFAULT 0,
    "show_government_fields" BOOLEAN NOT NULL DEFAULT true,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "notes_internal" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID,
    "email" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "employee_number" TEXT,
    "job_title" TEXT,
    "invite_token_hash" TEXT,
    "invite_expires_at" TIMESTAMPTZ(6),
    "totp_secret" TEXT,
    "totp_enabled_at" TIMESTAMPTZ(6),
    "recovery_codes" TEXT[],
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_locations" (
    "user_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,

    CONSTRAINT "user_locations_pkey" PRIMARY KEY ("user_id","location_id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "parent_id" UUID,
    "type" "LocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "pic_user_id" UUID,
    "path" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_medical_device" BOOLEAN NOT NULL DEFAULT false,
    "default_calibration_interval_months" INTEGER,
    "default_economic_life_years" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VendorType"[],
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "asset_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" UUID,
    "location_id" UUID NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "brand" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "year_manufactured" INTEGER,
    "acquisition_date" DATE,
    "acquisition_cost" DECIMAL(16,2),
    "funding_source" "FundingSource",
    "acquisition_document_no" TEXT,
    "vendor_id" UUID,
    "warranty_until" DATE,
    "economic_life_years" INTEGER,
    "responsible_user_id" UUID,
    "primary_photo_key" TEXT,
    "notes" TEXT,
    "disposal_reason" "DisposalReason",
    "disposed_at" DATE,
    "disposed_recorded_at" TIMESTAMPTZ(6),
    "disposal_revert_until" TIMESTAMPTZ(6),
    "status_before_disposal" "AssetStatus",
    "qr_first_printed_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID NOT NULL,
    "location_id" UUID,
    "status_before" "AssetStatus",
    "status_after" "AssetStatus",
    "corrects_event_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "asset_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "original_filename" TEXT,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "borrower_type" "BorrowerType" NOT NULL,
    "borrower_user_id" UUID,
    "borrower_name" TEXT,
    "borrower_phone" TEXT,
    "borrower_unit" TEXT,
    "purpose" TEXT NOT NULL,
    "borrowed_at" TIMESTAMPTZ(6) NOT NULL,
    "due_at" TIMESTAMPTZ(6),
    "returned_at" TIMESTAMPTZ(6),
    "condition_out" "AssetCondition" NOT NULL,
    "condition_in" "AssetCondition",
    "return_notes" TEXT,
    "checkout_event_id" UUID NOT NULL,
    "checkin_event_id" UUID,
    "recorded_by" UUID NOT NULL,
    "returned_recorded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "interval_months" INTEGER NOT NULL,
    "last_performed_at" DATE,
    "next_due_at" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "schedule_id" UUID,
    "type" "MaintenanceType" NOT NULL,
    "performed_at" DATE NOT NULL,
    "performed_by_vendor_id" UUID,
    "performed_by_internal" TEXT,
    "result" "MaintenanceResult",
    "valid_until" DATE,
    "certificate_number" TEXT,
    "certificate_object_key" TEXT,
    "cost" DECIMAL(16,2),
    "parts_replaced" TEXT,
    "description" TEXT,
    "event_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "label_prints" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "reason" "PrintReason" NOT NULL,
    "label_size" TEXT NOT NULL,
    "printed_by" UUID NOT NULL,
    "printed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "label_prints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "changes" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID,
    "to_email" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(6) NOT NULL,
    "remembered" BOOLEAN NOT NULL DEFAULT false,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");

-- CreateIndex
CREATE INDEX "user_locations_location_id_idx" ON "user_locations"("location_id");

-- CreateIndex
CREATE INDEX "locations_organization_id_idx" ON "locations"("organization_id");

-- CreateIndex
CREATE INDEX "locations_parent_id_idx" ON "locations"("parent_id");

-- CreateIndex
CREATE INDEX "locations_path_idx" ON "locations"("path");

-- CreateIndex
CREATE INDEX "categories_organization_id_idx" ON "categories"("organization_id");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "vendors_organization_id_idx" ON "vendors"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_public_id_key" ON "assets"("public_id");

-- CreateIndex
CREATE INDEX "assets_organization_id_location_id_idx" ON "assets"("organization_id", "location_id");

-- CreateIndex
CREATE INDEX "assets_organization_id_status_idx" ON "assets"("organization_id", "status");

-- CreateIndex
CREATE INDEX "assets_organization_id_category_id_idx" ON "assets"("organization_id", "category_id");

-- CreateIndex
CREATE INDEX "assets_organization_id_serial_number_idx" ON "assets"("organization_id", "serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "assets_organization_id_asset_code_key" ON "assets"("organization_id", "asset_code");

-- CreateIndex
CREATE INDEX "asset_events_asset_id_idx" ON "asset_events"("asset_id");

-- CreateIndex
CREATE INDEX "asset_events_organization_id_type_idx" ON "asset_events"("organization_id", "type");

-- CreateIndex
CREATE INDEX "asset_events_organization_id_idx" ON "asset_events"("organization_id");

-- CreateIndex
CREATE INDEX "attachments_event_id_idx" ON "attachments"("event_id");

-- CreateIndex
CREATE INDEX "attachments_organization_id_idx" ON "attachments"("organization_id");

-- CreateIndex
CREATE INDEX "loans_organization_id_idx" ON "loans"("organization_id");

-- CreateIndex
CREATE INDEX "maintenance_schedules_organization_id_idx" ON "maintenance_schedules"("organization_id");

-- CreateIndex
CREATE INDEX "maintenance_schedules_asset_id_idx" ON "maintenance_schedules"("asset_id");

-- CreateIndex
CREATE INDEX "maintenance_records_organization_id_idx" ON "maintenance_records"("organization_id");

-- CreateIndex
CREATE INDEX "maintenance_records_asset_id_idx" ON "maintenance_records"("asset_id");

-- CreateIndex
CREATE INDEX "maintenance_records_schedule_id_idx" ON "maintenance_records"("schedule_id");

-- CreateIndex
CREATE INDEX "label_prints_organization_id_idx" ON "label_prints"("organization_id");

-- CreateIndex
CREATE INDEX "label_prints_asset_id_idx" ON "label_prints"("asset_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "email_logs_organization_id_idx" ON "email_logs"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_pic_user_id_fkey" FOREIGN KEY ("pic_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_corrects_event_id_fkey" FOREIGN KEY ("corrects_event_id") REFERENCES "asset_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "asset_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_user_id_fkey" FOREIGN KEY ("borrower_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_checkout_event_id_fkey" FOREIGN KEY ("checkout_event_id") REFERENCES "asset_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_checkin_event_id_fkey" FOREIGN KEY ("checkin_event_id") REFERENCES "asset_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_returned_recorded_by_fkey" FOREIGN KEY ("returned_recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "maintenance_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_performed_by_vendor_id_fkey" FOREIGN KEY ("performed_by_vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "asset_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_prints" ADD CONSTRAINT "label_prints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_prints" ADD CONSTRAINT "label_prints_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_prints" ADD CONSTRAINT "label_prints_printed_by_fkey" FOREIGN KEY ("printed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- >>> SIMASET hardening (appended) <<<
-- ===========================================================================
-- SIMASET — M0 hardening (bukan dari Prisma;sesuai docs/03-erd.md
--         dan docs/04-technical-architecture.md ADR-02/05/08)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Ekstensi & fungsi UUID v7 (docs/03-erd.md bab 1)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2) Peran basis data
--    simaset_app     : koneksi aplikasi normal (terikat RLS;
--    simaset_public   : koneksi halaman publik (izin kolom terbatas;
--    simaset_platform : koneksi panel operator, melewati RLS (BYPASSRLS。
-- GANTI password di produksi mengikuti alur secrets management.
-- ---------------------------------------------------------------------------
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'simaset_app') THEN
    CREATE ROLE simaset_app LOGIN PASSWORD 'simaset-dev-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'simaset_public') THEN
    CREATE ROLE simaset_public LOGIN PASSWORD 'simaset-dev-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'simaset_platform') THEN
    CREATE ROLE simaset_platform LOGIN BYPASSRLS PASSWORD 'simaset-dev-only';
  END IF;
END
$role$;

GRANT USAGE ON SCHEMA public TO simaset_app, simaset_public, simaset_platform;

-- Izin penuh untuk peran aplikasi & operator
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO simaset_app, simaset_platform;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO simaset_app, simaset_platform;

-- Izin kolom terbatas untuk halaman publik (docs/00-README.md butir 7:
-- "Halaman hasil scan QR publik, data terbatas" — kolom sensitif tidak pernah keluar DB)
GRANT SELECT (id, organization_id, public_id, asset_code, name, status, condition, brand, model, primary_photo_key) ON assets TO simaset_public;
GRANT SELECT (id, name, logo_object_key) ON organizations TO simaset_public;
GRANT SELECT (id, asset_id, organization_id, type, title, occurred_at, metadata) ON asset_events TO simaset_public;

-- ---------------------------------------------------------------------------
-- 3) Row Level Security (docs/03-erd.md bab 5 butir 1; ADR-08)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_current_org_id() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_org', true), ''), '00000000-0000-0000-0000-000000000000')::uuid;
$$;

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
CREATE POLICY organizations_tenant_isolation ON "organizations"
  USING (id = public.app_current_org_id());

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON "users"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "user_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY user_locations_tenant_isolation ON "user_locations"
  USING (
    EXISTS (
      SELECT 1 FROM "users" u
      WHERE u.organization_id = public.app_current_org_id()
        AND u.id = "user_locations"."user_id"
    )
  );

ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY locations_tenant_isolation ON "locations"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY categories_tenant_isolation ON "categories"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendors" FORCE ROW LEVEL SECURITY;
CREATE POLICY vendors_tenant_isolation ON "vendors"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY assets_tenant_isolation ON "assets"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "asset_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY asset_events_tenant_isolation ON "asset_events"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachments" FORCE ROW LEVEL SECURITY;
CREATE POLICY attachments_tenant_isolation ON "attachments"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loans" FORCE ROW LEVEL SECURITY;
CREATE POLICY loans_tenant_isolation ON "loans"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "maintenance_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "maintenance_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY maintenance_schedules_tenant_isolation ON "maintenance_schedules"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "maintenance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "maintenance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY maintenance_records_tenant_isolation ON "maintenance_records"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "label_prints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "label_prints" FORCE ROW LEVEL SECURITY;
CREATE POLICY label_prints_tenant_isolation ON "label_prints"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_tenant_isolation ON "audit_logs"
  USING (organization_id = public.app_current_org_id());

ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY email_logs_tenant_isolation ON "email_logs"
  USING (organization_id = public.app_current_org_id());

-- ---------------------------------------------------------------------------
-- 4) Append-only riwayat (docs ADR-02; dok/03-erd bab 3.8)
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON "asset_events" FROM simaset_app, simaset_platform;

CREATE RULE asset_events_no_update AS ON UPDATE TO "asset_events" DO INSTEAD NOTHING;
CREATE RULE asset_events_no_delete AS ON DELETE TO "asset_events" DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------------
-- 5) Indeks parsial, GIN, dan urutan waktu (docs/03-erd.md bab 3)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "loans_one_active_per_asset"
  ON "loans" ("asset_id") WHERE "returned_at" IS NULL;

CREATE INDEX "loans_active_idx"
  ON "loans" ("organization_id", "borrowed_at" DESC) WHERE "returned_at" IS NULL;

CREATE INDEX "events_asset_time_idx"
  ON "asset_events" ("asset_id", "occurred_at" DESC);

CREATE INDEX "events_org_type_idx"
  ON "asset_events" ("organization_id", "type", "occurred_at" DESC);

CREATE INDEX "events_corrects_idx"
  ON "asset_events" ("corrects_event_id") WHERE "corrects_event_id" IS NOT NULL;

CREATE INDEX "assets_revertible_idx"
  ON "assets" ("organization_id", "disposal_revert_until") WHERE "status" = 'DISPOSED' AND "disposal_revert_until" IS NOT NULL;

CREATE INDEX "assets_search_idx" ON "assets" USING GIN (
  to_tsvector('simple',
    coalesce("name",''), ' ') || ' ' ||
    coalesce("asset_code",'') || ' ' ||
    coalesce("brand",'') || ' ' ||
    coalesce("model",'') || ' ' ||
    coalesce("serial_number",'')
  )
);

CREATE INDEX "schedules_due_idx"
  ON "maintenance_schedules" ("organization_id", "next_due_at") WHERE "is_active" = true;

-- ---------------------------------------------------------------------------
-- 6) Constraint & trigger integritas (docs/03-erd.md bab 5)
-- ---------------------------------------------------------------------------

-- Aset hanya boleh menunjuk ruangan (ROOM)
CREATE OR REPLACE FUNCTION public.enforce_asset_location_room() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  loc_type text;
BEGIN
  SELECT type INTO loc_type FROM "locations" WHERE id = NEW.location_id;
  IF loc_type IS DISTINCT FROM 'ROOM' THEN
    RAISE EXCEPTION 'Aset hanya boleh berada di lokasi bertipe ROOM。';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_asset_location_room
  BEFORE INSERT OR UPDATE OF "location_id" ON "assets"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_asset_location_room();

-- occurred_at tidak boleh di masa depan
CREATE OR REPLACE FUNCTION public.enforce_event_occurred_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."occurred_at" > now() THEN
    RAISE EXCEPTION 'occurred_at tidak boleh lebih besar dari now()';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_event_not_future
  BEFORE INSERT OR UPDATE OF "occurred_at" ON "asset_events"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_occurred_at();

-- Konsistensi peminjaman: data peminjamwajib sesuai borro_type
ALTER TABLE "loans" ADD CONSTRAINT loans_borrower_check CHECK (
  ("borrower_type" = 'INTERNAL_USER' AND "borrower_user_id" IS NOT NULL)
  OR
  ("borrower_type" = 'EXTERNAL_PERSON' AND "borrower_name" IS NOT NULL AND "borrower_phone" IS NOT NULL)
);

ALTER TABLE "loans" ADD CONSTRAINT loans_returned_after_borrowed CHECK (
  "returned_at" IS NULL OR "returned_at" >= "borrowed_at"
);