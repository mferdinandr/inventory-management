CREATE SEQUENCE item_code_seq;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OPERASI', 'STERIL', 'ALKES', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "Location" AS ENUM ('OPERASI', 'CSSD');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('REGISTER', 'EDIT', 'SEND', 'RETURN', 'MAINTENANCE', 'ARCHIVE', 'RESTORE');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PERBAIKAN', 'PEMELIHARAAN', 'KALIBRASI');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL DEFAULT ('BRG-'::text || lpad((nextval('item_code_seq'::regclass))::text, 4, '0'::text)),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "needs_sterilization" BOOLEAN NOT NULL,
    "location" "Location" NOT NULL DEFAULT 'OPERASI',
    "room" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "damaged_quantity" INTEGER NOT NULL DEFAULT 0,
    "brand" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "purchase_date" DATE,
    "purchase_price" BIGINT,
    "supplier" TEXT,
    "funding_source" TEXT,
    "warranty_until" DATE,
    "location_since" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_contents" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "quantity" INTEGER NOT NULL,
    "damaged_quantity" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "performed_on" DATE NOT NULL,
    "performer" TEXT NOT NULL,
    "cost" BIGINT,
    "note" TEXT,
    "details" JSONB NOT NULL,
    "next_due" DATE,
    "damaged_after" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "actor_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_logs" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "action" "LogAction" NOT NULL,
    "user_id" UUID NOT NULL,
    "actor_name" TEXT NOT NULL,
    "note" TEXT,
    "changes" JSONB,
    "maintenance_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "items_code_key" ON "items"("code");

-- CreateIndex
CREATE INDEX "items_location_active_idx" ON "items"("location");

-- CreateIndex
CREATE UNIQUE INDEX "item_contents_item_id_name_key" ON "item_contents"("item_id", "name");

-- CreateIndex
CREATE INDEX "maintenance_records_item_id_performed_on_idx" ON "maintenance_records"("item_id", "performed_on" DESC);

-- CreateIndex
CREATE INDEX "item_logs_item_id_created_at_idx" ON "item_logs"("item_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "item_contents" ADD CONSTRAINT "item_contents_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_logs" ADD CONSTRAINT "item_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_logs" ADD CONSTRAINT "item_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_logs" ADD CONSTRAINT "item_logs_maintenance_id_fkey" FOREIGN KEY ("maintenance_id") REFERENCES "maintenance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integrity rules that Prisma cannot express ---------------------------------

ALTER TABLE "items"
  ADD CONSTRAINT items_quantity_nonneg CHECK (quantity >= 0),
  ADD CONSTRAINT items_damaged_range CHECK (damaged_quantity BETWEEN 0 AND quantity),
  ADD CONSTRAINT items_price_nonneg CHECK (purchase_price IS NULL OR purchase_price >= 0),
  -- one QR per serialized unit
  ADD CONSTRAINT items_serial_implies_single CHECK (serial_number IS NULL OR quantity = 1),
  -- items that need no sterilization never leave the operating room
  ADD CONSTRAINT items_no_cssd_without_sterilization CHECK (needs_sterilization OR location = 'OPERASI');

ALTER TABLE "item_contents"
  ADD CONSTRAINT item_contents_quantity_nonneg CHECK (quantity >= 0),
  ADD CONSTRAINT item_contents_damaged_range CHECK (damaged_quantity BETWEEN 0 AND quantity);

ALTER TABLE "maintenance_records"
  ADD CONSTRAINT maintenance_cost_nonneg CHECK (cost IS NULL OR cost >= 0),
  ADD CONSTRAINT maintenance_damaged_after_nonneg CHECK (damaged_after >= 0);

CREATE INDEX "maintenance_records_next_due_idx" ON "maintenance_records" ("next_due")
  WHERE "next_due" IS NOT NULL;

-- Append-only history: no UPDATE, DELETE or TRUNCATE, even for the table owner -----

CREATE FUNCTION forbid_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER item_logs_append_only
  BEFORE UPDATE OR DELETE ON "item_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_history_change();
CREATE TRIGGER item_logs_no_truncate
  BEFORE TRUNCATE ON "item_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_history_change();

CREATE TRIGGER maintenance_records_append_only
  BEFORE UPDATE OR DELETE ON "maintenance_records"
  FOR EACH ROW EXECUTE FUNCTION forbid_history_change();
CREATE TRIGGER maintenance_records_no_truncate
  BEFORE TRUNCATE ON "maintenance_records"
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_history_change();
