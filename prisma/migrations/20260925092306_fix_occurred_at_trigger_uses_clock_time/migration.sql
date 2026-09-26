-- Bug found writing recordLabelPrint() (M2): inside a PostgreSQL transaction,
-- now() returns the TRANSACTION's start time, frozen for every statement in
-- it — not the real wall-clock moment each statement runs. withOrg() wraps
-- every mutation in one transaction; the moment a transaction does more than
-- one write before inserting an asset_events row with occurred_at = "right
-- now" (new Date() in application code, evaluated after the transaction
-- already started), real time has moved past the frozen now(), and this
-- trigger rejected it as "in the future" even though it wasn't.
--
-- clock_timestamp() is VOLATILE — it returns the actual current time at the
-- moment the function runs, exactly the semantics "don't backdate into the
-- future" was meant to have. Only asset.service.ts's createAsset happened
-- to avoid this so far, because it writes occurredAt from a form-supplied
-- acquisitionDate rather than "now" — every later milestone (loans,
-- inspections, corrections) will hit this constantly otherwise.
CREATE OR REPLACE FUNCTION public.enforce_event_occurred_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."occurred_at" > clock_timestamp() THEN
    RAISE EXCEPTION 'occurred_at tidak boleh lebih besar dari waktu sekarang';
  END IF;
  RETURN NEW;
END;
$$;
