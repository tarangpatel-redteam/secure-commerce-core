-- ROLES ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('customer', 'employee', 'manager', 'administrator');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('employee', 'manager', 'administrator')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_catalog_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('manager', 'administrator')
  );
$$;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrator'));

-- CATALOGUE -----------------------------------------------------------
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories_manage" ON public.categories FOR ALL TO authenticated
  USING (public.is_catalog_manager(auth.uid())) WITH CHECK (public.is_catalog_manager(auth.uid()));

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sku TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'ACME',
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  image_url TEXT,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  review_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON public.products(category_id);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read" ON public.products FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "products_staff_read" ON public.products FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "products_manage" ON public.products FOR ALL TO authenticated
  USING (public.is_catalog_manager(auth.uid())) WITH CHECK (public.is_catalog_manager(auth.uid()));

CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX cart_items_user_idx ON public.cart_items(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_items_own" ON public.cart_items FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- TIMESTAMPS ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cart_items_set_updated_at BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NEW USER BOOTSTRAP --------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SEED CATALOGUE ------------------------------------------------------
INSERT INTO public.categories (id, slug, name, description) VALUES
  ('11111111-1111-4111-8111-000000000001', 'audio', 'Audio', 'Headphones, speakers and everything that sounds good.'),
  ('11111111-1111-4111-8111-000000000002', 'workspace', 'Workspace', 'Desk gear that makes long days easier.'),
  ('11111111-1111-4111-8111-000000000003', 'mobility', 'Mobility', 'Bags, chargers and travel-ready essentials.'),
  ('11111111-1111-4111-8111-000000000004', 'home', 'Smart Home', 'Quietly useful hardware for the home.');

INSERT INTO public.products (category_id, sku, slug, name, brand, short_description, description, price_cents, stock_quantity, rating, review_count, is_featured) VALUES
  ('11111111-1111-4111-8111-000000000001','ACM-AUD-001','aurora-over-ear-headphones','Aurora Over-Ear Headphones','ACME Audio','Adaptive noise cancelling with 40-hour battery.','Aurora pairs a hand-tuned 40mm driver with adaptive noise cancelling that adjusts to the room around you. Memory-foam earcups, USB-C fast charge and 40 hours of playback make it a natural commuting companion.',29900,42,4.7,318,true),
  ('11111111-1111-4111-8111-000000000001','ACM-AUD-002','pebble-portable-speaker','Pebble Portable Speaker','ACME Audio','Pocket-sized speaker with surprising low end.','A palm-sized speaker with a passive radiator that punches far above its size. IP67 rated, 18 hours of playback and a braided lanyard for clipping onto a bag.',8900,120,4.4,204,false),
  ('11111111-1111-4111-8111-000000000001','ACM-AUD-003','echoline-wireless-earbuds','Echoline Wireless Earbuds','ACME Audio','Featherweight earbuds with transparency mode.','Echoline weighs 4.1g per bud and disappears in the ear. Transparency mode, multipoint pairing and a charging case that adds three extra full charges.',14900,88,4.5,412,true),
  ('11111111-1111-4111-8111-000000000002','ACM-WRK-001','meridian-standing-desk','Meridian Standing Desk','ACME Works','Dual-motor sit-stand desk with memory presets.','A dual-motor frame that moves from 62cm to 128cm in near silence, with four memory presets and a bamboo top finished with a low-sheen hardwax oil.',64900,17,4.8,96,true),
  ('11111111-1111-4111-8111-000000000002','ACM-WRK-002','orbit-ergonomic-mouse','Orbit Ergonomic Mouse','ACME Works','Vertical grip mouse tuned for long sessions.','A 57-degree vertical grip that keeps the forearm neutral, with a silent primary switch rated for 20 million clicks and two months per charge.',7900,210,4.3,540,false),
  ('11111111-1111-4111-8111-000000000002','ACM-WRK-003','lumen-desk-lamp','Lumen Desk Lamp','ACME Works','Wide asymmetric light with no glare on screens.','Lumen throws an even 60cm pool of light across a desk without bouncing glare into a monitor. Stepless dimming from 2700K to 5000K and a weighted matte base.',12900,64,4.6,151,false),
  ('11111111-1111-4111-8111-000000000003','ACM-MOB-001','transit-commuter-backpack','Transit Commuter Backpack','ACME Field','22L weatherproof pack with a laid-flat laptop bay.','Recycled 600D shell with a fully taped waterproof zip, a suspended 16-inch laptop bay and a side access pocket that reaches the main compartment without unpacking.',18900,73,4.6,289,true),
  ('11111111-1111-4111-8111-000000000003','ACM-MOB-002','voltcore-65w-charger','Voltcore 65W GaN Charger','ACME Field','Three ports, one very small brick.','GaN III internals keep this 65W charger smaller than a deck of cards. Two USB-C ports and one USB-A share power intelligently across a laptop, phone and watch.',5900,300,4.7,733,false),
  ('11111111-1111-4111-8111-000000000003','ACM-MOB-003','trailmark-travel-organiser','Trailmark Travel Organiser','ACME Field','Cable and passport organiser that lies flat.','Ripstop organiser with elastic loops, two zip meshes and a passport sleeve. Opens completely flat so nothing hides behind a flap.',4900,155,4.2,118,false),
  ('11111111-1111-4111-8111-000000000004','ACM-HOM-001','hearth-smart-thermostat','Hearth Smart Thermostat','ACME Home','Learns a schedule in about a week.','Hearth watches how a home actually warms up and builds a schedule around it. Local control keeps the heating running even when the network is down.',21900,38,4.5,167,true),
  ('11111111-1111-4111-8111-000000000004','ACM-HOM-002','halo-motion-sensor','Halo Motion Sensor','ACME Home','Tiny sensor with a two-year battery.','A 32mm sensor with a 120-degree field of view and lux reporting, so lights only trigger when it is actually dark. Two-year coin cell.',3900,420,4.1,96,false),
  ('11111111-1111-4111-8111-000000000004','ACM-HOM-003','still-air-purifier','Still Air Purifier','ACME Home','HEPA-13 filtration at 24dB on low.','Still moves 350 m3/h through a HEPA-13 and carbon stack while staying quieter than a whisper on its low setting. Filter life is tracked by run hours, not a timer.',34900,26,4.6,205,false);