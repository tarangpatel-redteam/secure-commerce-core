CREATE OR REPLACE FUNCTION public.lab_rc_reset()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  DELETE FROM public.lab_rc_usage WHERE true;
  DELETE FROM public.lab_rc_records WHERE true;

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