-- occurred_at diambil dari jam server aplikasi (Node, via `new Date()`) tapi
-- divalidasi terhadap jam server database (`clock_timestamp()`). Keduanya
-- adalah mesin berbeda (di deployment VPS milik pengguna, bisa jadi dua
-- container atau bahkan dua host berbeda) — sedikit selisih jam (clock skew)
-- antar keduanya adalah hal normal, bukan bug, dan sebelumnya menyebabkan
-- panggilan berurutan yang sangat rapat (mis. dua kali cetak label beruntun)
-- gagal secara nondeterministik dengan pesan "occurred_at tidak boleh lebih
-- besar dari waktu sekarang" walau occurred_at sebenarnya adalah "sekarang".
--
-- Perbaikan: beri toleransi kecil (5 detik) pada pemeriksaan "tidak boleh di
-- masa depan". Ini praktik standar untuk perbandingan lintas-jam di sistem
-- terdistribusi, dan tetap menolak occurred_at yang sungguh-sungguh di masa
-- depan (mis. salah ketik tanggal tahun depan pada input manual).
CREATE OR REPLACE FUNCTION public.enforce_event_occurred_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."occurred_at" > clock_timestamp() + interval '5 seconds' THEN
    RAISE EXCEPTION 'occurred_at tidak boleh lebih besar dari waktu sekarang';
  END IF;
  RETURN NEW;
END;
$$;
