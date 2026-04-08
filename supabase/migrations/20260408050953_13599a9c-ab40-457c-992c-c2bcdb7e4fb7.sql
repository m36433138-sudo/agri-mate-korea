
CREATE TABLE public.technician_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('clock_in', 'clock_out')),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.technician_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee access technician_locations"
  ON public.technician_locations
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

CREATE INDEX idx_technician_locations_name_created
  ON public.technician_locations (technician_name, created_at DESC);
