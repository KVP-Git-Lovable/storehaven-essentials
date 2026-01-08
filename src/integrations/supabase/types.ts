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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          asset_number: string | null
          category: string
          category_id: string | null
          condition: string
          created_at: string
          id: string
          location: string
          name: string
          oem_id: string | null
          purchase_date: string
          updated_at: string
          value: number
          vendor_id: string | null
        }
        Insert: {
          asset_number?: string | null
          category: string
          category_id?: string | null
          condition: string
          created_at?: string
          id?: string
          location: string
          name: string
          oem_id?: string | null
          purchase_date: string
          updated_at?: string
          value: number
          vendor_id?: string | null
        }
        Update: {
          asset_number?: string | null
          category?: string
          category_id?: string | null
          condition?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          oem_id?: string | null
          purchase_date?: string
          updated_at?: string
          value?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_oem_id_fkey"
            columns: ["oem_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          department: string
          email: string
          id: string
          join_date: string
          name: string
          phone: string
          position: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department: string
          email: string
          id?: string
          join_date: string
          name: string
          phone: string
          position: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          email?: string
          id?: string
          join_date?: string
          name?: string
          phone?: string
          position?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          status: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          description: string
          id?: string
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      incidents: {
        Row: {
          created_at: string
          description: string
          id: string
          location: string
          priority: string
          reported_by: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          location: string
          priority: string
          reported_by: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          location?: string
          priority?: string
          reported_by?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_tasks: {
        Row: {
          asset: string
          assigned_to: string
          created_at: string
          frequency: string
          id: string
          last_done: string
          next_due: string
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          asset: string
          assigned_to: string
          created_at?: string
          frequency: string
          id?: string
          last_done: string
          next_due: string
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          asset?: string
          assigned_to?: string
          created_at?: string
          frequency?: string
          id?: string
          last_done?: string
          next_due?: string
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      meter_masters: {
        Row: {
          created_at: string
          created_by: string
          details_to_capture: string
          id: string
          last_modified_at: string
          last_modified_by: string
          name: string
          reading_parameter_count: number
          reading_parameters: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string
          details_to_capture?: string
          id?: string
          last_modified_at?: string
          last_modified_by?: string
          name: string
          reading_parameter_count?: number
          reading_parameters?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string
          details_to_capture?: string
          id?: string
          last_modified_at?: string
          last_modified_by?: string
          name?: string
          reading_parameter_count?: number
          reading_parameters?: string[]
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string
          category: string
          created_at: string
          id: string
          model: string
          name: string
          price: number
          updated_at: string
          warranty: string
        }
        Insert: {
          brand: string
          category: string
          created_at?: string
          id?: string
          model: string
          name: string
          price: number
          updated_at?: string
          warranty: string
        }
        Update: {
          brand?: string
          category?: string
          created_at?: string
          id?: string
          model?: string
          name?: string
          price?: number
          updated_at?: string
          warranty?: string
        }
        Relationships: []
      }
      rentals: {
        Row: {
          created_at: string
          end_date: string
          id: string
          landlord: string
          rent: number
          start_date: string
          status: string
          store: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          landlord: string
          rent: number
          start_date: string
          status?: string
          store: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          landlord?: string
          rent?: number
          start_date?: string
          status?: string
          store?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_contracts: {
        Row: {
          created_at: string
          end_date: string
          id: string
          service_type: string
          start_date: string
          status: string
          updated_at: string
          value: number
          vendor: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          service_type: string
          start_date: string
          status?: string
          updated_at?: string
          value: number
          vendor: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          service_type?: string
          start_date?: string
          status?: string
          updated_at?: string
          value?: number
          vendor?: string
        }
        Relationships: []
      }
      spares: {
        Row: {
          category: string
          created_at: string
          id: string
          min_stock: number
          name: string
          quantity: number
          supplier: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          quantity?: number
          supplier: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          quantity?: number
          supplier?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string
          assets: number
          created_at: string
          id: string
          manager: string
          name: string
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          address: string
          assets?: number
          created_at?: string
          id?: string
          manager: string
          name: string
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          assets?: number
          created_at?: string
          id?: string
          manager?: string
          name?: string
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      utility_readings: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_modified_at: string
          last_modified_by: string
          meter_master_id: string
          reading_date: string
          readings: Json
          store: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          last_modified_at?: string
          last_modified_by?: string
          meter_master_id: string
          reading_date: string
          readings?: Json
          store: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_modified_at?: string
          last_modified_by?: string
          meter_master_id?: string
          reading_date?: string
          readings?: Json
          store?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_readings_meter_master_id_fkey"
            columns: ["meter_master_id"]
            isOneToOne: false
            referencedRelation: "meter_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          category: string
          contact_person: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          status: string
          updated_at: string
          vendor_type: string
        }
        Insert: {
          category: string
          contact_person: string
          created_at?: string
          email: string
          id?: string
          name: string
          phone: string
          status?: string
          updated_at?: string
          vendor_type?: string
        }
        Update: {
          category?: string
          contact_person?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          status?: string
          updated_at?: string
          vendor_type?: string
        }
        Relationships: []
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
