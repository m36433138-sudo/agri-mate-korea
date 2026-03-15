-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update all existing tables RLS: replace public policies with authenticated-only
DROP POLICY IF EXISTS "Allow all access to customers" ON public.customers;
CREATE POLICY "Authenticated access to customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to machines" ON public.machines;
CREATE POLICY "Authenticated access to machines" ON public.machines FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to parts" ON public.parts;
CREATE POLICY "Authenticated access to parts" ON public.parts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to repairs" ON public.repairs;
CREATE POLICY "Authenticated access to repairs" ON public.repairs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to repair_parts" ON public.repair_parts;
CREATE POLICY "Authenticated access to repair_parts" ON public.repair_parts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to repair_history" ON public.repair_history;
CREATE POLICY "Authenticated access to repair_history" ON public.repair_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to repair_templates" ON public.repair_templates;
CREATE POLICY "Authenticated access to repair_templates" ON public.repair_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to repair_template_items" ON public.repair_template_items;
CREATE POLICY "Authenticated access to repair_template_items" ON public.repair_template_items FOR ALL TO authenticated USING (true) WITH CHECK (true);