-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.repairs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;