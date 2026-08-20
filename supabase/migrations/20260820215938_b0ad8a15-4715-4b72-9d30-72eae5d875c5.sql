create or replace function public.lab_bola_reset()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _a uuid;
  _b uuid;
  _order_a uuid;
  _order_b uuid;
  _prod_a uuid;
  _prod_b uuid;
  _price_a int;
  _price_b int;
  _name_a text;
  _name_b text;
  _slug_a text;
  _slug_b text;
begin
  select id into _a from auth.users where email = 'customer.a@acme-commerce.test';
  select id into _b from auth.users where email = 'customer.b@acme-commerce.test';
  if _a is null or _b is null then
    raise exception 'LAB_USERS_MISSING';
  end if;

  select id, name, slug, price_cents into _prod_a, _name_a, _slug_a, _price_a
    from products where slug = 'echoline-wireless-earbuds';
  select id, name, slug, price_cents into _prod_b, _name_b, _slug_b, _price_b
    from products where slug = 'pebble-portable-speaker';
  if _prod_a is null or _prod_b is null then
    raise exception 'LAB_PRODUCTS_MISSING';
  end if;

  delete from orders where order_number in ('LAB-BOLA-A1', 'LAB-BOLA-B1');

  insert into orders (user_id, order_number, status, subtotal_cents, shipping_cents, tax_cents,
                      total_cents, currency, shipping_address_snapshot)
  values (_a, 'LAB-BOLA-A1', 'paid', _price_a, 0, round(_price_a * 0.08), _price_a + round(_price_a * 0.08), 'USD',
          jsonb_build_object('label','Home','recipientName','Ada Customer','line1','118 Harbor Lane',
                             'line2',null,'city','Portland','state','OR','postalCode','97205','country','US','phone','+1 555 0100'))
  returning id into _order_a;

  insert into order_items (order_id, product_id, product_name_snapshot, product_slug_snapshot,
                           unit_price_cents, quantity, line_total_cents)
  values (_order_a, _prod_a, _name_a, _slug_a, _price_a, 1, _price_a);

  insert into payments (order_id, status, amount_cents, currency, provider, provider_reference)
  values (_order_a, 'succeeded', _price_a + round(_price_a * 0.08), 'USD', 'acme_mock', 'LABPAY-A1');

  insert into orders (user_id, order_number, status, subtotal_cents, shipping_cents, tax_cents,
                      total_cents, currency, shipping_address_snapshot)
  values (_b, 'LAB-BOLA-B1', 'paid', _price_b, 0, round(_price_b * 0.08), _price_b + round(_price_b * 0.08), 'USD',
          jsonb_build_object('label','Home','recipientName','Ben Customer','line1','44 Sandpiper Court',
                             'line2','Apt 3','city','Austin','state','TX','postalCode','78701','country','US','phone','+1 555 0199'))
  returning id into _order_b;

  insert into order_items (order_id, product_id, product_name_snapshot, product_slug_snapshot,
                           unit_price_cents, quantity, line_total_cents)
  values (_order_b, _prod_b, _name_b, _slug_b, _price_b, 2, _price_b * 2);

  insert into payments (order_id, status, amount_cents, currency, provider, provider_reference)
  values (_order_b, 'succeeded', _price_b + round(_price_b * 0.08), 'USD', 'acme_mock', 'LABPAY-B1');

  return jsonb_build_object(
    'customerAOrderId', _order_a,
    'customerBOrderId', _order_b
  );
end;
$$;

revoke all on function public.lab_bola_reset() from public, anon, authenticated;
grant execute on function public.lab_bola_reset() to service_role;

select public.lab_bola_reset();