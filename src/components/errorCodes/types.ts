export type ErrorCodeLogRow = {
  id: string;
  repair_id: string;
  error_code: string;
  symptom: string | null;
  action_taken: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
  photo_paths: string[];
  repairs: {
    id: string;
    repair_date: string;
    technician: string | null;
    repair_content: string | null;
    machines: {
      id: string;
      model_name: string;
      serial_number: string;
      customer_id: string | null;
      customers: { name: string } | null;
    } | null;
  } | null;
};
