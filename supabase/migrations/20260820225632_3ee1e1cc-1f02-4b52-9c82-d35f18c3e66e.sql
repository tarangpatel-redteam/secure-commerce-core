CREATE TABLE public.lab_bizflow_stock (
  variant text PRIMARY KEY,
  sku text NOT NULL DEFAULT 'ACME-DROP-01',
  remaining integer NOT NULL DEFAULT 25,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lab_bizflow_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant text NOT NULL,
  user_id uuid NOT NULL,
  quantity integer NOT NULL,
  client_signature text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.lab_bizflow_stock TO service_role;
GRANT ALL ON public.lab_bizflow_purchases TO service_role;

ALTER TABLE public.lab_bizflow_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_bizflow_purchases ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.lab_bizflow_reset()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.lab_bizflow_purchases WHERE true;
  DELETE FROM public.lab_bizflow_stock WHERE true;
  INSERT INTO public.lab_bizflow_stock (variant, remaining) VALUES ('vulnerable', 25), ('secure', 25);
  RETURN jsonb_build_object('stock', 25);
END;
$$;

REVOKE ALL ON FUNCTION public.lab_bizflow_reset() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_bizflow_reset() TO service_role;

SELECT public.lab_bizflow_reset();