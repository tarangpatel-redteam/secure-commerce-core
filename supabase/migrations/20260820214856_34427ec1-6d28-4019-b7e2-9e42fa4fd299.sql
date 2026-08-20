-- ADDRESSES ---------------------------------------------------------------
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  recipient_name text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  state text NOT NULL DEFAULT '',
  postal_code text NOT NULL,
  country text NOT NULL DEFAULT 'US',
  phone text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user_id_idx ON public.addresses(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY addresses_own ON public.addresses FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER addresses_set_updated_at BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ENUMS ---------------------------------------------------------------------
CREATE TYPE public.order_status AS ENUM ('pending','paid','processing','shipped','delivered','cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending','succeeded','failed');

-- ORDERS --------------------------------------------------------------------
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number text NOT NULL UNIQUE DEFAULT ('ACM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal_cents integer NOT NULL,
  shipping_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  shipping_address_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_id_created_idx ON public.orders(user_id, created_at DESC);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_select_own ON public.orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name_snapshot text NOT NULL,
  product_slug_snapshot text NOT NULL DEFAULT '',
  unit_price_cents integer NOT NULL,
  quantity integer NOT NULL,
  line_total_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_id_idx ON public.order_items(order_id);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_items_select_own ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
                 AND (o.user_id = auth.uid() OR public.is_staff(auth.uid()))));

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.payment_status NOT NULL DEFAULT 'pending',
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  provider text NOT NULL DEFAULT 'acme_mock',
  provider_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_id_idx ON public.payments(order_id);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_select_own ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
                 AND (o.user_id = auth.uid() OR public.is_staff(auth.uid()))));

-- CHECKOUT ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(_address_id uuid, _payment_method text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  addr public.addresses%ROWTYPE;
  line record;
  subtotal integer := 0;
  shipping integer := 0;
  tax integer := 0;
  total integer := 0;
  new_order public.orders%ROWTYPE;
  reference text;
  pay_status public.payment_status;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF _payment_method NOT IN ('test_success','test_decline') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;

  SELECT * INTO addr FROM public.addresses WHERE id = _address_id AND user_id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ADDRESS_NOT_FOUND';
  END IF;

  -- Lock the product rows involved so stock cannot be oversold concurrently.
  PERFORM 1 FROM public.products p
    WHERE p.id IN (SELECT ci.product_id FROM public.cart_items ci WHERE ci.user_id = uid)
    ORDER BY p.id FOR UPDATE;

  IF NOT EXISTS (SELECT 1 FROM public.cart_items WHERE user_id = uid) THEN
    RAISE EXCEPTION 'CART_EMPTY';
  END IF;

  FOR line IN
    SELECT ci.product_id, ci.quantity, p.name, p.slug, p.price_cents, p.currency,
           p.stock_quantity, p.is_active
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.user_id = uid
  LOOP
    IF NOT line.is_active THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%', line.name;
    END IF;
    IF line.quantity < 1 OR line.quantity > line.stock_quantity THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%', line.name;
    END IF;
    subtotal := subtotal + (line.price_cents * line.quantity);
  END LOOP;

  shipping := CASE WHEN subtotal >= 7500 THEN 0 ELSE 795 END;
  tax := round(subtotal * 0.085);
  total := subtotal + shipping + tax;

  INSERT INTO public.orders (user_id, status, subtotal_cents, shipping_cents, tax_cents,
                             total_cents, currency, shipping_address_snapshot)
  VALUES (uid, 'pending', subtotal, shipping, tax, total, 'USD',
          jsonb_build_object(
            'label', addr.label, 'recipientName', addr.recipient_name,
            'line1', addr.line1, 'line2', addr.line2, 'city', addr.city,
            'state', addr.state, 'postalCode', addr.postal_code,
            'country', addr.country, 'phone', addr.phone))
  RETURNING * INTO new_order;

  INSERT INTO public.order_items (order_id, product_id, product_name_snapshot,
                                  product_slug_snapshot, unit_price_cents, quantity, line_total_cents)
  SELECT new_order.id, p.id, p.name, p.slug, p.price_cents, ci.quantity, p.price_cents * ci.quantity
  FROM public.cart_items ci JOIN public.products p ON p.id = ci.product_id
  WHERE ci.user_id = uid;

  reference := 'MOCK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  pay_status := CASE WHEN _payment_method = 'test_success' THEN 'succeeded' ELSE 'failed' END;

  INSERT INTO public.payments (order_id, status, amount_cents, currency, provider, provider_reference)
  VALUES (new_order.id, pay_status, total, 'USD', 'acme_mock', reference);

  IF pay_status = 'succeeded' THEN
    UPDATE public.products p
      SET stock_quantity = p.stock_quantity - ci.quantity
      FROM public.cart_items ci
      WHERE ci.user_id = uid AND p.id = ci.product_id;
    DELETE FROM public.cart_items WHERE user_id = uid;
    UPDATE public.orders SET status = 'paid' WHERE id = new_order.id;
  ELSE
    UPDATE public.orders SET status = 'cancelled' WHERE id = new_order.id;
  END IF;

  RETURN jsonb_build_object(
    'orderId', new_order.id,
    'orderNumber', new_order.order_number,
    'orderStatus', CASE WHEN pay_status = 'succeeded' THEN 'paid' ELSE 'cancelled' END,
    'paymentStatus', pay_status,
    'providerReference', reference,
    'totalCents', total);
END;
$$;
REVOKE ALL ON FUNCTION public.place_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ord public.orders%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO ord FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF ord.user_id <> uid AND NOT public.is_catalog_manager(uid) THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF ord.status NOT IN ('pending','paid','processing') THEN
    RAISE EXCEPTION 'NOT_CANCELLABLE';
  END IF;

  IF ord.status IN ('paid','processing') THEN
    UPDATE public.products p
      SET stock_quantity = p.stock_quantity + oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = ord.id AND p.id = oi.product_id;
  END IF;

  UPDATE public.orders SET status = 'cancelled' WHERE id = ord.id;
  RETURN jsonb_build_object('orderId', ord.id, 'status', 'cancelled');
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;