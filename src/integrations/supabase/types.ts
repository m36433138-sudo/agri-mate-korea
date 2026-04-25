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
      assets_equipment: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: string
          vendor: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string
          vendor?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string
          vendor?: string | null
        }
        Relationships: []
      }
      assets_properties: {
        Row: {
          address: string | null
          area: number | null
          area_unit: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          property_type: string
          purchase_date: string | null
          purchase_price: number | null
        }
        Insert: {
          address?: string | null
          area?: number | null
          area_unit?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          property_type?: string
          purchase_date?: string | null
          purchase_price?: number | null
        }
        Update: {
          address?: string | null
          area?: number | null
          area_unit?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          property_type?: string
          purchase_date?: string | null
          purchase_price?: number | null
        }
        Relationships: []
      }
      assets_vehicle_maintenance: {
        Row: {
          cost: number | null
          created_at: string
          date: string
          id: string
          maintenance_type: string
          mileage: number | null
          notes: string | null
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          date: string
          id?: string
          maintenance_type: string
          mileage?: number | null
          notes?: string | null
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          date?: string
          id?: string
          maintenance_type?: string
          mileage?: number | null
          notes?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "assets_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets_vehicles: {
        Row: {
          created_at: string
          current_mileage: number | null
          id: string
          name: string
          notes: string | null
          plate_number: string | null
          purchase_date: string | null
          purchase_price: number | null
          status: string
        }
        Insert: {
          created_at?: string
          current_mileage?: number | null
          id?: string
          name: string
          notes?: string | null
          plate_number?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          current_mileage?: number | null
          id?: string
          name?: string
          notes?: string | null
          plate_number?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          status?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          afternoon_ot_minutes: number
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          is_holiday: boolean
          is_modified: boolean
          is_settled: boolean
          latitude_in: number | null
          latitude_out: number | null
          longitude_in: number | null
          longitude_out: number | null
          modification_reason: string | null
          morning_ot_minutes: number
          overtime_minutes: number
          updated_at: string
        }
        Insert: {
          afternoon_ot_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          is_holiday?: boolean
          is_modified?: boolean
          is_settled?: boolean
          latitude_in?: number | null
          latitude_out?: number | null
          longitude_in?: number | null
          longitude_out?: number | null
          modification_reason?: string | null
          morning_ot_minutes?: number
          overtime_minutes?: number
          updated_at?: string
        }
        Update: {
          afternoon_ot_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          is_holiday?: boolean
          is_modified?: boolean
          is_settled?: boolean
          latitude_in?: number | null
          latitude_out?: number | null
          longitude_in?: number | null
          longitude_out?: number | null
          modification_reason?: string | null
          morning_ot_minutes?: number
          overtime_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
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
          grade: string | null
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
          grade?: string | null
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
          grade?: string | null
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
          is_active: boolean
          join_date: string | null
          name: string
          notes: string | null
          overtime_hourly_rate: number | null
          phone: string | null
          position: string | null
          resident_number: string | null
          resigned_at: string | null
          salary: number | null
          team: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          join_date?: string | null
          name: string
          notes?: string | null
          overtime_hourly_rate?: number | null
          phone?: string | null
          position?: string | null
          resident_number?: string | null
          resigned_at?: string | null
          salary?: number | null
          team?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          join_date?: string | null
          name?: string
          notes?: string | null
          overtime_hourly_rate?: number | null
          phone?: string | null
          position?: string | null
          resident_number?: string | null
          resigned_at?: string | null
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
          ecu_hp: number | null
          ecu_mapped: boolean | null
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
          ecu_hp?: number | null
          ecu_mapped?: boolean | null
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
          ecu_hp?: number | null
          ecu_mapped?: boolean | null
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
      operation_rows: {
        Row: {
          address: string | null
          branch: string
          contact_note: string | null
          contacted: string | null
          created_at: string
          customer_name: string | null
          dispatch_date: string | null
          entry_date: string | null
          id: string
          is_completed: boolean
          location: string | null
          machine: string | null
          model: string | null
          notes: string | null
          phone: string | null
          priority: string
          repair_done_date: string | null
          repair_start_date: string | null
          requirements: string | null
          row_index: number
          serial_number: string | null
          source_tab: string
          status_label: string | null
          technician: string | null
          updated_at: string
          writer: string | null
        }
        Insert: {
          address?: string | null
          branch: string
          contact_note?: string | null
          contacted?: string | null
          created_at?: string
          customer_name?: string | null
          dispatch_date?: string | null
          entry_date?: string | null
          id?: string
          is_completed?: boolean
          location?: string | null
          machine?: string | null
          model?: string | null
          notes?: string | null
          phone?: string | null
          priority?: string
          repair_done_date?: string | null
          repair_start_date?: string | null
          requirements?: string | null
          row_index: number
          serial_number?: string | null
          source_tab?: string
          status_label?: string | null
          technician?: string | null
          updated_at?: string
          writer?: string | null
        }
        Update: {
          address?: string | null
          branch?: string
          contact_note?: string | null
          contacted?: string | null
          created_at?: string
          customer_name?: string | null
          dispatch_date?: string | null
          entry_date?: string | null
          id?: string
          is_completed?: boolean
          location?: string | null
          machine?: string | null
          model?: string | null
          notes?: string | null
          phone?: string | null
          priority?: string
          repair_done_date?: string | null
          repair_start_date?: string | null
          requirements?: string | null
          row_index?: number
          serial_number?: string | null
          source_tab?: string
          status_label?: string | null
          technician?: string | null
          updated_at?: string
          writer?: string | null
        }
        Relationships: []
      }
      overtime_settlements: {
        Row: {
          bonus_amount: number
          created_at: string
          employee_id: string
          hourly_rate: number
          id: string
          notes: string | null
          period_end: string
          period_start: string
          settled_by: string | null
          total_overtime_minutes: number
          total_payment: number
        }
        Insert: {
          bonus_amount?: number
          created_at?: string
          employee_id: string
          hourly_rate?: number
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          settled_by?: string | null
          total_overtime_minutes?: number
          total_payment?: number
        }
        Update: {
          bonus_amount?: number
          created_at?: string
          employee_id?: string
          hourly_rate?: number
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          settled_by?: string | null
          total_overtime_minutes?: number
          total_payment?: number
        }
        Relationships: [
          {
            foreignKeyName: "overtime_settlements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      sheet_assignments: {
        Row: {
          assigned_at: string
          branch: string
          customer_name: string | null
          employee_id: string | null
          employee_name: string
          id: string
          machine_type: string | null
          model: string | null
          row_index: number
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          branch: string
          customer_name?: string | null
          employee_id?: string | null
          employee_name: string
          id?: string
          machine_type?: string | null
          model?: string | null
          row_index: number
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          branch?: string
          customer_name?: string | null
          employee_id?: string | null
          employee_name?: string
          id?: string
          machine_type?: string | null
          model?: string | null
          row_index?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          related_customer_id: string | null
          related_machine_id: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_customer_id?: string | null
          related_machine_id?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_customer_id?: string | null
          related_machine_id?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_related_customer_id_fkey"
            columns: ["related_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_machine_id_fkey"
            columns: ["related_machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_locations: {
        Row: {
          accuracy: number | null
          action: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          technician_name: string
        }
        Insert: {
          accuracy?: number | null
          action: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          technician_name: string
        }
        Update: {
          accuracy?: number | null
          action?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          technician_name?: string
        }
        Relationships: []
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
      vendors: {
        Row: {
          business_number: string | null
          created_at: string
          id: string
          items: string | null
          name: string
          notes: string | null
          phone: string | null
          representative: string | null
        }
        Insert: {
          business_number?: string | null
          created_at?: string
          id?: string
          items?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          representative?: string | null
        }
        Update: {
          business_number?: string | null
          created_at?: string
          id?: string
          items?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          representative?: string | null
        }
        Relationships: []
      }
      visit_repair_rows: {
        Row: {
          address: string | null
          cost: number | null
          created_at: string
          customer_name: string | null
          id: string
          is_completed: boolean
          machine: string | null
          model: string | null
          notes: string | null
          parts_used: string | null
          phone: string | null
          priority: string
          requirements: string | null
          row_index: number
          serial_number: string | null
          status_label: string | null
          technician: string | null
          updated_at: string
          visit_date: string | null
          writer: string | null
        }
        Insert: {
          address?: string | null
          cost?: number | null
          created_at?: string
          customer_name?: string | null
          id?: string
          is_completed?: boolean
          machine?: string | null
          model?: string | null
          notes?: string | null
          parts_used?: string | null
          phone?: string | null
          priority?: string
          requirements?: string | null
          row_index: number
          serial_number?: string | null
          status_label?: string | null
          technician?: string | null
          updated_at?: string
          visit_date?: string | null
          writer?: string | null
        }
        Update: {
          address?: string | null
          cost?: number | null
          created_at?: string
          customer_name?: string | null
          id?: string
          is_completed?: boolean
          machine?: string | null
          model?: string | null
          notes?: string | null
          parts_used?: string | null
          phone?: string | null
          priority?: string
          requirements?: string | null
          row_index?: number
          serial_number?: string | null
          status_label?: string | null
          technician?: string | null
          updated_at?: string
          visit_date?: string | null
          writer?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_employee_branch: { Args: { _user_id: string }; Returns: string }
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
