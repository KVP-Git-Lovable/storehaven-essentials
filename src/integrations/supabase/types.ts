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
      asset_definition_fields: {
        Row: {
          category_id: string
          created_at: string
          field_label: string
          field_name: string
          field_type: string
          help_text: string | null
          id: string
          is_required: boolean
          options: Json | null
          placeholder: string | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          field_label: string
          field_name: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          field_label?: string
          field_name?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_definition_fields_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_master_custom_values: {
        Row: {
          asset_master_id: string
          created_at: string
          field_id: string
          id: string
          value: string | null
        }
        Insert: {
          asset_master_id: string
          created_at?: string
          field_id: string
          id?: string
          value?: string | null
        }
        Update: {
          asset_master_id?: string
          created_at?: string
          field_id?: string
          id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_master_custom_values_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_master_custom_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "asset_definition_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_master_vendors: {
        Row: {
          asset_master_id: string
          category: string | null
          created_at: string
          id: string
          notes: string | null
          vendor_id: string
          vendor_type: string | null
        }
        Insert: {
          asset_master_id: string
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          vendor_id: string
          vendor_type?: string | null
        }
        Update: {
          asset_master_id?: string
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          vendor_id?: string
          vendor_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_master_vendors_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_master_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_masters: {
        Row: {
          asset_type: string | null
          brand: string | null
          capacity: string | null
          category_id: string | null
          certification_required: boolean | null
          certifications: string[] | null
          created_at: string
          criticality: string
          currency: string | null
          datasheet_url: string | null
          default_asset_status: string | null
          default_oem_id: string | null
          default_purchase_date: string | null
          default_service_engagement: string | null
          default_vendor_id: string | null
          description: string | null
          dimensions_cm: string | null
          disposal_instructions: string | null
          energy_rating: string | null
          environment_impact: string | null
          expected_lifespan_years: number | null
          finish_color: string | null
          hsn_code: string | null
          id: string
          image_url: string | null
          installation_requirements: string | null
          investment_size: string
          is_returnable: boolean | null
          lead_time_days: number | null
          load_capacity: string | null
          maintenance_frequency: string | null
          manual_url: string | null
          manufacturer: string | null
          material: string | null
          min_order_quantity: number | null
          model: string | null
          name: string
          power_consumption_watts: number | null
          refrigerant_type: string | null
          safety_requirements: string | null
          sku: string | null
          spare_parts_available: boolean | null
          standard_price: number | null
          status: string
          temperature_range: string | null
          unit_of_measure: string | null
          upc_barcode: string | null
          updated_at: string
          voltage_requirement: string | null
          warranty_end_date: string | null
          warranty_months: number | null
          warranty_start_date: string | null
          weight_kg: number | null
        }
        Insert: {
          asset_type?: string | null
          brand?: string | null
          capacity?: string | null
          category_id?: string | null
          certification_required?: boolean | null
          certifications?: string[] | null
          created_at?: string
          criticality?: string
          currency?: string | null
          datasheet_url?: string | null
          default_asset_status?: string | null
          default_oem_id?: string | null
          default_purchase_date?: string | null
          default_service_engagement?: string | null
          default_vendor_id?: string | null
          description?: string | null
          dimensions_cm?: string | null
          disposal_instructions?: string | null
          energy_rating?: string | null
          environment_impact?: string | null
          expected_lifespan_years?: number | null
          finish_color?: string | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          installation_requirements?: string | null
          investment_size?: string
          is_returnable?: boolean | null
          lead_time_days?: number | null
          load_capacity?: string | null
          maintenance_frequency?: string | null
          manual_url?: string | null
          manufacturer?: string | null
          material?: string | null
          min_order_quantity?: number | null
          model?: string | null
          name: string
          power_consumption_watts?: number | null
          refrigerant_type?: string | null
          safety_requirements?: string | null
          sku?: string | null
          spare_parts_available?: boolean | null
          standard_price?: number | null
          status?: string
          temperature_range?: string | null
          unit_of_measure?: string | null
          upc_barcode?: string | null
          updated_at?: string
          voltage_requirement?: string | null
          warranty_end_date?: string | null
          warranty_months?: number | null
          warranty_start_date?: string | null
          weight_kg?: number | null
        }
        Update: {
          asset_type?: string | null
          brand?: string | null
          capacity?: string | null
          category_id?: string | null
          certification_required?: boolean | null
          certifications?: string[] | null
          created_at?: string
          criticality?: string
          currency?: string | null
          datasheet_url?: string | null
          default_asset_status?: string | null
          default_oem_id?: string | null
          default_purchase_date?: string | null
          default_service_engagement?: string | null
          default_vendor_id?: string | null
          description?: string | null
          dimensions_cm?: string | null
          disposal_instructions?: string | null
          energy_rating?: string | null
          environment_impact?: string | null
          expected_lifespan_years?: number | null
          finish_color?: string | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          installation_requirements?: string | null
          investment_size?: string
          is_returnable?: boolean | null
          lead_time_days?: number | null
          load_capacity?: string | null
          maintenance_frequency?: string | null
          manual_url?: string | null
          manufacturer?: string | null
          material?: string | null
          min_order_quantity?: number | null
          model?: string | null
          name?: string
          power_consumption_watts?: number | null
          refrigerant_type?: string | null
          safety_requirements?: string | null
          sku?: string | null
          spare_parts_available?: boolean | null
          standard_price?: number | null
          status?: string
          temperature_range?: string | null
          unit_of_measure?: string | null
          upc_barcode?: string | null
          updated_at?: string
          voltage_requirement?: string | null
          warranty_end_date?: string | null
          warranty_months?: number | null
          warranty_start_date?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_masters_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_masters_default_oem_id_fkey"
            columns: ["default_oem_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_masters_default_vendor_id_fkey"
            columns: ["default_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_status_history: {
        Row: {
          asset_id: string
          changed_at: string
          changed_by: string
          created_at: string
          id: string
          status: string
        }
        Insert: {
          asset_id: string
          changed_at?: string
          changed_by?: string
          created_at?: string
          id?: string
          status: string
        }
        Update: {
          asset_id?: string
          changed_at?: string
          changed_by?: string
          created_at?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_status_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_master_id: string | null
          asset_number: string | null
          asset_status: string
          category: string
          category_id: string | null
          condition: string
          created_at: string
          id: string
          location: string
          name: string
          oem_id: string | null
          purchase_date: string
          store_id: string | null
          updated_at: string
          value: number
          vendor_id: string | null
          warranty_end_date: string | null
          warranty_start_date: string | null
        }
        Insert: {
          asset_master_id?: string | null
          asset_number?: string | null
          asset_status?: string
          category: string
          category_id?: string | null
          condition: string
          created_at?: string
          id?: string
          location: string
          name: string
          oem_id?: string | null
          purchase_date: string
          store_id?: string | null
          updated_at?: string
          value: number
          vendor_id?: string | null
          warranty_end_date?: string | null
          warranty_start_date?: string | null
        }
        Update: {
          asset_master_id?: string | null
          asset_number?: string | null
          asset_status?: string
          category?: string
          category_id?: string | null
          condition?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          oem_id?: string | null
          purchase_date?: string
          store_id?: string | null
          updated_at?: string
          value?: number
          vendor_id?: string | null
          warranty_end_date?: string | null
          warranty_start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_masters"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "assets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
      attendance_records: {
        Row: {
          attendance_date: string
          check_in_address: string | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_in_photo_url: string | null
          check_in_time: string | null
          check_out_address: string | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          check_out_photo_url: string | null
          check_out_time: string | null
          created_at: string
          employee_id: string | null
          face_match_score: number | null
          face_verification_status: string | null
          id: string
          notes: string | null
          status: string | null
          store_id: string | null
          total_hours: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attendance_date?: string
          check_in_address?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_in_photo_url?: string | null
          check_in_time?: string | null
          check_out_address?: string | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_photo_url?: string | null
          check_out_time?: string | null
          created_at?: string
          employee_id?: string | null
          face_match_score?: number | null
          face_verification_status?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          store_id?: string | null
          total_hours?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attendance_date?: string
          check_in_address?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_in_photo_url?: string | null
          check_in_time?: string | null
          check_out_address?: string | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_photo_url?: string | null
          check_out_time?: string | null
          created_at?: string
          employee_id?: string | null
          face_match_score?: number | null
          face_verification_status?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          store_id?: string | null
          total_hours?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_approval_history: {
        Row: {
          action: string
          budget_id: string
          comments: string | null
          created_at: string
          id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          budget_id: string
          comments?: string | null
          created_at?: string
          id?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          budget_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_approval_history_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "store_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_master_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number | null
          status: string | null
          store_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
          status?: string | null
          store_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          status?: string | null
          store_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      budget_master_items: {
        Row: {
          created_at: string
          default_amount: number | null
          description: string | null
          group_id: string
          id: string
          inventory_item_id: string | null
          is_recurring: boolean | null
          item_type: string
          name: string
          sort_order: number | null
          status: string | null
        }
        Insert: {
          created_at?: string
          default_amount?: number | null
          description?: string | null
          group_id: string
          id?: string
          inventory_item_id?: string | null
          is_recurring?: boolean | null
          item_type?: string
          name: string
          sort_order?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string
          default_amount?: number | null
          description?: string | null
          group_id?: string
          id?: string
          inventory_item_id?: string | null
          is_recurring?: boolean | null
          item_type?: string
          name?: string
          sort_order?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_master_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "budget_master_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_master_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_documents: {
        Row: {
          candidate_id: string
          created_at: string
          document_name: string | null
          document_type: string
          file_name: string
          file_url: string
          id: string
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          document_name?: string | null
          document_type: string
          file_name: string
          file_url: string
          id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          document_name?: string | null
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          current_company: string | null
          current_designation: string | null
          email: string | null
          expected_salary: number | null
          experience_years: number | null
          id: string
          name: string
          notes: string | null
          notice_period_days: number | null
          phone: string | null
          requisition_id: string | null
          resume_url: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_company?: string | null
          current_designation?: string | null
          email?: string | null
          expected_salary?: number | null
          experience_years?: number | null
          id?: string
          name: string
          notes?: string | null
          notice_period_days?: number | null
          phone?: string | null
          requisition_id?: string | null
          resume_url?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_company?: string | null
          current_designation?: string | null
          email?: string | null
          expected_salary?: number | null
          experience_years?: number | null
          id?: string
          name?: string
          notes?: string | null
          notice_period_days?: number | null
          phone?: string | null
          requisition_id?: string | null
          resume_url?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "job_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      cashier_sessions: {
        Row: {
          actual_closing: number | null
          cash_in: number
          cash_out: number
          created_at: string
          difference: number | null
          end_time: string | null
          expected_closing: number | null
          id: string
          notes: string | null
          opening_float: number
          start_time: string
          status: string
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_closing?: number | null
          cash_in?: number
          cash_out?: number
          created_at?: string
          difference?: number | null
          end_time?: string | null
          expected_closing?: number | null
          id?: string
          notes?: string | null
          opening_float?: number
          start_time?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_closing?: number | null
          cash_in?: number
          cash_out?: number
          created_at?: string
          difference?: number | null
          end_time?: string | null
          expected_closing?: number | null
          id?: string
          notes?: string | null
          opening_float?: number
          start_time?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashier_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          parent_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_logs: {
        Row: {
          consumption_date: string
          created_at: string
          id: string
          item_id: string
          logged_by: string
          purpose: string
          quantity: number
          store_id: string
        }
        Insert: {
          consumption_date?: string
          created_at?: string
          id?: string
          item_id: string
          logged_by: string
          purpose: string
          quantity: number
          store_id: string
        }
        Update: {
          consumption_date?: string
          created_at?: string
          id?: string
          item_id?: string
          logged_by?: string
          purpose?: string
          quantity?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usages: {
        Row: {
          coupon_id: string
          customer_id: string | null
          discount_amount: number
          id: string
          order_id: string
          used_at: string
        }
        Insert: {
          coupon_id: string
          customer_id?: string | null
          discount_amount: number
          id?: string
          order_id: string
          used_at?: string
        }
        Update: {
          coupon_id?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          order_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_category_ids: string[] | null
          applicable_product_ids: string[] | null
          code: string
          created_at: string
          customer_id: string | null
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string
          id: string
          max_discount_amount: number | null
          min_purchase_amount: number | null
          name: string
          per_customer_limit: number | null
          start_date: string
          status: string
          updated_at: string
          usage_count: number | null
          usage_limit: number | null
        }
        Insert: {
          applicable_category_ids?: string[] | null
          applicable_product_ids?: string[] | null
          code: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          discount_type: string
          discount_value?: number
          end_date: string
          id?: string
          max_discount_amount?: number | null
          min_purchase_amount?: number | null
          name: string
          per_customer_limit?: number | null
          start_date: string
          status?: string
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
        }
        Update: {
          applicable_category_ids?: string[] | null
          applicable_product_ids?: string[] | null
          code?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string
          id?: string
          max_discount_amount?: number | null
          min_purchase_amount?: number | null
          name?: string
          per_customer_limit?: number | null
          start_date?: string
          status?: string
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          anniversary_date: string | null
          created_at: string
          customer_segment: string | null
          date_of_birth: string | null
          email: string | null
          id: string
          loyalty_points: number | null
          name: string | null
          phone: string
          preferences: Json | null
          store_credit: number | null
          tier: string | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          anniversary_date?: string | null
          created_at?: string
          customer_segment?: string | null
          date_of_birth?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name?: string | null
          phone: string
          preferences?: Json | null
          store_credit?: number | null
          tier?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          anniversary_date?: string | null
          created_at?: string
          customer_segment?: string | null
          date_of_birth?: string | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name?: string | null
          phone?: string
          preferences?: Json | null
          store_credit?: number | null
          tier?: string | null
          total_orders?: number | null
          total_spent?: number | null
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
      employee_competencies: {
        Row: {
          certification_date: string | null
          certification_name: string | null
          certified: boolean | null
          created_at: string
          employee_id: string
          expiry_date: string | null
          id: string
          proficiency_level: number | null
          skill_name: string
          updated_at: string
        }
        Insert: {
          certification_date?: string | null
          certification_name?: string | null
          certified?: boolean | null
          created_at?: string
          employee_id: string
          expiry_date?: string | null
          id?: string
          proficiency_level?: number | null
          skill_name: string
          updated_at?: string
        }
        Update: {
          certification_date?: string | null
          certification_name?: string | null
          certified?: boolean | null
          created_at?: string
          employee_id?: string
          expiry_date?: string | null
          id?: string
          proficiency_level?: number | null
          skill_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_competencies_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string
          document_name: string | null
          document_type: string
          employee_id: string
          file_name: string
          file_url: string
          id: string
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          document_name?: string | null
          document_type: string
          employee_id: string
          file_name: string
          file_url: string
          id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          document_name?: string | null
          document_type?: string
          employee_id?: string
          file_name?: string
          file_url?: string
          id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_feedback: {
        Row: {
          created_at: string
          employee_id: string | null
          feedback_date: string
          feedback_text: string | null
          id: string
          rating: number
          reviewer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          feedback_date?: string
          feedback_text?: string | null
          id?: string
          rating: number
          reviewer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          feedback_date?: string
          feedback_text?: string | null
          id?: string
          rating?: number
          reviewer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_feedback_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_feedback_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          aadhar_number: string | null
          blood_group: string | null
          created_at: string
          current_address: string | null
          date_of_birth: string | null
          department: string
          education_level: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          face_baseline_url: string | null
          gender: string | null
          id: string
          join_date: string
          manager_id: string | null
          name: string
          onboarding_approved_at: string | null
          onboarding_approved_by: string | null
          onboarding_status: string | null
          pan_number: string | null
          permanent_address: string | null
          phone: string
          position: string
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          aadhar_number?: string | null
          blood_group?: string | null
          created_at?: string
          current_address?: string | null
          date_of_birth?: string | null
          department: string
          education_level?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          face_baseline_url?: string | null
          gender?: string | null
          id?: string
          join_date: string
          manager_id?: string | null
          name: string
          onboarding_approved_at?: string | null
          onboarding_approved_by?: string | null
          onboarding_status?: string | null
          pan_number?: string | null
          permanent_address?: string | null
          phone: string
          position: string
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          aadhar_number?: string | null
          blood_group?: string | null
          created_at?: string
          current_address?: string | null
          date_of_birth?: string | null
          department?: string
          education_level?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          face_baseline_url?: string | null
          gender?: string | null
          id?: string
          join_date?: string
          manager_id?: string | null
          name?: string
          onboarding_approved_at?: string | null
          onboarding_approved_by?: string | null
          onboarding_status?: string | null
          pan_number?: string | null
          permanent_address?: string | null
          phone?: string
          position?: string
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
      footfall_records: {
        Row: {
          conversion_count: number | null
          created_at: string
          entry_count: number
          exit_count: number
          id: string
          notes: string | null
          peak_hour_count: number | null
          peak_hour_end: string | null
          peak_hour_start: string | null
          record_date: string
          recorded_by: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          conversion_count?: number | null
          created_at?: string
          entry_count?: number
          exit_count?: number
          id?: string
          notes?: string | null
          peak_hour_count?: number | null
          peak_hour_end?: string | null
          peak_hour_start?: string | null
          record_date: string
          recorded_by?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          conversion_count?: number | null
          created_at?: string
          entry_count?: number
          exit_count?: number
          id?: string
          notes?: string | null
          peak_hour_count?: number | null
          peak_hour_end?: string | null
          peak_hour_start?: string | null
          record_date?: string
          recorded_by?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "footfall_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      franchisee_documents: {
        Row: {
          created_at: string
          document_name: string | null
          document_type: string
          file_name: string
          file_url: string
          franchisee_id: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_name?: string | null
          document_type?: string
          file_name: string
          file_url: string
          franchisee_id: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_name?: string | null
          document_type?: string
          file_name?: string
          file_url?: string
          franchisee_id?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "franchisee_documents_franchisee_id_fkey"
            columns: ["franchisee_id"]
            isOneToOne: false
            referencedRelation: "franchisees"
            referencedColumns: ["id"]
          },
        ]
      }
      franchisee_onboarding_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean | null
          sort_order: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      franchisee_onboarding_progress: {
        Row: {
          checklist_item_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          franchisee_id: string
          id: string
          is_completed: boolean | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          checklist_item_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          franchisee_id: string
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          checklist_item_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          franchisee_id?: string
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchisee_onboarding_progress_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "franchisee_onboarding_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "franchisee_onboarding_progress_franchisee_id_fkey"
            columns: ["franchisee_id"]
            isOneToOne: false
            referencedRelation: "franchisees"
            referencedColumns: ["id"]
          },
        ]
      }
      franchisees: {
        Row: {
          alignment: string | null
          city: string | null
          created_at: string
          created_by: string | null
          current_business_background: string | null
          email: string | null
          id: string
          infrastructure_details: string | null
          interested_location: string | null
          name: string
          notes: string | null
          onboarding_status: string
          phone: string | null
          previous_work_experience: string | null
          probability: string | null
          sign_up_by_date: string | null
          state: string | null
          status: string
          store_plan_id: string | null
          updated_at: string
        }
        Insert: {
          alignment?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          current_business_background?: string | null
          email?: string | null
          id?: string
          infrastructure_details?: string | null
          interested_location?: string | null
          name: string
          notes?: string | null
          onboarding_status?: string
          phone?: string | null
          previous_work_experience?: string | null
          probability?: string | null
          sign_up_by_date?: string | null
          state?: string | null
          status?: string
          store_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          alignment?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          current_business_background?: string | null
          email?: string | null
          id?: string
          infrastructure_details?: string | null
          interested_location?: string | null
          name?: string
          notes?: string | null
          onboarding_status?: string
          phone?: string | null
          previous_work_experience?: string | null
          probability?: string | null
          sign_up_by_date?: string | null
          state?: string | null
          status?: string
          store_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchisees_store_plan_id_fkey"
            columns: ["store_plan_id"]
            isOneToOne: false
            referencedRelation: "store_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      frequency_master: {
        Row: {
          created_at: string
          days_of_week: number[] | null
          description: string | null
          frequency_type: Database["public"]["Enums"]["frequency_type"]
          id: string
          interval_days: number | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          frequency_type: Database["public"]["Enums"]["frequency_type"]
          id?: string
          interval_days?: number | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          frequency_type?: Database["public"]["Enums"]["frequency_type"]
          id?: string
          interval_days?: number | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      gift_card_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          gift_card_id: string
          id: string
          notes: string | null
          order_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          gift_card_id: string
          id?: string
          notes?: string | null
          order_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          gift_card_id?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_transactions_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          card_number: string
          created_at: string
          current_balance: number
          expires_at: string | null
          id: string
          initial_value: number
          pin: string | null
          purchase_order_id: string | null
          purchaser_customer_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          card_number: string
          created_at?: string
          current_balance: number
          expires_at?: string | null
          id?: string
          initial_value: number
          pin?: string | null
          purchase_order_id?: string | null
          purchaser_customer_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          card_number?: string
          created_at?: string
          current_balance?: number
          expires_at?: string | null
          id?: string
          initial_value?: number
          pin?: string | null
          purchase_order_id?: string | null
          purchaser_customer_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_purchaser_customer_id_fkey"
            columns: ["purchaser_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      grn: {
        Row: {
          created_at: string
          grn_number: string
          id: string
          notes: string | null
          received_at: string
          received_by: string
          shipment_id: string | null
          status: string
          store_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          grn_number: string
          id?: string
          notes?: string | null
          received_at?: string
          received_by: string
          shipment_id?: string | null
          status?: string
          store_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          grn_number?: string
          id?: string
          notes?: string | null
          received_at?: string
          received_by?: string
          shipment_id?: string | null
          status?: string
          store_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grn_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_items: {
        Row: {
          batch_number: string | null
          created_at: string
          damage_notes: string | null
          expiry_date: string | null
          grn_id: string
          id: string
          item_id: string
          quantity_damaged: number
          quantity_expected: number
          quantity_received: number
          quantity_short: number
          unit_cost: number
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          damage_notes?: string | null
          expiry_date?: string | null
          grn_id: string
          id?: string
          item_id: string
          quantity_damaged?: number
          quantity_expected: number
          quantity_received?: number
          quantity_short?: number
          unit_cost: number
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          damage_notes?: string | null
          expiry_date?: string | null
          grn_id?: string
          id?: string
          item_id?: string
          quantity_damaged?: number
          quantity_expected?: number
          quantity_received?: number
          quantity_short?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grn"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      held_orders: {
        Row: {
          cart_data: Json
          created_at: string
          created_by: string | null
          customer_id: string | null
          expires_at: string
          id: string
          note: string | null
          store_id: string | null
        }
        Insert: {
          cart_data: Json
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expires_at?: string
          id?: string
          note?: string | null
          store_id?: string | null
        }
        Update: {
          cart_data?: Json
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expires_at?: string
          id?: string
          note?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "held_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          is_optional: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_optional?: boolean
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_optional?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          asset_id: string | null
          created_at: string
          description: string
          id: string
          location: string
          priority: string
          reported_by: string
          status: string
          store_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          description: string
          id?: string
          location: string
          priority: string
          reported_by: string
          status?: string
          store_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          description?: string
          id?: string
          location?: string
          priority?: string
          reported_by?: string
          status?: string
          store_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_rounds: {
        Row: {
          candidate_id: string
          created_at: string
          duration_minutes: number | null
          feedback: string | null
          id: string
          interviewer_id: string | null
          interviewer_name: string | null
          rating: number | null
          recommendation: string | null
          round_number: number
          round_type: string
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          interviewer_id?: string | null
          interviewer_name?: string | null
          rating?: number | null
          recommendation?: string | null
          round_number?: number
          round_type?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          interviewer_id?: string | null
          interviewer_name?: string | null
          rating?: number | null
          recommendation?: string | null
          round_number?: number
          round_type?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_rounds_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          asset_master_id: string | null
          barcode: string | null
          category: string
          created_at: string
          expiry_tracking: boolean | null
          id: string
          max_stock: number | null
          min_stock: number
          name: string
          rate_validity_date: string | null
          rate_validity_days: number | null
          selling_price: number
          sku: string | null
          status: string
          unit: string
          unit_cost: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          asset_master_id?: string | null
          barcode?: string | null
          category: string
          created_at?: string
          expiry_tracking?: boolean | null
          id?: string
          max_stock?: number | null
          min_stock?: number
          name: string
          rate_validity_date?: string | null
          rate_validity_days?: number | null
          selling_price?: number
          sku?: string | null
          status?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          asset_master_id?: string | null
          barcode?: string | null
          category?: string
          created_at?: string
          expiry_tracking?: boolean | null
          id?: string
          max_stock?: number | null
          min_stock?: number
          name?: string
          rate_validity_date?: string | null
          rate_validity_days?: number | null
          selling_price?: number
          sku?: string | null
          status?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      job_requisitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          department: string
          description: string | null
          id: string
          number_of_openings: number
          position: string
          priority: string
          requested_by: string | null
          requirements: string | null
          salary_range_max: number | null
          salary_range_min: number | null
          status: string
          store_id: string | null
          target_join_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department: string
          description?: string | null
          id?: string
          number_of_openings?: number
          position: string
          priority?: string
          requested_by?: string | null
          requirements?: string | null
          salary_range_max?: number | null
          salary_range_min?: number | null
          status?: string
          store_id?: string | null
          target_join_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department?: string
          description?: string | null
          id?: string
          number_of_openings?: number
          position?: string
          priority?: string
          requested_by?: string | null
          requirements?: string | null
          salary_range_max?: number | null
          salary_range_min?: number | null
          status?: string
          store_id?: string | null
          target_join_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_requisitions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_article_assets: {
        Row: {
          article_id: string
          asset_master_id: string
          created_at: string
          id: string
        }
        Insert: {
          article_id: string
          asset_master_id: string
          created_at?: string
          id?: string
        }
        Update: {
          article_id?: string
          asset_master_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_assets_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_article_assets_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_article_attachments: {
        Row: {
          article_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          article_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          article_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_attachments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_article_vendors: {
        Row: {
          article_id: string
          created_at: string
          id: string
          vendor_id: string
          vendor_role: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          vendor_id: string
          vendor_role?: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          vendor_id?: string
          vendor_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_vendors_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_article_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_articles: {
        Row: {
          ai_generated: boolean | null
          ai_generated_at: string | null
          article_type: string
          asset_master_id: string | null
          category: string
          content: string
          created_at: string
          created_by: string | null
          donts: string[] | null
          dos: string[] | null
          helpful_count: number | null
          id: string
          keywords: string[] | null
          process_steps: string[] | null
          sme_names: string[] | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          video_urls: string[] | null
          views_count: number | null
        }
        Insert: {
          ai_generated?: boolean | null
          ai_generated_at?: string | null
          article_type?: string
          asset_master_id?: string | null
          category?: string
          content: string
          created_at?: string
          created_by?: string | null
          donts?: string[] | null
          dos?: string[] | null
          helpful_count?: number | null
          id?: string
          keywords?: string[] | null
          process_steps?: string[] | null
          sme_names?: string[] | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          video_urls?: string[] | null
          views_count?: number | null
        }
        Update: {
          ai_generated?: boolean | null
          ai_generated_at?: string | null
          article_type?: string
          asset_master_id?: string | null
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          donts?: string[] | null
          dos?: string[] | null
          helpful_count?: number | null
          id?: string
          keywords?: string[] | null
          process_steps?: string[] | null
          sme_names?: string[] | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          video_urls?: string[] | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_articles_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      layaway_items: {
        Row: {
          created_at: string
          id: string
          layaway_id: string
          product_id: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          layaway_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          layaway_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "layaway_items_layaway_id_fkey"
            columns: ["layaway_id"]
            isOneToOne: false
            referencedRelation: "layaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layaway_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      layaway_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          layaway_id: string
          payment_method: string
          received_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          layaway_id: string
          payment_method: string
          received_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          layaway_id?: string
          payment_method?: string
          received_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "layaway_payments_layaway_id_fkey"
            columns: ["layaway_id"]
            isOneToOne: false
            referencedRelation: "layaways"
            referencedColumns: ["id"]
          },
        ]
      }
      layaways: {
        Row: {
          amount_paid: number
          balance_due: number | null
          created_at: string
          created_by: string | null
          customer_id: string
          deposit_amount: number
          id: string
          layaway_number: string
          notes: string | null
          payment_due_date: string | null
          status: string
          store_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          balance_due?: number | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          deposit_amount: number
          id?: string
          layaway_number: string
          notes?: string | null
          payment_due_date?: string | null
          status?: string
          store_id?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          balance_due?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deposit_amount?: number
          id?: string
          layaway_number?: string
          notes?: string | null
          payment_due_date?: string | null
          status?: string
          store_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "layaways_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layaways_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          available: number | null
          created_at: string
          employee_id: string
          granted: number | null
          id: string
          lapsed: number | null
          leave_type_id: string
          opening_balance: number | null
          pending: number | null
          updated_at: string
          used: number | null
          user_id: string | null
          year: number
        }
        Insert: {
          available?: number | null
          created_at?: string
          employee_id: string
          granted?: number | null
          id?: string
          lapsed?: number | null
          leave_type_id: string
          opening_balance?: number | null
          pending?: number | null
          updated_at?: string
          used?: number | null
          user_id?: string | null
          year?: number
        }
        Update: {
          available?: number | null
          created_at?: string
          employee_id?: string
          granted?: number | null
          id?: string
          lapsed?: number | null
          leave_type_id?: string
          opening_balance?: number | null
          pending?: number | null
          updated_at?: string
          used?: number | null
          user_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days_count: number
          employee_id: string
          from_date: string
          half_day_type: string | null
          id: string
          leave_type_id: string
          reason: string | null
          rejection_reason: string | null
          status: string | null
          to_date: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count: number
          employee_id: string
          from_date: string
          half_day_type?: string | null
          id?: string
          leave_type_id: string
          reason?: string | null
          rejection_reason?: string | null
          status?: string | null
          to_date: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count?: number
          employee_id?: string
          from_date?: string
          half_day_type?: string | null
          id?: string
          leave_type_id?: string
          reason?: string | null
          rejection_reason?: string | null
          status?: string | null
          to_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          carry_forward: boolean | null
          created_at: string
          description: string | null
          id: string
          is_paid: boolean | null
          max_carry_forward: number | null
          max_per_year: number | null
          min_notice_days: number | null
          name: string
          requires_approval: boolean | null
          status: string | null
        }
        Insert: {
          carry_forward?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          is_paid?: boolean | null
          max_carry_forward?: number | null
          max_per_year?: number | null
          min_notice_days?: number | null
          name: string
          requires_approval?: boolean | null
          status?: string | null
        }
        Update: {
          carry_forward?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          is_paid?: boolean | null
          max_carry_forward?: number | null
          max_per_year?: number | null
          min_notice_days?: number | null
          name?: string
          requires_approval?: boolean | null
          status?: string | null
        }
        Relationships: []
      }
      loyalty_config: {
        Row: {
          birthday_bonus_points: number | null
          created_at: string
          id: string
          is_active: boolean | null
          max_points_per_transaction: number | null
          min_points_redeem: number | null
          name: string
          points_per_rupee: number
          points_value_rupee: number
          tier_multipliers: Json | null
          updated_at: string
          welcome_bonus_points: number | null
        }
        Insert: {
          birthday_bonus_points?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_points_per_transaction?: number | null
          min_points_redeem?: number | null
          name?: string
          points_per_rupee?: number
          points_value_rupee?: number
          tier_multipliers?: Json | null
          updated_at?: string
          welcome_bonus_points?: number | null
        }
        Update: {
          birthday_bonus_points?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_points_per_transaction?: number | null
          min_points_redeem?: number | null
          name?: string
          points_per_rupee?: number
          points_value_rupee?: number
          tier_multipliers?: Json | null
          updated_at?: string
          welcome_bonus_points?: number | null
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          balance_after: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          order_id: string | null
          points: number
          transaction_type: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          order_id?: string | null
          points: number
          transaction_type: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          order_id?: string | null
          points?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_task_labour: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_billable: boolean
          is_covered_by_contract: boolean
          notes: string | null
          task_id: string
          total_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_billable?: boolean
          is_covered_by_contract?: boolean
          notes?: string | null
          task_id: string
          total_cost: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_billable?: boolean
          is_covered_by_contract?: boolean
          notes?: string | null
          task_id?: string
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_task_labour_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_task_spares: {
        Row: {
          asset_master_id: string | null
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string | null
          is_billable: boolean
          is_covered_by_contract: boolean
          notes: string | null
          quantity: number
          spare_name: string
          task_id: string
          total_cost: number | null
          unit_cost: number
        }
        Insert: {
          asset_master_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string | null
          is_billable?: boolean
          is_covered_by_contract?: boolean
          notes?: string | null
          quantity?: number
          spare_name: string
          task_id: string
          total_cost?: number | null
          unit_cost: number
        }
        Update: {
          asset_master_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string | null
          is_billable?: boolean
          is_covered_by_contract?: boolean
          notes?: string | null
          quantity?: number
          spare_name?: string
          task_id?: string
          total_cost?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_task_spares_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_task_spares_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_task_spares_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          asset: string
          asset_id: string | null
          assigned_to: string
          created_at: string
          frequency: string
          id: string
          last_done: string
          next_due: string
          pm_checklist_master_id: string | null
          service_contract_id: string | null
          status: string
          store_id: string | null
          task_type: string
          updated_at: string
        }
        Insert: {
          asset: string
          asset_id?: string | null
          assigned_to: string
          created_at?: string
          frequency: string
          id?: string
          last_done: string
          next_due: string
          pm_checklist_master_id?: string | null
          service_contract_id?: string | null
          status?: string
          store_id?: string | null
          task_type: string
          updated_at?: string
        }
        Update: {
          asset?: string
          asset_id?: string | null
          assigned_to?: string
          created_at?: string
          frequency?: string
          id?: string
          last_done?: string
          next_due?: string
          pm_checklist_master_id?: string | null
          service_contract_id?: string | null
          status?: string
          store_id?: string | null
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_pm_checklist_master_id_fkey"
            columns: ["pm_checklist_master_id"]
            isOneToOne: false
            referencedRelation: "pm_checklist_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_service_contract_id_fkey"
            columns: ["service_contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_feedback: {
        Row: {
          action_items: string | null
          areas_of_improvement: string | null
          attitude_rating: number | null
          communication_rating: number | null
          created_at: string
          employee_id: string
          feedback_by: string
          feedback_date: string
          id: string
          performance_rating: number | null
          strengths: string | null
          teamwork_rating: number | null
        }
        Insert: {
          action_items?: string | null
          areas_of_improvement?: string | null
          attitude_rating?: number | null
          communication_rating?: number | null
          created_at?: string
          employee_id: string
          feedback_by: string
          feedback_date?: string
          id?: string
          performance_rating?: number | null
          strengths?: string | null
          teamwork_rating?: number | null
        }
        Update: {
          action_items?: string | null
          areas_of_improvement?: string | null
          attitude_rating?: number | null
          communication_rating?: number | null
          created_at?: string
          employee_id?: string
          feedback_by?: string
          feedback_date?: string
          id?: string
          performance_rating?: number | null
          strengths?: string | null
          teamwork_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_feedback_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
      nso_checklist_masters: {
        Row: {
          actual_budget: number | null
          budget: number | null
          created_at: string
          description: string | null
          estimated_budget: number | null
          id: string
          name: string
          planned_budget: number | null
          prescribed_sqft: number | null
          status: string
          store_type: string | null
          updated_at: string
        }
        Insert: {
          actual_budget?: number | null
          budget?: number | null
          created_at?: string
          description?: string | null
          estimated_budget?: number | null
          id?: string
          name: string
          planned_budget?: number | null
          prescribed_sqft?: number | null
          status?: string
          store_type?: string | null
          updated_at?: string
        }
        Update: {
          actual_budget?: number | null
          budget?: number | null
          created_at?: string
          description?: string | null
          estimated_budget?: number | null
          id?: string
          name?: string
          planned_budget?: number | null
          prescribed_sqft?: number | null
          status?: string
          store_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      nso_master_assets: {
        Row: {
          asset_master_id: string
          created_at: string
          id: string
          master_id: string
          notes: string | null
          quantity: number
          sort_order: number
          vendor_id: string | null
        }
        Insert: {
          asset_master_id: string
          created_at?: string
          id?: string
          master_id: string
          notes?: string | null
          quantity?: number
          sort_order?: number
          vendor_id?: string | null
        }
        Update: {
          asset_master_id?: string
          created_at?: string
          id?: string
          master_id?: string
          notes?: string | null
          quantity?: number
          sort_order?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nso_master_assets_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nso_master_assets_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "nso_checklist_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nso_master_assets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      nso_master_budget_items: {
        Row: {
          category: string
          created_at: string | null
          id: string
          master_id: string
          name: string
          notes: string | null
          planned_amount: number | null
          sort_order: number
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          id?: string
          master_id: string
          name: string
          notes?: string | null
          planned_amount?: number | null
          sort_order?: number
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          master_id?: string
          name?: string
          notes?: string | null
          planned_amount?: number | null
          sort_order?: number
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nso_master_budget_items_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "nso_checklist_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nso_master_budget_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      nso_master_sections: {
        Row: {
          created_at: string
          id: string
          master_id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          master_id: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          master_id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "nso_master_sections_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "nso_checklist_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      nso_master_task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          task_id: string
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "nso_master_task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "nso_master_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      nso_master_tasks: {
        Row: {
          created_at: string
          description: string | null
          duration_days: number
          from_buildup_days: number
          id: string
          name: string
          section_id: string
          sort_order: number
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_days?: number
          from_buildup_days?: number
          id?: string
          name: string
          section_id: string
          sort_order?: number
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_days?: number
          from_buildup_days?: number
          id?: string
          name?: string
          section_id?: string
          sort_order?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nso_master_tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "nso_master_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nso_master_tasks_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      nso_store_assets: {
        Row: {
          asset_master_id: string
          checklist_id: string
          created_at: string
          id: string
          is_custom: boolean
          notes: string | null
          quantity: number
          sort_order: number
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          asset_master_id: string
          checklist_id: string
          created_at?: string
          id?: string
          is_custom?: boolean
          notes?: string | null
          quantity?: number
          sort_order?: number
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          asset_master_id?: string
          checklist_id?: string
          created_at?: string
          id?: string
          is_custom?: boolean
          notes?: string | null
          quantity?: number
          sort_order?: number
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nso_store_assets_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nso_store_assets_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "nso_store_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nso_store_assets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      nso_store_budget_items: {
        Row: {
          actual_cost: number | null
          amount: number
          category: string
          checklist_id: string
          created_at: string | null
          description: string
          id: string
          name: string
          notes: string | null
          planned_amount: number | null
          sort_order: number
          status: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          amount?: number
          category?: string
          checklist_id: string
          created_at?: string | null
          description: string
          id?: string
          name: string
          notes?: string | null
          planned_amount?: number | null
          sort_order?: number
          status?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          amount?: number
          category?: string
          checklist_id?: string
          created_at?: string | null
          description?: string
          id?: string
          name?: string
          notes?: string | null
          planned_amount?: number | null
          sort_order?: number
          status?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nso_store_budget_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "nso_store_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nso_store_budget_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      nso_store_checklists: {
        Row: {
          budget: number | null
          created_at: string
          final_budget: number | null
          id: string
          master_id: string | null
          name: string
          prescribed_budget: number | null
          start_date: string
          status: string
          store_id: string
          store_plan_id: string | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          final_budget?: number | null
          id?: string
          master_id?: string | null
          name: string
          prescribed_budget?: number | null
          start_date: string
          status?: string
          store_id: string
          store_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          final_budget?: number | null
          id?: string
          master_id?: string | null
          name?: string
          prescribed_budget?: number | null
          start_date?: string
          status?: string
          store_id?: string
          store_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nso_store_checklists_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "nso_checklist_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nso_store_checklists_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nso_store_checklists_store_plan_id_fkey"
            columns: ["store_plan_id"]
            isOneToOne: false
            referencedRelation: "store_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      nso_store_sections: {
        Row: {
          checklist_id: string
          created_at: string
          id: string
          is_custom: boolean
          name: string
          sort_order: number
        }
        Insert: {
          checklist_id: string
          created_at?: string
          id?: string
          is_custom?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          checklist_id?: string
          created_at?: string
          id?: string
          is_custom?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "nso_store_sections_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "nso_store_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      nso_store_tasks: {
        Row: {
          checklist_id: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_custom: boolean
          name: string
          owner: string | null
          section_id: string
          sort_order: number
          start_date: string | null
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          checklist_id: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_custom?: boolean
          name: string
          owner?: string | null
          section_id: string
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          checklist_id?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_custom?: boolean
          name?: string
          owner?: string | null
          section_id?: string
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nso_store_tasks_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "nso_store_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nso_store_tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "nso_store_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nso_store_tasks_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      nso_task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "nso_task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "nso_store_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_letters: {
        Row: {
          candidate_id: string
          created_at: string
          expiry_date: string | null
          id: string
          joining_date: string | null
          notes: string | null
          offer_date: string
          offer_letter_url: string | null
          offered_department: string
          offered_position: string
          offered_salary: number | null
          requisition_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          joining_date?: string | null
          notes?: string | null
          offer_date?: string
          offer_letter_url?: string | null
          offered_department: string
          offered_position: string
          offered_salary?: number | null
          requisition_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          joining_date?: string | null
          notes?: string | null
          offer_date?: string
          offer_letter_url?: string | null
          offered_department?: string
          offered_position?: string
          offered_salary?: number | null
          requisition_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_letters_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_letters_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "job_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          id: string
          item_id: string
          order_id: string
          quantity: number
          tax_amount: number | null
          tax_percent: number | null
          total_amount: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          item_id: string
          order_id: string
          quantity: number
          tax_amount?: number | null
          tax_percent?: number | null
          total_amount: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          item_id?: string
          order_id?: string
          quantity?: number
          tax_amount?: number | null
          tax_percent?: number | null
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          payment_method: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          payment_method: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          payment_method?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_discount: number | null
          coupon_id: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          discount_amount: number | null
          gift_card_amount: number | null
          gift_card_id: string | null
          id: string
          loyalty_points_earned: number | null
          loyalty_points_redeemed: number | null
          notes: string | null
          order_number: string
          order_type: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: string
          scheme_ids: string[] | null
          status: string
          store_id: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          coupon_discount?: number | null
          coupon_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount_amount?: number | null
          gift_card_amount?: number | null
          gift_card_id?: string | null
          id?: string
          loyalty_points_earned?: number | null
          loyalty_points_redeemed?: number | null
          notes?: string | null
          order_number: string
          order_type?: string | null
          payment_method: string
          payment_reference?: string | null
          payment_status?: string
          scheme_ids?: string[] | null
          status?: string
          store_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          coupon_discount?: number | null
          coupon_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount_amount?: number | null
          gift_card_amount?: number | null
          gift_card_id?: string | null
          id?: string
          loyalty_points_earned?: number | null
          loyalty_points_redeemed?: number | null
          notes?: string | null
          order_number?: string
          order_type?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          scheme_ids?: string[] | null
          status?: string
          store_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          acknowledged_at: string | null
          career_interests: string | null
          competency_score: number | null
          created_at: string
          employee_comments: string | null
          employee_id: string
          id: string
          kra_achievement: number | null
          next_steps: string | null
          overall_rating: number | null
          promotion_potential: string | null
          ranking_in_team: number | null
          review_date: string | null
          review_period_end: string
          review_period_start: string
          reviewed_by: string
          status: string | null
          strengths: string | null
          training_needs: string | null
          updated_at: string
          weaknesses: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          career_interests?: string | null
          competency_score?: number | null
          created_at?: string
          employee_comments?: string | null
          employee_id: string
          id?: string
          kra_achievement?: number | null
          next_steps?: string | null
          overall_rating?: number | null
          promotion_potential?: string | null
          ranking_in_team?: number | null
          review_date?: string | null
          review_period_end: string
          review_period_start: string
          reviewed_by: string
          status?: string | null
          strengths?: string | null
          training_needs?: string | null
          updated_at?: string
          weaknesses?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          career_interests?: string | null
          competency_score?: number | null
          created_at?: string
          employee_comments?: string | null
          employee_id?: string
          id?: string
          kra_achievement?: number | null
          next_steps?: string | null
          overall_rating?: number | null
          promotion_potential?: string | null
          ranking_in_team?: number | null
          review_date?: string | null
          review_period_end?: string
          review_period_start?: string
          reviewed_by?: string
          status?: string | null
          strengths?: string | null
          training_needs?: string | null
          updated_at?: string
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_set_group_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          group_id: string
          id: string
          module_key: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          group_id: string
          id?: string
          module_key: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          group_id?: string
          id?: string
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_set_group_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_set_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_set_groups: {
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
      personalized_offers: {
        Row: {
          created_at: string
          description: string | null
          discount_type: string | null
          discount_value: number | null
          display_message: string | null
          end_date: string | null
          id: string
          name: string
          offer_type: string
          priority: number | null
          product_ids: string[] | null
          start_date: string | null
          status: string
          trigger_conditions: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          display_message?: string | null
          end_date?: string | null
          id?: string
          name: string
          offer_type: string
          priority?: number | null
          product_ids?: string[] | null
          start_date?: string | null
          status?: string
          trigger_conditions?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          display_message?: string | null
          end_date?: string | null
          id?: string
          name?: string
          offer_type?: string
          priority?: number | null
          product_ids?: string[] | null
          start_date?: string | null
          status?: string
          trigger_conditions?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      petty_cash: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          date: string
          description?: string | null
          id?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      petty_cash_expenses: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string
          expense_type: string
          id: string
          notes: string | null
          payment_status: string
          petty_cash_id: string
          spent_by: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          description: string
          expense_type: string
          id?: string
          notes?: string | null
          payment_status?: string
          petty_cash_id: string
          spent_by: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string
          expense_type?: string
          id?: string
          notes?: string | null
          payment_status?: string
          petty_cash_id?: string
          spent_by?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_expenses_petty_cash_id_fkey"
            columns: ["petty_cash_id"]
            isOneToOne: false
            referencedRelation: "petty_cash"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      planogram_stores: {
        Row: {
          created_at: string | null
          id: string
          planogram_id: string
          store_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          planogram_id: string
          store_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          planogram_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planogram_stores_planogram_id_fkey"
            columns: ["planogram_id"]
            isOneToOne: false
            referencedRelation: "planograms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planogram_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      planograms: {
        Row: {
          assigned_to_user_id: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          frequency: string | null
          id: string
          image_url: string
          schedule_date: string | null
          schedule_day_of_month: number | null
          schedule_day_of_week: number | null
          schedule_days_of_week: number[] | null
          schedule_time: string | null
          schedule_week_of_month: number | null
          status: string
          title: string
          updated_at: string
          zone: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          image_url: string
          schedule_date?: string | null
          schedule_day_of_month?: number | null
          schedule_day_of_week?: number | null
          schedule_days_of_week?: number[] | null
          schedule_time?: string | null
          schedule_week_of_month?: number | null
          status?: string
          title: string
          updated_at?: string
          zone: string
        }
        Update: {
          assigned_to_user_id?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          image_url?: string
          schedule_date?: string | null
          schedule_day_of_month?: number | null
          schedule_day_of_week?: number | null
          schedule_days_of_week?: number[] | null
          schedule_time?: string | null
          schedule_week_of_month?: number | null
          status?: string
          title?: string
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "planograms_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_attachments: {
        Row: {
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          pm_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          pm_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          pm_id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_attachments_pm_id_fkey"
            columns: ["pm_id"]
            isOneToOne: false
            referencedRelation: "store_preventive_maintenance"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_checklist_items: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          created_at: string
          id: string
          is_checked: boolean | null
          item_name: string
          notes: string | null
          pm_id: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean | null
          item_name: string
          notes?: string | null
          pm_id: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean | null
          item_name?: string
          notes?: string | null
          pm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_checklist_items_pm_id_fkey"
            columns: ["pm_id"]
            isOneToOne: false
            referencedRelation: "store_preventive_maintenance"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_checklist_masters: {
        Row: {
          asset_master_id: string | null
          brand: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          asset_master_id?: string | null
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          asset_master_id?: string | null
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_checklist_masters_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_master_sections: {
        Row: {
          created_at: string
          id: string
          master_id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          master_id: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          master_id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pm_master_sections_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "pm_checklist_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_master_tasks: {
        Row: {
          created_at: string
          duration_hours: number | null
          id: string
          instruction: string | null
          name: string
          section_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          duration_hours?: number | null
          id?: string
          instruction?: string | null
          name: string
          section_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          duration_hours?: number | null
          id?: string
          instruction?: string | null
          name?: string
          section_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pm_master_tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "pm_master_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          task_id: string
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_master_tasks"
            referencedColumns: ["id"]
          },
        ]
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
      potential_store_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          potential_store_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          potential_store_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          potential_store_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "potential_store_attachments_potential_store_id_fkey"
            columns: ["potential_store_id"]
            isOneToOne: false
            referencedRelation: "potential_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      potential_stores: {
        Row: {
          address: string | null
          advantages: string | null
          available_from: string | null
          budget_asked: number | null
          city: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          disadvantages: string | null
          id: string
          name: string
          notes: string | null
          pin_code: string | null
          size_sqft: number | null
          state: string | null
          status: string
          store_plan_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          advantages?: string | null
          available_from?: string | null
          budget_asked?: number | null
          city?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          disadvantages?: string | null
          id?: string
          name: string
          notes?: string | null
          pin_code?: string | null
          size_sqft?: number | null
          state?: string | null
          status?: string
          store_plan_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          advantages?: string | null
          available_from?: string | null
          budget_asked?: number | null
          city?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          disadvantages?: string | null
          id?: string
          name?: string
          notes?: string | null
          pin_code?: string | null
          size_sqft?: number | null
          state?: string | null
          status?: string
          store_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "potential_stores_store_plan_id_fkey"
            columns: ["store_plan_id"]
            isOneToOne: false
            referencedRelation: "store_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      price_rules: {
        Row: {
          category_ids: string[] | null
          created_at: string
          customer_segments: string[] | null
          days_of_week: number[] | null
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string | null
          id: string
          is_combinable: boolean | null
          max_quantity: number | null
          min_quantity: number | null
          name: string
          priority: number | null
          product_ids: string[] | null
          rule_type: string
          start_date: string | null
          status: string
          time_end: string | null
          time_start: string | null
          updated_at: string
        }
        Insert: {
          category_ids?: string[] | null
          created_at?: string
          customer_segments?: string[] | null
          days_of_week?: number[] | null
          description?: string | null
          discount_type: string
          discount_value?: number
          end_date?: string | null
          id?: string
          is_combinable?: boolean | null
          max_quantity?: number | null
          min_quantity?: number | null
          name: string
          priority?: number | null
          product_ids?: string[] | null
          rule_type: string
          start_date?: string | null
          status?: string
          time_end?: string | null
          time_start?: string | null
          updated_at?: string
        }
        Update: {
          category_ids?: string[] | null
          created_at?: string
          customer_segments?: string[] | null
          days_of_week?: number[] | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          id?: string
          is_combinable?: boolean | null
          max_quantity?: number | null
          min_quantity?: number | null
          name?: string
          priority?: number | null
          product_ids?: string[] | null
          rule_type?: string
          start_date?: string | null
          status?: string
          time_end?: string | null
          time_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          brand: string
          category: string
          cost_price: number | null
          created_at: string
          id: string
          image_url: string | null
          is_favorite: boolean | null
          min_stock: number | null
          model: string
          name: string
          price: number
          sku: string | null
          stock_qty: number | null
          tax_rate: number | null
          updated_at: string
          warranty: string
        }
        Insert: {
          barcode?: string | null
          brand: string
          category: string
          cost_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_favorite?: boolean | null
          min_stock?: number | null
          model: string
          name: string
          price: number
          sku?: string | null
          stock_qty?: number | null
          tax_rate?: number | null
          updated_at?: string
          warranty: string
        }
        Update: {
          barcode?: string | null
          brand?: string
          category?: string
          cost_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_favorite?: boolean | null
          min_stock?: number | null
          model?: string
          name?: string
          price?: number
          sku?: string | null
          stock_qty?: number | null
          tax_rate?: number | null
          updated_at?: string
          warranty?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          face_baseline_url: string | null
          id: string
          must_reset_password: boolean | null
          profile_photo_url: string | null
          reports_to: string | null
          role_id: string | null
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          email: string
          face_baseline_url?: string | null
          id: string
          must_reset_password?: boolean | null
          profile_photo_url?: string | null
          reports_to?: string | null
          role_id?: string | null
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string
          face_baseline_url?: string | null
          id?: string
          must_reset_password?: boolean | null
          profile_photo_url?: string | null
          reports_to?: string | null
          role_id?: string | null
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "user_roles_master"
            referencedColumns: ["id"]
          },
        ]
      }
      reason_codes: {
        Row: {
          accounting_impact: string
          category: string
          code: string
          created_at: string
          id: string
          name: string
          requires_approval: boolean | null
          status: string
        }
        Insert: {
          accounting_impact: string
          category: string
          code: string
          created_at?: string
          id?: string
          name: string
          requires_approval?: boolean | null
          status?: string
        }
        Update: {
          accounting_impact?: string
          category?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          requires_approval?: boolean | null
          status?: string
        }
        Relationships: []
      }
      rental_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          month_year: string
          notes: string | null
          paid_date: string | null
          rental_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          month_year: string
          notes?: string | null
          paid_date?: string | null
          rental_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          month_year?: string
          notes?: string | null
          paid_date?: string | null
          rental_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
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
      requisition_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          quantity_approved: number | null
          quantity_received: number | null
          quantity_requested: number
          quantity_shipped: number | null
          requisition_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          quantity_approved?: number | null
          quantity_received?: number | null
          quantity_requested: number
          quantity_shipped?: number | null
          requisition_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          quantity_approved?: number | null
          quantity_received?: number | null
          quantity_requested?: number
          quantity_shipped?: number | null
          requisition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisition_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      requisitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          priority: string
          requested_at: string
          requested_by: string
          requisition_number: string
          source_warehouse_id: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string
          requested_at?: string
          requested_by: string
          requisition_number: string
          source_warehouse_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string
          requested_at?: string
          requested_by?: string
          requisition_number?: string
          source_warehouse_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisitions_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          condition: string | null
          created_at: string
          id: string
          notes: string | null
          order_item_id: string
          product_id: string | null
          product_name: string
          quantity: number
          refund_amount: number
          return_id: string
          unit_price: number
        }
        Insert: {
          condition?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_item_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          refund_amount: number
          return_id: string
          unit_price: number
        }
        Update: {
          condition?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_item_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          refund_amount?: number
          return_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          order_id: string
          processed_by: string | null
          reason_code: string
          reason_notes: string | null
          refund_amount: number
          refund_method: string
          return_date: string
          return_number: string
          status: string
          store_id: string | null
          subtotal: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          order_id: string
          processed_by?: string | null
          reason_code: string
          reason_notes?: string | null
          refund_amount: number
          refund_method: string
          return_date?: string
          return_number: string
          status?: string
          store_id?: string | null
          subtotal?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          order_id?: string
          processed_by?: string | null
          reason_code?: string
          reason_notes?: string | null
          refund_amount?: number
          refund_method?: string
          return_date?: string
          return_number?: string
          status?: string
          store_id?: string | null
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      role_master: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          permissions: Json | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          permissions?: Json | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          permissions?: Json | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module_key: string
          role_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key: string
          role_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "user_roles_master"
            referencedColumns: ["id"]
          },
        ]
      }
      rtv: {
        Row: {
          approved_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          reason: string
          rtv_number: string
          shipped_at: string | null
          status: string
          store_id: string | null
          total_value: number
          vendor_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          reason: string
          rtv_number: string
          shipped_at?: string | null
          status?: string
          store_id?: string | null
          total_value?: number
          vendor_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          reason?: string
          rtv_number?: string
          shipped_at?: string | null
          status?: string
          store_id?: string | null
          total_value?: number
          vendor_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rtv_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rtv_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rtv_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      rtv_items: {
        Row: {
          batch_number: string | null
          created_at: string
          id: string
          item_id: string
          quantity: number
          reason: string
          rtv_id: string
          unit_cost: number
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          reason: string
          rtv_id: string
          unit_cost: number
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          reason?: string
          rtv_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "rtv_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rtv_items_rtv_id_fkey"
            columns: ["rtv_id"]
            isOneToOne: false
            referencedRelation: "rtv"
            referencedColumns: ["id"]
          },
        ]
      }
      schemes: {
        Row: {
          applicable_categories: string[] | null
          applicable_items: string[] | null
          applies_to: string | null
          buy_quantity: number | null
          created_at: string
          customer_segments: string[] | null
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string
          get_quantity: number | null
          id: string
          is_auto_apply: boolean | null
          max_discount_amount: number | null
          min_purchase_amount: number | null
          min_quantity: number | null
          name: string
          priority: number | null
          start_date: string
          status: string
          store_ids: string[] | null
          updated_at: string
          usage_count: number | null
          usage_limit: number | null
        }
        Insert: {
          applicable_categories?: string[] | null
          applicable_items?: string[] | null
          applies_to?: string | null
          buy_quantity?: number | null
          created_at?: string
          customer_segments?: string[] | null
          description?: string | null
          discount_type: string
          discount_value: number
          end_date: string
          get_quantity?: number | null
          id?: string
          is_auto_apply?: boolean | null
          max_discount_amount?: number | null
          min_purchase_amount?: number | null
          min_quantity?: number | null
          name: string
          priority?: number | null
          start_date: string
          status?: string
          store_ids?: string[] | null
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
        }
        Update: {
          applicable_categories?: string[] | null
          applicable_items?: string[] | null
          applies_to?: string | null
          buy_quantity?: number | null
          created_at?: string
          customer_segments?: string[] | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string
          get_quantity?: number | null
          id?: string
          is_auto_apply?: boolean | null
          max_discount_amount?: number | null
          min_purchase_amount?: number | null
          min_quantity?: number | null
          name?: string
          priority?: number | null
          start_date?: string
          status?: string
          store_ids?: string[] | null
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
        }
        Relationships: []
      }
      security_attendance: {
        Row: {
          attendance_date: string
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          guard_id: string
          id: string
          points_earned: number | null
          roster_daily_id: string | null
          status: string
        }
        Insert: {
          attendance_date: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          guard_id: string
          id?: string
          points_earned?: number | null
          roster_daily_id?: string | null
          status?: string
        }
        Update: {
          attendance_date?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          guard_id?: string
          id?: string
          points_earned?: number | null
          roster_daily_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_attendance_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "security_guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_attendance_roster_daily_id_fkey"
            columns: ["roster_daily_id"]
            isOneToOne: false
            referencedRelation: "security_roster_daily"
            referencedColumns: ["id"]
          },
        ]
      }
      security_guard_feedback: {
        Row: {
          alertness_rating: number | null
          comments: string | null
          created_at: string
          dependability_rating: number | null
          feedback_date: string
          guard_id: string
          id: string
          overall_rating: number | null
          punctuality_rating: number | null
          quality_of_service_rating: number | null
          store_id: string
          submitted_by: string
          work_ethics_rating: number | null
        }
        Insert: {
          alertness_rating?: number | null
          comments?: string | null
          created_at?: string
          dependability_rating?: number | null
          feedback_date?: string
          guard_id: string
          id?: string
          overall_rating?: number | null
          punctuality_rating?: number | null
          quality_of_service_rating?: number | null
          store_id: string
          submitted_by: string
          work_ethics_rating?: number | null
        }
        Update: {
          alertness_rating?: number | null
          comments?: string | null
          created_at?: string
          dependability_rating?: number | null
          feedback_date?: string
          guard_id?: string
          id?: string
          overall_rating?: number | null
          punctuality_rating?: number | null
          quality_of_service_rating?: number | null
          store_id?: string
          submitted_by?: string
          work_ethics_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "security_guard_feedback_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "security_guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_guard_feedback_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      security_guards: {
        Row: {
          address: string | null
          address_proof_url: string | null
          age: number | null
          blood_group: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          health_notes: string | null
          height: number | null
          id: string
          id_proof_url: string | null
          login_pin: string | null
          name: string
          phone: string
          photo_url: string | null
          previous_experience: Json | null
          references_info: Json | null
          status: string
          store_id: string | null
          total_points: number | null
          updated_at: string
          vendor_id: string | null
          weight: number | null
        }
        Insert: {
          address?: string | null
          address_proof_url?: string | null
          age?: number | null
          blood_group?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          health_notes?: string | null
          height?: number | null
          id?: string
          id_proof_url?: string | null
          login_pin?: string | null
          name: string
          phone: string
          photo_url?: string | null
          previous_experience?: Json | null
          references_info?: Json | null
          status?: string
          store_id?: string | null
          total_points?: number | null
          updated_at?: string
          vendor_id?: string | null
          weight?: number | null
        }
        Update: {
          address?: string | null
          address_proof_url?: string | null
          age?: number | null
          blood_group?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          health_notes?: string | null
          height?: number | null
          id?: string
          id_proof_url?: string | null
          login_pin?: string | null
          name?: string
          phone?: string
          photo_url?: string | null
          previous_experience?: Json | null
          references_info?: Json | null
          status?: string
          store_id?: string | null
          total_points?: number | null
          updated_at?: string
          vendor_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "security_guards_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_guards_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      security_patrol_points: {
        Row: {
          created_at: string
          floor: string | null
          id: string
          is_active: boolean | null
          location_description: string | null
          name: string
          qr_code: string
          store_id: string
          updated_at: string
          zone: string | null
        }
        Insert: {
          created_at?: string
          floor?: string | null
          id?: string
          is_active?: boolean | null
          location_description?: string | null
          name: string
          qr_code: string
          store_id: string
          updated_at?: string
          zone?: string | null
        }
        Update: {
          created_at?: string
          floor?: string | null
          id?: string
          is_active?: boolean | null
          location_description?: string | null
          name?: string
          qr_code?: string
          store_id?: string
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_patrol_points_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      security_patrol_routes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          shift_type: string
          store_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          shift_type: string
          store_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          shift_type?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_patrol_routes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      security_patrol_visits: {
        Row: {
          created_at: string
          gps_latitude: number | null
          gps_longitude: number | null
          guard_id: string
          id: string
          is_on_time: boolean | null
          notes: string | null
          patrol_point_id: string
          route_point_id: string | null
          scanned_at: string
          scheduled_time: string | null
          selfie_url: string | null
        }
        Insert: {
          created_at?: string
          gps_latitude?: number | null
          gps_longitude?: number | null
          guard_id: string
          id?: string
          is_on_time?: boolean | null
          notes?: string | null
          patrol_point_id: string
          route_point_id?: string | null
          scanned_at?: string
          scheduled_time?: string | null
          selfie_url?: string | null
        }
        Update: {
          created_at?: string
          gps_latitude?: number | null
          gps_longitude?: number | null
          guard_id?: string
          id?: string
          is_on_time?: boolean | null
          notes?: string | null
          patrol_point_id?: string
          route_point_id?: string | null
          scanned_at?: string
          scheduled_time?: string | null
          selfie_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_patrol_visits_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "security_guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_patrol_visits_patrol_point_id_fkey"
            columns: ["patrol_point_id"]
            isOneToOne: false
            referencedRelation: "security_patrol_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_patrol_visits_route_point_id_fkey"
            columns: ["route_point_id"]
            isOneToOne: false
            referencedRelation: "security_route_points"
            referencedColumns: ["id"]
          },
        ]
      }
      security_points_log: {
        Row: {
          created_at: string
          guard_id: string
          id: string
          points: number
          reason: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          guard_id: string
          id?: string
          points: number
          reason: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          guard_id?: string
          id?: string
          points?: number
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_points_log_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "security_guards"
            referencedColumns: ["id"]
          },
        ]
      }
      security_roster_daily: {
        Row: {
          assignment_date: string
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          end_time: string
          guard_id: string
          id: string
          notes: string | null
          shift_type: string
          start_time: string
          status: string | null
          store_id: string
        }
        Insert: {
          assignment_date: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          end_time: string
          guard_id: string
          id?: string
          notes?: string | null
          shift_type: string
          start_time: string
          status?: string | null
          store_id: string
        }
        Update: {
          assignment_date?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          end_time?: string
          guard_id?: string
          id?: string
          notes?: string | null
          shift_type?: string
          start_time?: string
          status?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_roster_daily_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "security_guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_roster_daily_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      security_roster_templates: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          guard_id: string
          id: string
          is_active: boolean | null
          shift_type: string
          start_time: string
          store_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          guard_id: string
          id?: string
          is_active?: boolean | null
          shift_type: string
          start_time: string
          store_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          guard_id?: string
          id?: string
          is_active?: boolean | null
          shift_type?: string
          start_time?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_roster_templates_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "security_guards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_roster_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      security_route_points: {
        Row: {
          created_at: string
          id: string
          patrol_point_id: string
          route_id: string
          scheduled_time: string
          sequence_order: number
          tolerance_minutes: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          patrol_point_id: string
          route_id: string
          scheduled_time: string
          sequence_order: number
          tolerance_minutes?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          patrol_point_id?: string
          route_id?: string
          scheduled_time?: string
          sequence_order?: number
          tolerance_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "security_route_points_patrol_point_id_fkey"
            columns: ["patrol_point_id"]
            isOneToOne: false
            referencedRelation: "security_patrol_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_route_points_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "security_patrol_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contract_assets: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          service_contract_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          service_contract_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          service_contract_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contract_assets_service_contract_id_fkey"
            columns: ["service_contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contract_attachments: {
        Row: {
          attachment_type: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          service_contract_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          attachment_type?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          service_contract_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          attachment_type?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          service_contract_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_attachments_service_contract_id_fkey"
            columns: ["service_contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contract_locations: {
        Row: {
          created_at: string
          id: string
          service_contract_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_contract_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          service_contract_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_locations_service_contract_id_fkey"
            columns: ["service_contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contract_locations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contract_vendor_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_accessed_at: string | null
          service_contract_id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          service_contract_id: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          service_contract_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_vendor_links_service_contract_id_fkey"
            columns: ["service_contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contracts: {
        Row: {
          after_hours_multiplier: number | null
          annual_escalation_percent: number | null
          auto_renewal: boolean | null
          consumables_included: boolean | null
          consumables_limit: number | null
          contract_number: string
          contract_type: string
          contract_value: number
          created_at: string
          customer_address: string | null
          customer_name: string
          effective_date: string
          end_date: string
          escalation_l1_email: string | null
          escalation_l1_name: string | null
          escalation_l1_phone: string | null
          escalation_l2_email: string | null
          escalation_l2_name: string | null
          escalation_l2_phone: string | null
          escalation_l3_email: string | null
          escalation_l3_name: string | null
          escalation_l3_phone: string | null
          exclusions: string | null
          id: string
          invoice_frequency: string | null
          labour_hours_included: number | null
          labour_included: boolean | null
          labour_rate_per_hour: number | null
          notes: string | null
          p1_resolution_hrs: number | null
          p1_response_mins: number | null
          p2_resolution_hrs: number | null
          p2_response_mins: number | null
          p3_resolution_hrs: number | null
          p3_response_mins: number | null
          p4_resolution_hrs: number | null
          p4_response_mins: number | null
          payment_terms_days: number | null
          penalty_applicable: boolean | null
          penalty_calculation_basis: string | null
          penalty_grace_period_days: number | null
          penalty_max_percent: number | null
          penalty_notes: string | null
          penalty_rate_percent: number | null
          penalty_type: string | null
          pm_checklist_attached: boolean | null
          pm_checklist_items: string[] | null
          pm_frequency: string | null
          pm_task_type: string | null
          pricing_model: string | null
          renewal_notice_days: number | null
          service_provider_id: string | null
          service_types: string[] | null
          sla_penalties: boolean | null
          sla_penalty_details: string | null
          spares_coverage_percent: number | null
          spares_excluded_items: string | null
          spares_included: boolean | null
          spares_max_value: number | null
          start_date: string
          status: string
          support_hours: string | null
          support_hours_custom: string | null
          target_uptime_percent: number | null
          travel_included: boolean | null
          travel_radius_km: number | null
          travel_rate_per_km: number | null
          updated_at: string
          uptime_measurement_method: string | null
          vendor_update_status: string | null
          vendor_updated_at: string | null
          visit_charge: number | null
        }
        Insert: {
          after_hours_multiplier?: number | null
          annual_escalation_percent?: number | null
          auto_renewal?: boolean | null
          consumables_included?: boolean | null
          consumables_limit?: number | null
          contract_number: string
          contract_type?: string
          contract_value?: number
          created_at?: string
          customer_address?: string | null
          customer_name: string
          effective_date: string
          end_date: string
          escalation_l1_email?: string | null
          escalation_l1_name?: string | null
          escalation_l1_phone?: string | null
          escalation_l2_email?: string | null
          escalation_l2_name?: string | null
          escalation_l2_phone?: string | null
          escalation_l3_email?: string | null
          escalation_l3_name?: string | null
          escalation_l3_phone?: string | null
          exclusions?: string | null
          id?: string
          invoice_frequency?: string | null
          labour_hours_included?: number | null
          labour_included?: boolean | null
          labour_rate_per_hour?: number | null
          notes?: string | null
          p1_resolution_hrs?: number | null
          p1_response_mins?: number | null
          p2_resolution_hrs?: number | null
          p2_response_mins?: number | null
          p3_resolution_hrs?: number | null
          p3_response_mins?: number | null
          p4_resolution_hrs?: number | null
          p4_response_mins?: number | null
          payment_terms_days?: number | null
          penalty_applicable?: boolean | null
          penalty_calculation_basis?: string | null
          penalty_grace_period_days?: number | null
          penalty_max_percent?: number | null
          penalty_notes?: string | null
          penalty_rate_percent?: number | null
          penalty_type?: string | null
          pm_checklist_attached?: boolean | null
          pm_checklist_items?: string[] | null
          pm_frequency?: string | null
          pm_task_type?: string | null
          pricing_model?: string | null
          renewal_notice_days?: number | null
          service_provider_id?: string | null
          service_types?: string[] | null
          sla_penalties?: boolean | null
          sla_penalty_details?: string | null
          spares_coverage_percent?: number | null
          spares_excluded_items?: string | null
          spares_included?: boolean | null
          spares_max_value?: number | null
          start_date: string
          status?: string
          support_hours?: string | null
          support_hours_custom?: string | null
          target_uptime_percent?: number | null
          travel_included?: boolean | null
          travel_radius_km?: number | null
          travel_rate_per_km?: number | null
          updated_at?: string
          uptime_measurement_method?: string | null
          vendor_update_status?: string | null
          vendor_updated_at?: string | null
          visit_charge?: number | null
        }
        Update: {
          after_hours_multiplier?: number | null
          annual_escalation_percent?: number | null
          auto_renewal?: boolean | null
          consumables_included?: boolean | null
          consumables_limit?: number | null
          contract_number?: string
          contract_type?: string
          contract_value?: number
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          effective_date?: string
          end_date?: string
          escalation_l1_email?: string | null
          escalation_l1_name?: string | null
          escalation_l1_phone?: string | null
          escalation_l2_email?: string | null
          escalation_l2_name?: string | null
          escalation_l2_phone?: string | null
          escalation_l3_email?: string | null
          escalation_l3_name?: string | null
          escalation_l3_phone?: string | null
          exclusions?: string | null
          id?: string
          invoice_frequency?: string | null
          labour_hours_included?: number | null
          labour_included?: boolean | null
          labour_rate_per_hour?: number | null
          notes?: string | null
          p1_resolution_hrs?: number | null
          p1_response_mins?: number | null
          p2_resolution_hrs?: number | null
          p2_response_mins?: number | null
          p3_resolution_hrs?: number | null
          p3_response_mins?: number | null
          p4_resolution_hrs?: number | null
          p4_response_mins?: number | null
          payment_terms_days?: number | null
          penalty_applicable?: boolean | null
          penalty_calculation_basis?: string | null
          penalty_grace_period_days?: number | null
          penalty_max_percent?: number | null
          penalty_notes?: string | null
          penalty_rate_percent?: number | null
          penalty_type?: string | null
          pm_checklist_attached?: boolean | null
          pm_checklist_items?: string[] | null
          pm_frequency?: string | null
          pm_task_type?: string | null
          pricing_model?: string | null
          renewal_notice_days?: number | null
          service_provider_id?: string | null
          service_types?: string[] | null
          sla_penalties?: boolean | null
          sla_penalty_details?: string | null
          spares_coverage_percent?: number | null
          spares_excluded_items?: string | null
          spares_included?: boolean | null
          spares_max_value?: number | null
          start_date?: string
          status?: string
          support_hours?: string | null
          support_hours_custom?: string | null
          target_uptime_percent?: number | null
          travel_included?: boolean | null
          travel_radius_km?: number | null
          travel_rate_per_km?: number | null
          updated_at?: string
          uptime_measurement_method?: string | null
          vendor_update_status?: string | null
          vendor_updated_at?: string | null
          visit_charge?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_contracts_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      service_ticket_adherence: {
        Row: {
          actual_value: string | null
          category: string
          checked_at: string | null
          checked_by: string | null
          created_at: string
          expected_value: string | null
          id: string
          is_compliant: boolean | null
          item_name: string
          notes: string | null
          service_ticket_id: string
          weight: number | null
        }
        Insert: {
          actual_value?: string | null
          category: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          expected_value?: string | null
          id?: string
          is_compliant?: boolean | null
          item_name: string
          notes?: string | null
          service_ticket_id: string
          weight?: number | null
        }
        Update: {
          actual_value?: string | null
          category?: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          expected_value?: string | null
          id?: string
          is_compliant?: boolean | null
          item_name?: string
          notes?: string | null
          service_ticket_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_ticket_adherence_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      service_ticket_labour: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_billable: boolean
          is_covered_by_contract: boolean
          notes: string | null
          ticket_id: string
          total_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_billable?: boolean
          is_covered_by_contract?: boolean
          notes?: string | null
          ticket_id: string
          total_cost: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_billable?: boolean
          is_covered_by_contract?: boolean
          notes?: string | null
          ticket_id?: string
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_ticket_labour_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      service_ticket_spares: {
        Row: {
          asset_master_id: string | null
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string | null
          is_billable: boolean
          is_covered_by_contract: boolean
          notes: string | null
          quantity: number
          spare_name: string
          ticket_id: string
          total_cost: number | null
          unit_cost: number
        }
        Insert: {
          asset_master_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string | null
          is_billable?: boolean
          is_covered_by_contract?: boolean
          notes?: string | null
          quantity?: number
          spare_name: string
          ticket_id: string
          total_cost?: number | null
          unit_cost: number
        }
        Update: {
          asset_master_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string | null
          is_billable?: boolean
          is_covered_by_contract?: boolean
          notes?: string | null
          quantity?: number
          spare_name?: string
          ticket_id?: string
          total_cost?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_ticket_spares_asset_master_id_fkey"
            columns: ["asset_master_id"]
            isOneToOne: false
            referencedRelation: "asset_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ticket_spares_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ticket_spares_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      service_tickets: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          category: string
          closed_at: string | null
          created_at: string
          description: string | null
          first_response_at: string | null
          id: string
          labour_cost: number | null
          labour_hours: number | null
          manager_confirmed: boolean | null
          manager_confirmed_at: string | null
          manager_feedback: string | null
          priority: string
          reported_at: string
          reported_by: string
          resolution_time_hours: number | null
          resolved_at: string | null
          resolved_by: string | null
          response_time_mins: number | null
          service_contract_id: string | null
          service_score: number | null
          sla_due_date: string | null
          sla_resolution_met: boolean | null
          sla_response_met: boolean | null
          solution_provided: string | null
          spares_cost: number | null
          spares_used: boolean | null
          started_at: string | null
          status: string
          store_id: string
          ticket_number: string
          title: string
          travel_cost: number | null
          travel_distance_km: number | null
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          description?: string | null
          first_response_at?: string | null
          id?: string
          labour_cost?: number | null
          labour_hours?: number | null
          manager_confirmed?: boolean | null
          manager_confirmed_at?: string | null
          manager_feedback?: string | null
          priority?: string
          reported_at?: string
          reported_by: string
          resolution_time_hours?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_time_mins?: number | null
          service_contract_id?: string | null
          service_score?: number | null
          sla_due_date?: string | null
          sla_resolution_met?: boolean | null
          sla_response_met?: boolean | null
          solution_provided?: string | null
          spares_cost?: number | null
          spares_used?: boolean | null
          started_at?: string | null
          status?: string
          store_id: string
          ticket_number: string
          title: string
          travel_cost?: number | null
          travel_distance_km?: number | null
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          description?: string | null
          first_response_at?: string | null
          id?: string
          labour_cost?: number | null
          labour_hours?: number | null
          manager_confirmed?: boolean | null
          manager_confirmed_at?: string | null
          manager_feedback?: string | null
          priority?: string
          reported_at?: string
          reported_by?: string
          resolution_time_hours?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_time_mins?: number | null
          service_contract_id?: string | null
          service_score?: number | null
          sla_due_date?: string | null
          sla_resolution_met?: boolean | null
          sla_response_met?: boolean | null
          solution_provided?: string | null
          spares_cost?: number | null
          spares_used?: boolean | null
          started_at?: string | null
          status?: string
          store_id?: string
          ticket_number?: string
          title?: string
          travel_cost?: number | null
          travel_distance_km?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_service_contract_id_fkey"
            columns: ["service_contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier_name: string | null
          created_at: string
          delivered_at: string | null
          dispatched_at: string | null
          estimated_arrival: string | null
          id: string
          requisition_id: string
          shipment_number: string
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier_name?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          estimated_arrival?: string | null
          id?: string
          requisition_id: string
          shipment_number: string
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier_name?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          estimated_arrival?: string | null
          id?: string
          requisition_id?: string
          shipment_number?: string
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
        ]
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
      sqft_budget_master: {
        Row: {
          created_at: string
          effective_from: string | null
          id: string
          max_sqft: number | null
          min_sqft: number | null
          name: string | null
          price_per_sqft: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          id?: string
          max_sqft?: number | null
          min_sqft?: number | null
          name?: string | null
          price_per_sqft: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          id?: string
          max_sqft?: number | null
          min_sqft?: number | null
          name?: string | null
          price_per_sqft?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          adjustment_number: string
          adjustment_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          id: string
          item_id: string
          notes: string | null
          physical_quantity: number
          reason_code_id: string
          status: string
          store_id: string | null
          system_quantity: number
          total_value: number
          unit_cost: number
          variance: number
          warehouse_id: string | null
        }
        Insert: {
          adjustment_number: string
          adjustment_type: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          item_id: string
          notes?: string | null
          physical_quantity: number
          reason_code_id: string
          status?: string
          store_id?: string | null
          system_quantity: number
          total_value: number
          unit_cost: number
          variance: number
          warehouse_id?: string | null
        }
        Update: {
          adjustment_number?: string
          adjustment_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          item_id?: string
          notes?: string | null
          physical_quantity?: number
          reason_code_id?: string
          status?: string
          store_id?: string | null
          system_quantity?: number
          total_value?: number
          unit_cost?: number
          variance?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_reason_code_id_fkey"
            columns: ["reason_code_id"]
            isOneToOne: false
            referencedRelation: "reason_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ledger: {
        Row: {
          batch_number: string | null
          created_at: string
          created_by: string
          expiry_date: string | null
          id: string
          item_id: string
          location_id: string
          location_type: string
          notes: string | null
          quantity_change: number
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          unit_cost: number
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          created_by?: string
          expiry_date?: string | null
          id?: string
          item_id: string
          location_id: string
          location_type: string
          notes?: string | null
          quantity_change: number
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          unit_cost: number
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          created_by?: string
          expiry_date?: string | null
          id?: string
          item_id?: string
          location_id?: string
          location_type?: string
          notes?: string | null
          quantity_change?: number
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      store_asset_deployments: {
        Row: {
          asset_id: string
          created_at: string
          deployed_date: string
          feedback: string | null
          id: string
          notes: string | null
          removed_date: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          deployed_date?: string
          feedback?: string | null
          id?: string
          notes?: string | null
          removed_date?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          deployed_date?: string
          feedback?: string | null
          id?: string
          notes?: string | null
          removed_date?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_asset_deployments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_asset_deployments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_budget_items: {
        Row: {
          actual_amount: number | null
          ai_predicted_amount: number | null
          budget_id: string
          budgeted_amount: number
          created_at: string
          description: string | null
          group_name: string
          id: string
          is_custom: boolean | null
          item_name: string
          item_type: string
          master_item_id: string | null
          sort_order: number | null
          updated_at: string
          variance: number | null
        }
        Insert: {
          actual_amount?: number | null
          ai_predicted_amount?: number | null
          budget_id: string
          budgeted_amount?: number
          created_at?: string
          description?: string | null
          group_name: string
          id?: string
          is_custom?: boolean | null
          item_name: string
          item_type?: string
          master_item_id?: string | null
          sort_order?: number | null
          updated_at?: string
          variance?: number | null
        }
        Update: {
          actual_amount?: number | null
          ai_predicted_amount?: number | null
          budget_id?: string
          budgeted_amount?: number
          created_at?: string
          description?: string | null
          group_name?: string
          id?: string
          is_custom?: boolean | null
          item_name?: string
          item_type?: string
          master_item_id?: string | null
          sort_order?: number | null
          updated_at?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "store_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_budget_items_master_item_id_fkey"
            columns: ["master_item_id"]
            isOneToOne: false
            referencedRelation: "budget_master_items"
            referencedColumns: ["id"]
          },
        ]
      }
      store_budgets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          budget_month: number | null
          budget_type: string
          created_at: string
          fiscal_year: number
          id: string
          notes: string | null
          rejection_reason: string | null
          status: string | null
          store_id: string
          submitted_at: string | null
          submitted_by: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          budget_month?: number | null
          budget_type?: string
          created_at?: string
          fiscal_year: number
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string | null
          store_id: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          budget_month?: number | null
          budget_type?: string
          created_at?: string
          fiscal_year?: number
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string | null
          store_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_budgets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_contacts: {
        Row: {
          contact_type: string
          created_at: string
          designation: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          contact_type?: string
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          contact_type?: string
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_contacts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_operating_hours: {
        Row: {
          close_time: string
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string
          store_id: string
        }
        Insert: {
          close_time: string
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time: string
          store_id: string
        }
        Update: {
          close_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_operating_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_plan_approval_levels: {
        Row: {
          acted_at: string | null
          approver_role: string
          approver_user_id: string | null
          comments: string | null
          created_at: string
          id: string
          level_order: number
          status: string
          store_plan_id: string
        }
        Insert: {
          acted_at?: string | null
          approver_role: string
          approver_user_id?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          level_order?: number
          status?: string
          store_plan_id: string
        }
        Update: {
          acted_at?: string | null
          approver_role?: string
          approver_user_id?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          level_order?: number
          status?: string
          store_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_plan_approval_levels_store_plan_id_fkey"
            columns: ["store_plan_id"]
            isOneToOne: false
            referencedRelation: "store_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      store_plans: {
        Row: {
          approval_status: string
          city: string | null
          created_at: string
          created_by: string | null
          current_approval_level: number | null
          description: string | null
          estimated_budget: number | null
          franchisee_identified: boolean
          id: string
          location: string | null
          name: string
          region: string | null
          state: string | null
          status: string
          store_identified: boolean
          target_open_date: string | null
          target_store_identification_date: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          current_approval_level?: number | null
          description?: string | null
          estimated_budget?: number | null
          franchisee_identified?: boolean
          id?: string
          location?: string | null
          name: string
          region?: string | null
          state?: string | null
          status?: string
          store_identified?: boolean
          target_open_date?: string | null
          target_store_identification_date?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          current_approval_level?: number | null
          description?: string | null
          estimated_budget?: number | null
          franchisee_identified?: boolean
          id?: string
          location?: string | null
          name?: string
          region?: string | null
          state?: string | null
          status?: string
          store_identified?: boolean
          target_open_date?: string | null
          target_store_identification_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_preventive_maintenance: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          frequency: string
          id: string
          manager_confirmed: boolean | null
          manager_confirmed_at: string | null
          manager_feedback: string | null
          scheduled_date: string
          status: string
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          manager_confirmed?: boolean | null
          manager_confirmed_at?: string | null
          manager_feedback?: string | null
          scheduled_date: string
          status?: string
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          manager_confirmed?: boolean | null
          manager_confirmed_at?: string | null
          manager_feedback?: string | null
          scheduled_date?: string
          status?: string
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_preventive_maintenance_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_preventive_maintenance_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_target_members: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          month: number | null
          store_target_id: string
          target_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          month?: number | null
          store_target_id: string
          target_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          month?: number | null
          store_target_id?: string
          target_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_target_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_target_members_store_target_id_fkey"
            columns: ["store_target_id"]
            isOneToOne: false
            referencedRelation: "store_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      store_target_months: {
        Row: {
          created_at: string
          id: string
          month: number
          store_target_id: string
          target_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          store_target_id: string
          target_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          store_target_id?: string
          target_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_target_months_store_target_id_fkey"
            columns: ["store_target_id"]
            isOneToOne: false
            referencedRelation: "store_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      store_target_products: {
        Row: {
          created_at: string
          id: string
          month: number | null
          product_id: string
          store_target_id: string
          target_amount: number
          target_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month?: number | null
          product_id: string
          store_target_id: string
          target_amount: number
          target_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: number | null
          product_id?: string
          store_target_id?: string
          target_amount?: number
          target_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_target_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_target_products_store_target_id_fkey"
            columns: ["store_target_id"]
            isOneToOne: false
            referencedRelation: "store_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      store_targets: {
        Row: {
          annual_target: number
          created_at: string
          created_by: string | null
          currency: string | null
          fiscal_year: number
          id: string
          notes: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          annual_target: number
          created_at?: string
          created_by?: string | null
          currency?: string | null
          fiscal_year: number
          id?: string
          notes?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          annual_target?: number
          created_at?: string
          created_by?: string | null
          currency?: string | null
          fiscal_year?: number
          id?: string
          notes?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_targets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_transfer_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          notes: string | null
          quantity_approved: number | null
          quantity_received: number | null
          quantity_requested: number
          quantity_sent: number | null
          transfer_id: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          quantity_approved?: number | null
          quantity_received?: number | null
          quantity_requested: number
          quantity_sent?: number | null
          transfer_id: string
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          quantity_approved?: number | null
          quantity_received?: number | null
          quantity_requested?: number
          quantity_sent?: number | null
          transfer_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_transfer_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "store_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      store_transfers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          dispatched_at: string | null
          from_store_id: string
          id: string
          notes: string | null
          priority: string
          received_at: string | null
          received_by: string | null
          requested_at: string
          requested_by: string
          status: string
          to_store_id: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          dispatched_at?: string | null
          from_store_id: string
          id?: string
          notes?: string | null
          priority?: string
          received_at?: string | null
          received_by?: string | null
          requested_at?: string
          requested_by: string
          status?: string
          to_store_id: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          dispatched_at?: string | null
          from_store_id?: string
          id?: string
          notes?: string | null
          priority?: string
          received_at?: string | null
          received_by?: string | null
          requested_at?: string
          requested_by?: string
          status?: string
          to_store_id?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_transfers_from_store_id_fkey"
            columns: ["from_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transfers_to_store_id_fkey"
            columns: ["to_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_user_access: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_user_access_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string
          assets: number
          created_at: string
          id: string
          is_restricted: boolean
          manager: string
          manager_id: string | null
          name: string
          phone: string
          status: string
          store_size_sqft: number | null
          updated_at: string
        }
        Insert: {
          address: string
          assets?: number
          created_at?: string
          id?: string
          is_restricted?: boolean
          manager: string
          manager_id?: string | null
          name: string
          phone: string
          status?: string
          store_size_sqft?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          assets?: number
          created_at?: string
          id?: string
          is_restricted?: boolean
          manager?: string
          manager_id?: string | null
          name?: string
          phone?: string
          status?: string
          store_size_sqft?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          barcode_scanned: string | null
          completed_by: string
          completion_time: string
          created_at: string
          device_info: Json | null
          gps_address: string | null
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          is_on_time: boolean
          notes: string | null
          photo_evidence_url: string | null
          task_instance_id: string
        }
        Insert: {
          barcode_scanned?: string | null
          completed_by: string
          completion_time?: string
          created_at?: string
          device_info?: Json | null
          gps_address?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          is_on_time?: boolean
          notes?: string | null
          photo_evidence_url?: string | null
          task_instance_id: string
        }
        Update: {
          barcode_scanned?: string | null
          completed_by?: string
          completion_time?: string
          created_at?: string
          device_info?: Json | null
          gps_address?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          is_on_time?: boolean
          notes?: string | null
          photo_evidence_url?: string | null
          task_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      task_escalations: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          escalated_to: string
          escalation_level: number
          escalation_reason: string | null
          id: string
          task_instance_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          escalated_to: string
          escalation_level?: number
          escalation_reason?: string | null
          id?: string
          task_instance_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          escalated_to?: string
          escalation_level?: number
          escalation_reason?: string | null
          id?: string
          task_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_escalations_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      task_instances: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          due_time: string | null
          escalated_at: string | null
          escalated_to: string | null
          handed_over_at: string | null
          handed_over_from: string | null
          id: string
          notes: string | null
          role_id: string
          scheduled_date: string
          scheduled_time: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_instance_status"]
          store_id: string
          task_id: string
          template_item_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          due_time?: string | null
          escalated_at?: string | null
          escalated_to?: string | null
          handed_over_at?: string | null
          handed_over_from?: string | null
          id?: string
          notes?: string | null
          role_id: string
          scheduled_date: string
          scheduled_time?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_instance_status"]
          store_id: string
          task_id: string
          template_item_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          due_time?: string | null
          escalated_at?: string | null
          escalated_to?: string | null
          handed_over_at?: string | null
          handed_over_from?: string | null
          id?: string
          notes?: string | null
          role_id?: string
          scheduled_date?: string
          scheduled_time?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_instance_status"]
          store_id?: string
          task_id?: string
          template_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_instances_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "task_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      task_master: {
        Row: {
          category: Database["public"]["Enums"]["task_category"]
          created_at: string
          description: string | null
          estimated_duration_mins: number | null
          id: string
          name: string
          qr_code_value: string | null
          requires_barcode_scan: boolean | null
          requires_gps_verification: boolean | null
          requires_photo_evidence: boolean | null
          sop_image_url: string | null
          sop_video_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["task_category"]
          created_at?: string
          description?: string | null
          estimated_duration_mins?: number | null
          id?: string
          name: string
          qr_code_value?: string | null
          requires_barcode_scan?: boolean | null
          requires_gps_verification?: boolean | null
          requires_photo_evidence?: boolean | null
          sop_image_url?: string | null
          sop_video_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          description?: string | null
          estimated_duration_mins?: number | null
          id?: string
          name?: string
          qr_code_value?: string | null
          requires_barcode_scan?: boolean | null
          requires_gps_verification?: boolean | null
          requires_photo_evidence?: boolean | null
          sop_image_url?: string | null
          sop_video_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_template: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      task_template_items: {
        Row: {
          created_at: string
          frequency_id: string
          id: string
          is_mandatory: boolean | null
          periodic_interval_mins: number | null
          priority: number | null
          role_id: string
          task_id: string
          template_id: string
          time_offset_mins: number | null
          time_window: Database["public"]["Enums"]["task_time_window"]
        }
        Insert: {
          created_at?: string
          frequency_id: string
          id?: string
          is_mandatory?: boolean | null
          periodic_interval_mins?: number | null
          priority?: number | null
          role_id: string
          task_id: string
          template_id: string
          time_offset_mins?: number | null
          time_window?: Database["public"]["Enums"]["task_time_window"]
        }
        Update: {
          created_at?: string
          frequency_id?: string
          id?: string
          is_mandatory?: boolean | null
          periodic_interval_mins?: number | null
          priority?: number | null
          role_id?: string
          task_id?: string
          template_id?: string
          time_offset_mins?: number | null
          time_window?: Database["public"]["Enums"]["task_time_window"]
        }
        Relationships: [
          {
            foreignKeyName: "task_template_items_frequency_id_fkey"
            columns: ["frequency_id"]
            isOneToOne: false
            referencedRelation: "frequency_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_template_items_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_template_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_template"
            referencedColumns: ["id"]
          },
        ]
      }
      training_recommendations: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          employee_id: string
          id: string
          priority: string | null
          review_id: string | null
          status: string | null
          target_completion_date: string | null
          training_topic: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          employee_id: string
          id?: string
          priority?: string | null
          review_id?: string | null
          status?: string | null
          target_completion_date?: string | null
          training_topic: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string
          id?: string
          priority?: string | null
          review_id?: string | null
          status?: string | null
          target_completion_date?: string | null
          training_topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_recommendations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_recommendations_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_set_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_set_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_set_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_set_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string
          id: string
          module_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string
          id?: string
          module_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string
          id?: string
          module_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles_master: {
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
      utility_readings: {
        Row: {
          asset_id: string | null
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
          asset_id?: string | null
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
          asset_id?: string | null
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
            foreignKeyName: "utility_readings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
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
      vm_compliance_tasks: {
        Row: {
          assigned_to: string | null
          assigned_to_user_id: string | null
          compliance_status: string
          created_at: string
          description: string | null
          due_date: string
          frequency: string
          id: string
          is_recurring: boolean | null
          match_percentage: number | null
          parent_task_id: string | null
          planogram_id: string
          review_status: string | null
          scheduled_end_time: string | null
          scheduled_start_time: string | null
          status: string
          store_id: string
          submission_notes: string | null
          submitted_at: string | null
          submitted_latitude: number | null
          submitted_location_address: string | null
          submitted_longitude: number | null
          submitted_photo_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_user_id?: string | null
          compliance_status?: string
          created_at?: string
          description?: string | null
          due_date: string
          frequency?: string
          id?: string
          is_recurring?: boolean | null
          match_percentage?: number | null
          parent_task_id?: string | null
          planogram_id: string
          review_status?: string | null
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          status?: string
          store_id: string
          submission_notes?: string | null
          submitted_at?: string | null
          submitted_latitude?: number | null
          submitted_location_address?: string | null
          submitted_longitude?: number | null
          submitted_photo_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          assigned_to_user_id?: string | null
          compliance_status?: string
          created_at?: string
          description?: string | null
          due_date?: string
          frequency?: string
          id?: string
          is_recurring?: boolean | null
          match_percentage?: number | null
          parent_task_id?: string | null
          planogram_id?: string
          review_status?: string | null
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          status?: string
          store_id?: string
          submission_notes?: string | null
          submitted_at?: string | null
          submitted_latitude?: number | null
          submitted_location_address?: string | null
          submitted_longitude?: number | null
          submitted_photo_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vm_compliance_tasks_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vm_compliance_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "vm_compliance_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vm_compliance_tasks_planogram_id_fkey"
            columns: ["planogram_id"]
            isOneToOne: false
            referencedRelation: "planograms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vm_compliance_tasks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      vm_correction_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          original_task_id: string
          review_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          original_task_id: string
          review_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          original_task_id?: string
          review_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vm_correction_tasks_original_task_id_fkey"
            columns: ["original_task_id"]
            isOneToOne: false
            referencedRelation: "vm_compliance_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vm_correction_tasks_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "vm_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      vm_photo_submissions: {
        Row: {
          captured_at: string
          created_at: string
          id: string
          image_url: string
          latitude: number | null
          location_address: string | null
          longitude: number | null
          notes: string | null
          submitted_by: string
          task_id: string
        }
        Insert: {
          captured_at?: string
          created_at?: string
          id?: string
          image_url: string
          latitude?: number | null
          location_address?: string | null
          longitude?: number | null
          notes?: string | null
          submitted_by?: string
          task_id: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          id?: string
          image_url?: string
          latitude?: number | null
          location_address?: string | null
          longitude?: number | null
          notes?: string | null
          submitted_by?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vm_photo_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "vm_compliance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      vm_reviews: {
        Row: {
          annotations: Json | null
          feedback: string | null
          id: string
          rating: number
          reviewed_at: string
          reviewed_by: string
          status: string
          submission_id: string
          task_id: string
        }
        Insert: {
          annotations?: Json | null
          feedback?: string | null
          id?: string
          rating: number
          reviewed_at?: string
          reviewed_by?: string
          status: string
          submission_id: string
          task_id: string
        }
        Update: {
          annotations?: Json | null
          feedback?: string | null
          id?: string
          rating?: number
          reviewed_at?: string
          reviewed_by?: string
          status?: string
          submission_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vm_reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "vm_photo_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vm_reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "vm_compliance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          capacity: number | null
          created_at: string
          id: string
          lead_time_days: number | null
          location: string
          name: string
          status: string
          updated_at: string
          warehouse_type: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          created_at?: string
          id?: string
          lead_time_days?: number | null
          location: string
          name: string
          status?: string
          updated_at?: string
          warehouse_type?: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
          created_at?: string
          id?: string
          lead_time_days?: number | null
          location?: string
          name?: string
          status?: string
          updated_at?: string
          warehouse_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_hierarchy_accessible_users: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_role_permissions_for_user: {
        Args: { _user_id: string }
        Returns: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          module_key: string
        }[]
      }
      get_subordinate_user_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          module_key: string
        }[]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_subordinate: {
        Args: { _manager_id: string; _user_id: string }
        Returns: boolean
      }
      is_valid_vendor_token: {
        Args: { contract_id: string; vendor_token: string }
        Returns: boolean
      }
      mark_overdue_compliance_tasks: { Args: never; Returns: undefined }
      search_knowledge_base: {
        Args: { search_query: string }
        Returns: {
          ai_generated: boolean | null
          ai_generated_at: string | null
          article_type: string
          asset_master_id: string | null
          category: string
          content: string
          created_at: string
          created_by: string | null
          donts: string[] | null
          dos: string[] | null
          helpful_count: number | null
          id: string
          keywords: string[] | null
          process_steps: string[] | null
          sme_names: string[] | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          video_urls: string[] | null
          views_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "knowledge_base_articles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      frequency_type: "daily" | "weekly" | "monthly" | "custom"
      shift_type: "morning" | "afternoon" | "evening" | "night"
      task_category:
        | "cleaning"
        | "inventory"
        | "security"
        | "maintenance"
        | "customer_service"
        | "admin"
      task_instance_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "overdue"
        | "escalated"
        | "handed_over"
      task_time_window: "opening" | "periodic" | "closing" | "anytime"
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
      frequency_type: ["daily", "weekly", "monthly", "custom"],
      shift_type: ["morning", "afternoon", "evening", "night"],
      task_category: [
        "cleaning",
        "inventory",
        "security",
        "maintenance",
        "customer_service",
        "admin",
      ],
      task_instance_status: [
        "pending",
        "in_progress",
        "completed",
        "overdue",
        "escalated",
        "handed_over",
      ],
      task_time_window: ["opening", "periodic", "closing", "anytime"],
    },
  },
} as const
