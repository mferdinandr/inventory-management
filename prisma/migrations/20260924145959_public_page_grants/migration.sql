-- FR-24 (docs/02-prd.md §G): halaman publik hasil scan butuh lebih dari yang
-- migrasi awal (20260922144228_init) sempat berikan ke simaset_public — sebatas
-- id/organization_id/public_id/asset_code/name/status/condition/brand/model/
-- primary_photo_key pada "assets", plus dua tabel lain. Tanpa location_id/
-- category_id di sana, tidak mungkin bahkan menautkan ke ruangan atau
-- kategorinya. Ditambahkan di sini, bukan diedit di migrasi lama yang sudah
-- diterapkan.

-- Sama seperti simaset_platform dan (belakangan) credentials.service.ts /
-- auth-token.service.ts: pengunjung yang memindai QR belum diketahui
-- organisasinya SAMPAI baris asetnya ditemukan lewat public_id — itulah
-- justru yang sedang dicari. Tanpa BYPASSRLS, kebijakan RLS baku
-- (organization_id = app_current_org_id(), dan app.current_org belum pernah
-- disetel di sini) membuat kueri ini SELALU mengembalikan nol baris,
-- terlepas dari GRANT kolom apa pun. Diverifikasi lewat skrip probe sebelum
-- ditulis di sini. Aman: peran ini tetap hanya bisa membaca kolom yang
-- di-GRANT di bawah, apa pun barisnya — BYPASSRLS hanya melepas pembatasan
-- BARIS, bukan pembatasan KOLOM.
ALTER ROLE simaset_public BYPASSRLS;

GRANT SELECT (location_id, category_id) ON "assets" TO simaset_public;

GRANT SELECT (id, name, code, pic_user_id) ON "locations" TO simaset_public;

GRANT SELECT (id, name) ON "categories" TO simaset_public;

-- Nama PIC ruangan saja (docs/07-rbac-security.md §3: "hanya nama, tanpa kontak").
GRANT SELECT (id, name) ON "users" TO simaset_public;

GRANT SELECT (id, asset_id, type, next_due_at, is_active) ON "maintenance_schedules" TO simaset_public;
