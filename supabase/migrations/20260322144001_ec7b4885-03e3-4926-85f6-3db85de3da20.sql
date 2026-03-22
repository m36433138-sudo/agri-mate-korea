
-- Add branch column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch VARCHAR(10) DEFAULT '장흥';

-- Inventory table (장흥/강진 구분)
CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch VARCHAR(10) NOT NULL DEFAULT '장흥',
    part_code VARCHAR(100) NOT NULL,
    part_name VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 0,
    purchase_price INTEGER,
    sales_price INTEGER,
    location_main VARCHAR(100),
    location_sub VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(branch, part_code)
);

-- Repair logs table (기사 정비 기록)
CREATE TABLE public.repair_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id),
    machine_id UUID REFERENCES public.machines(id),
    mechanic_name VARCHAR(50) NOT NULL,
    operating_hours INTEGER,
    repair_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    branch VARCHAR(10) DEFAULT '장흥',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Repair log parts (정비에 사용된 부품)
CREATE TABLE public.repair_log_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repair_log_id UUID REFERENCES public.repair_logs(id) ON DELETE CASCADE NOT NULL,
    part_code VARCHAR(100) NOT NULL,
    quantity_used INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_log_parts ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory
CREATE POLICY "Admin/employee access inventory" ON public.inventory
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

-- RLS policies for repair_logs
CREATE POLICY "Admin/employee access repair_logs" ON public.repair_logs
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

-- Customer can view own repair_logs
CREATE POLICY "Customer view own repair_logs" ON public.repair_logs
FOR SELECT TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

-- RLS policies for repair_log_parts
CREATE POLICY "Admin/employee access repair_log_parts" ON public.repair_log_parts
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

-- Trigger function: auto-deduct inventory on repair_log_parts insert
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_repair_part()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _branch VARCHAR(10);
BEGIN
  -- Get the branch from the repair_log's mechanic profile or repair_log branch
  SELECT branch INTO _branch FROM public.repair_logs WHERE id = NEW.repair_log_id;
  
  -- Deduct inventory
  UPDATE public.inventory
  SET quantity = quantity - NEW.quantity_used
  WHERE part_code = NEW.part_code
    AND branch = COALESCE(_branch, '장흥');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deduct_inventory
AFTER INSERT ON public.repair_log_parts
FOR EACH ROW
EXECUTE FUNCTION public.deduct_inventory_on_repair_part();

-- Enable realtime for repair_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.repair_logs;
