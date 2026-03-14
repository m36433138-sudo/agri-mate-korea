
-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create machines table
CREATE TABLE public.machines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name TEXT NOT NULL,
  serial_number TEXT NOT NULL UNIQUE,
  machine_type TEXT NOT NULL CHECK (machine_type IN ('새기계', '중고기계')),
  status TEXT NOT NULL DEFAULT '재고중' CHECK (status IN ('재고중', '판매완료')),
  entry_date DATE NOT NULL,
  purchase_price INTEGER NOT NULL,
  sale_price INTEGER,
  sale_date DATE,
  customer_id UUID REFERENCES public.customers(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create repair_history table
CREATE TABLE public.repair_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  repair_date DATE NOT NULL,
  repair_content TEXT NOT NULL,
  parts_used TEXT,
  cost INTEGER,
  technician TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_history ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for all tables (no auth required for this admin tool)
CREATE POLICY "Allow all access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to machines" ON public.machines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to repair_history" ON public.repair_history FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_machines_status ON public.machines(status);
CREATE INDEX idx_machines_machine_type ON public.machines(machine_type);
CREATE INDEX idx_machines_serial_number ON public.machines(serial_number);
CREATE INDEX idx_machines_customer_id ON public.machines(customer_id);
CREATE INDEX idx_repair_history_machine_id ON public.repair_history(machine_id);
CREATE INDEX idx_repair_history_repair_date ON public.repair_history(repair_date);
