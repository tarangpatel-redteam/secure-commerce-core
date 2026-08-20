-- Phase 4 lab: deterministic BFLA scenario data.
-- Creates a fixed staff-managed order for Customer-A that the lab uses as the
-- target of a privileged "change order status" function.
CREATE OR REPLACE FUNCTION public.lab_bfla_reset()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  _a uuid;
  _order uuid;
  _prod uuid;
  _price int;
  _name text;
  _slug text;
begin
  select id into _a from auth.users where email = 'customer.a@acme-commerce.test';
  if _a is null then
    raise exception 'LAB_USERS_MISSING';
  end if;

  select id, name, slug, price_cents into _prod, _name, _slug, _price
    from products where slug = 'echoline-wireless-earbuds';
  if _prod is null then
    raise exception 'LAB_PRODUCTS_MISSING';
  end if;

  delete from orders where order_number = 'LAB-BFLA-A1';

  insert into orders (user_id, order_number, status, subtotal_cents, shipping_cents, tax_cents,
                      total_cents, currency, shipping_address_snapshot)
  values (_a, 'LAB-BFLA-A1', 'paid', _price, 0, round(_price * 0.08), _price + round(_price * 0.08), 'USD',
          jsonb_build_object('label','Home','recipientName','Ada Customer','line1','118 Harbor Lane',
                             'line2',null,'city','Portland','state','OR','postalCode','97205','country','US','phone','+1 555 0100'))
  returning id into _order;

  insert into order_items (order_id, product_id, product_name_snapshot, product_slug_snapshot,
                           unit_price_cents, quantity, line_total_cents)
  values (_order, _prod, _name, _slug, _price, 1, _price);

  insert into payments (order_id, status, amount_cents, currency, provider, provider_reference)
  values (_order, 'succeeded', _price + round(_price * 0.08), 'USD', 'acme_mock', 'LABPAY-BFLA-A1');

  return jsonb_build_object('labOrderId', _order, 'orderNumber', 'LAB-BFLA-A1', 'status', 'paid');
end;
$function$;

REVOKE ALL ON FUNCTION public.lab_bfla_reset() FROM public;
REVOKE ALL ON FUNCTION public.lab_bfla_reset() FROM anon;
REVOKE ALL ON FUNCTION public.lab_bfla_reset() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.lab_bfla_reset() TO service_role;

SELECT public.lab_bfla_reset();