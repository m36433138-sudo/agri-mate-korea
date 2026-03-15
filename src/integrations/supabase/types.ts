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
      customers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          created_at: string
          customer_id: string | null
          entry_date: string
          id: string
          machine_type: string
          model_name: string
          notes: string | null
          purchase_price: number
          sale_date: string | null
          sale_price: number | null
          serial_number: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          entry_date: string
          id?: string
          machine_type: string
          model_name: string
          notes?: string | null
          purchase_price: number
          sale_date?: string | null
          sale_price?: number | null
          serial_number: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          entry_date?: string
          id?: string
          machine_type?: string
          model_name?: string
          notes?: string | null
          purchase_price?: number
          sale_date?: string | null
          sale_price?: number | null
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
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      repair_history: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          machine_id: string
          parts_used: string | null
          repair_content: string
          repair_date: string
          technician: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          machine_id: string
          parts_used?: string | null
          repair_content: string
          repair_date: string
          technician?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          machine_id?: string
          parts_used?: string | null
          repair_content?: string
          repair_date?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
