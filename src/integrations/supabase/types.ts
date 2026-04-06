export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      customer_drive_links: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          label: string
          url: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          label: string
          url: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          label?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_drive_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          branch: string | null
          created_at: string
          id: string
          legacy_code: string | null
          name: string
          notes: string | null
          phone: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          branch?: string | null
          created_at?: string
          id?: string
          legacy_code?: string | null
          name: string
          notes?: string | null
          phone: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          branch?: string | null
          created_at?: string
          id?: string
          legacy_code?: string | null
          name?: string
          notes?: string | null
          phone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      employee_permissions: {
        Row: {
          employee_id: string
          id: string
          is_allowed: boolean
          permission_key: string
        }
        Insert: {
          employee_id: string
          id?: string
          is_allowed?: boolean
          permission_key: string
        }
        Update: {
          employee_id?: string
          id?: string
          is_allowed?: boolean
          permission_key?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          join_date: string | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          resident_number: string | null
          salary: number | null
          team: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          join_date?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          resident_number?: string | null
          salary?: number | null
          team?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          join_date?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          resident_number?: string | null
          salary?: number | null
          team?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          alt_part_code: string | null
          branch: string
          created_at: string
          id: string
          location_main: string | null
          location_sub: string | null
          min_stock: number | null
          part_code: string
          part_name: string
          purchase_price: number | null
          quantity: number | null
          sales_price: number | null
        }
        Insert: {
          alt_part_code?: string | null
          branch?: string
          created_at?: string
          id?: string
          location_main?: string | null
          location_sub?: string | null
          min_stock?: number | null
          part_code: string
          part_name: string
          purchase_price?: number | null
          quantity?: number | null
          sales_price?: number | null
        }
        Update: {
          alt_part_code?: string | null
          branch?: string
          created_at?: string
          id?: string
          location_main?: string | null
          location_sub?: string | null
          min_stock?: number | null
          part_code?: string
          part_name?: string
          purchase_price?: number | null
          quantity?: number | null
          sales_price?: number | null
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          adjusted_by: string | null
          adjustment_qty: number
          branch: string
          created_at: string
          id: string
          new_qty: number
          part_code: string
          part_name: string
          previous_qty: number
          reason: string | null
        }
        Insert: {
          adjusted_by?: string | null
          adjustment_qty?: number
          branch?: string
          created_at?: string
          id?: string
          new_qty?: number
          part_code: string
          part_name: string
          previous_qty?: number
          reason?: string | null
        }
        Update: {
          adjusted_by?: string | null
          adjustment_qty?: number
          branch?: string
          created_at?: string
          id?: string
          new_qty?: number
          part_code?: string
          part_name?: string
          previous_qty?: number
          reason?: string | null
        }
        Relationships: []
      }
      machine_attachments: {
        Row: {
          created_at: string | null
          id: string
          machine_id: string
          model: string | null
          name: string
          notes: string | null
          serial_number: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          machine_id: string
          model?: string | null
          name: string
          notes?: string | null
          serial_number?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          machine_id?: string
          model?: string | null
          name?: string
          notes?: string | null
          serial_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_attachments_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          classification: string | null
          created_at: string
          customer_id: string | null
          engine_number: string | null
          entry_date: string
          id: string
          machine_type: string
          manufacturer: string | null
          model_name: string
          notes: string | null
          purchase_price: number
          sale_date: string | null
          sale_price: number | null
          salesperson: string | null
          serial_number: string
          status: string
        }
        Insert: {
          classification?: string | null
          created_at?: string
          customer_id?: string | null
          engine_number?: string | null
          entry_date: string
          id?: string
          machine_type: string
          manufacturer?: string | null
          model_name: string
          notes?: string | null
          purchase_price: number
          sale_date?: string | null
          sale_price?: number | null
          salesperson?: string | null
          serial_number: string
          status?: string
        }
        Update: {
          classification?: string | null
          created_at?: string
          customer_id?: string | null
          engine_number?: string | null
          entry_date?: string
          id?: string
          machine_type?: string
          manufacturer?: string | null
          model_name?: string
          notes?: string | null
          purchase_price?: number
          sale_date?: string | null
          sale_price?: number | null
          salesperson?: string | null
          serial_number?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_repair_draft_parts: {
        Row: {
          created_at: string | null
          draft_id: string
          id: string
          part_code: string | null
          part_name: string
          quantity: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          draft_id: string
          id?: string
          part_code?: string | null
          part_name: string
          quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          draft_id?: string
          id?: string
          part_code?: string | null
          part_name?: string
          quantity?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operation_repair_draft_parts_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "operation_repair_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_repair_drafts: {
        Row: {
          branch: string
          created_at: string | null
          customer_name: string | null
          description: string | null
          id: string
          is_finalized: boolean | null
          labor_cost: number | null
          machine_type: string | null
          model: string | null
          operating_hours: number | null
          row_index: number
          technician: string | null
          updated_at: string | null
        }
        Insert: {
          branch: string
          created_at?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          is_finalized?: boolean | null
          labor_cost?: number | null
          machine_type?: string | null
          model?: string | null
          operating_hours?: number | null
          row_index: number
          technician?: string | null
          updated_at?: string | null
        }
        Update: {
          branch?: string
          created_at?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          is_finalized?: boolean | null
          labor_cost?: number | null
          machine_type?: string | null
          model?: string | null
          operating_hours?: number | null
          row_index?: number
          technician?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      parts: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          part_name: string
          part_number: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          part_name: string
          part_number: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          part_name?: string
          part_number?: string
          unit?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          branch: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          memo: string | null
          phone: string | null
          team: string | null
        }
        Insert: {
          branch?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          memo?: string | null
          phone?: string | null
          team?: string | null
        }
        Update: {
          branch?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          memo?: string | null
          phone?: string | null
          team?: string | null
        }
        Relationships: []
      }
      repair_history: {
        Row: {
          cost: number | null
          cost_labor: number | null
          cost_parts: number | null
          created_at: string
          customer_id: string | null
          id: string
          machine_id: string
          parts_used: string | null
          repair_content: string
          repair_date: string
          repair_type: string | null
          technician: string | null
        }
        Insert: {
          cost?: number | null
          cost_labor?: number | null
          cost_parts?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          machine_id: string
          parts_used?: string | null
          repair_content: string
          repair_date: string
          repair_type?: string | null
          technician?: string | null
        }
        Update: {
          cost?: number | null
          cost_labor?: number | null
          cost_parts?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          machine_id?: string
          parts_used?: string | null
          repair_content?: string
          repair_date?: string
          repair_type?: string | null
          technician?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_history_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_log_parts: {
        Row: {
          created_at: string
          id: string
          part_code: string
          quantity_used: number
          repair_log_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          part_code: string
          quantity_used?: number
          repair_log_id: string
        }
        Update: {
          created_at?: string
          id?: string
          part_code?: string
          quantity_used?: number
          repair_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_log_parts_repair_log_id_fkey"
            columns: ["repair_log_id"]
            isOneToOne: false
            referencedRelation: "repair_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_logs: {
        Row: {
          branch: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          id: string
          machine_id: string | null
          mechanic_name: string
          operating_hours: number | null
          repair_date: string | null
        }
        Insert: {
          branch?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          machine_id?: string | null
          mechanic_name: string
          operating_hours?: number | null
          repair_date?: string | null
        }
        Update: {
          branch?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          machine_id?: string | null
          mechanic_name?: string
          operating_hours?: number | null
          repair_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_notes: {
        Row: {
          branch: string
          content: string
          created_at: string
          done_at: string | null
          id: string
          is_done: boolean
          row_index: number
        }
        Insert: {
          branch: string
          content: string
          created_at?: string
          done_at?: string | null
          id?: string
          is_done?: boolean
          row_index: number
        }
        Update: {
          branch?: string
          content?: string
          created_at?: string
          done_at?: string | null
          id?: string
          is_done?: boolean
          row_index?: number
        }
        Relationships: []
      }
      repair_parts: {
        Row: {
          id: string
          notes: string | null
          part_id: string
          quantity: number
          repair_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          part_id: string
          quantity?: number
          repair_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          part_id?: string
          quantity?: number
          repair_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_parts_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_template_items: {
        Row: {
          id: string
          notes: string | null
          part_id: string
          quantity: number
          template_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          part_id: string
          quantity?: number
          template_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          part_id?: string
          quantity?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_template_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "repair_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          template_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          template_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          template_name?: string
        }
        Relationships: []
      }
      repairs: {
        Row: {
          created_at: string
          id: string
          labor_cost: number | null
          machine_id: string
          notes: string | null
          operating_hours: number | null
          repair_content: string
          repair_date: string
          technician: string | null
          total_cost: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          labor_cost?: number | null
          machine_id: string
          notes?: string | null
          operating_hours?: number | null
          repair_content: string
          repair_date: string
          technician?: string | null
          total_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          labor_cost?: number | null
          machine_id?: string
          notes?: string | null
          operating_hours?: number | null
          repair_content?: string
          repair_date?: string
          technician?: string | null
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "repairs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee" | "customer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "employee", "customer"],
    },
  },
} as const
