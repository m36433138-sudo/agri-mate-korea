/**
 * Type-safe database model aliases using Supabase generated types.
 * Import these instead of manually defining interfaces.
 */
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ── Row types (SELECT) ──
export type Machine = Tables<"machines">;
export type Customer = Tables<"customers">;
export type Part = Tables<"parts">;
export type Repair = Tables<"repairs">;
export type RepairPart = Tables<"repair_parts">;
export type RepairTemplate = Tables<"repair_templates">;
export type RepairTemplateItem = Tables<"repair_template_items">;
export type RepairHistory = Tables<"repair_history">;
export type Profile = Tables<"profiles">;
export type UserRole = Tables<"user_roles">;
export type EmployeePermission = Tables<"employee_permissions">;

// ── Insert types ──
export type MachineInsert = TablesInsert<"machines">;
export type CustomerInsert = TablesInsert<"customers">;
export type PartInsert = TablesInsert<"parts">;
export type RepairInsert = TablesInsert<"repairs">;
export type RepairPartInsert = TablesInsert<"repair_parts">;

// ── Update types ──
export type MachineUpdate = TablesUpdate<"machines">;
export type CustomerUpdate = TablesUpdate<"customers">;
export type PartUpdate = TablesUpdate<"parts">;
export type RepairUpdate = TablesUpdate<"repairs">;

// ── Joined / extended types for common queries ──
export type MachineWithCustomer = Machine & {
  customers: { name: string } | null;
};

export type RepairWithMachine = Repair & {
  machines: { id: string; model_name: string; serial_number: string } | null;
};
