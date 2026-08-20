CREATE OR REPLACE FUNCTION public.lab_broken_auth_reset()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  delete from public.lab_auth_accounts where true;

  insert into public.lab_auth_accounts
    (username, display_name, password_salt, password_hash, otp_code, otp_expires_at)
  values
    ('nora.vance', 'Nora Vance (synthetic)', 'lab-salt-victim',
     'f06b9ae8f1090c507e4f88f051909d0409eca93b6c23eab1b79a66755d9362ab',
     '0417', now() + interval '10 minutes'),
    ('milo.hart', 'Milo Hart (synthetic)', 'lab-salt-decoy',
     'f8257159a269fa9def0d16a4eeb42ad4d0ad7200840484284b4da25f831709b7',
     '7259', now() + interval '10 minutes'),
    ('ops.desk', 'Ops Desk (synthetic)', 'lab-salt-staff',
     '309f22831701ecfa7d35b15334403c44ececeea14565db3776fd3b02f9ce023f',
     '3186', now() + interval '10 minutes');

  return jsonb_build_object(
    'accounts', (select count(*) from public.lab_auth_accounts),
    'resetAt', now()
  );
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.lab_broken_auth_reset() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_broken_auth_reset() TO service_role;