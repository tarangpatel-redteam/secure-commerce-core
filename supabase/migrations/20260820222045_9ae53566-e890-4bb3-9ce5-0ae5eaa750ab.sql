CREATE TABLE IF NOT EXISTS public.lab_bopla_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  marketing_opt_in boolean NOT NULL DEFAULT false,
  loyalty_tier text NOT NULL DEFAULT 'standard',
  account_credit_cents integer NOT NULL DEFAULT 0,
  is_vip boolean NOT NULL DEFAULT false,
  internal_risk_score integer NOT NULL DEFAULT 0,
  internal_notes text NOT NULL DEFAULT '',
  support_pin text NOT NULL DEFAULT '0000',
  date_of_birth date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT ALL ON public.lab_bopla_profiles TO service_role;

ALTER TABLE public.lab_bopla_profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS lab_bopla_profiles_set_updated_at ON public.lab_bopla_profiles;
CREATE TRIGGER lab_bopla_profiles_set_updated_at
BEFORE UPDATE ON public.lab_bopla_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.lab_bopla_reset()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  _a uuid;
  _b uuid;
begin
  select id into _a from auth.users where email = 'customer.a@acme-commerce.test';
  select id into _b from auth.users where email = 'customer.b@acme-commerce.test';
  if _a is null or _b is null then
    raise exception 'LAB_USERS_MISSING';
  end if;

  delete from public.lab_bopla_profiles where user_id in (_a, _b);

  insert into public.lab_bopla_profiles
    (user_id, display_name, email, phone, marketing_opt_in, loyalty_tier,
     account_credit_cents, is_vip, internal_risk_score, internal_notes, support_pin, date_of_birth)
  values
    (_a, 'Ada Customer', 'customer.a@acme-commerce.test', '+1 555 0100', true, 'standard',
     0, false, 12, 'Synthetic training record. Manual review flag cleared 2026-01-04.', '4821', date '1991-04-17'),
    (_b, 'Ben Customer', 'customer.b@acme-commerce.test', '+1 555 0199', false, 'gold',
     2500, true, 47, 'Synthetic training record. Two chargebacks on file (fictional).', '9037', date '1988-11-02');

  return jsonb_build_object('customerAUserId', _a, 'customerBUserId', _b, 'rows', 2);
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.lab_bopla_reset() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_bopla_reset() TO service_role;