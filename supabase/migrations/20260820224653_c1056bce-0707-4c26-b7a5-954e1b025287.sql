CREATE TABLE public.lab_rc_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seq integer NOT NULL,
  reference text NOT NULL,
  customer_label text NOT NULL,
  region text NOT NULL,
  amount_cents integer NOT NULL,
  issued_on date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.lab_rc_records TO service_role;
ALTER TABLE public.lab_rc_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lab_rc_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  variant text NOT NULL,
  window_started_at timestamp with time zone NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  rows_returned integer NOT NULL DEFAULT 0,
  compute_units integer NOT NULL DEFAULT 0,
  notifications_sent integer NOT NULL DEFAULT 0,
  budget_spent_cents integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, variant)
);

GRANT ALL ON public.lab_rc_usage TO service_role;
ALTER TABLE public.lab_rc_usage ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER lab_rc_usage_set_updated_at
BEFORE UPDATE ON public.lab_rc_usage
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.lab_rc_reset()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  DELETE FROM public.lab_rc_usage;
  DELETE FROM public.lab_rc_records;

  INSERT INTO public.lab_rc_records (seq, reference, customer_label, region, amount_cents, issued_on)
  SELECT
    g,
    'ACME-INV-' || lpad(g::text, 5, '0'),
    'Synthetic Customer ' || lpad(((g % 40) + 1)::text, 2, '0'),
    (ARRAY['emea','amer','apac','latam'])[(g % 4) + 1],
    1500 + ((g * 137) % 48500),
    DATE '2026-01-01' + ((g % 180) || ' days')::interval
  FROM generate_series(1, 500) AS g;

  SELECT count(*) INTO _count FROM public.lab_rc_records;
  RETURN jsonb_build_object('records', _count, 'usageCleared', true);
END;
$$;

REVOKE ALL ON FUNCTION public.lab_rc_reset() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_rc_reset() TO service_role;

SELECT public.lab_rc_reset();