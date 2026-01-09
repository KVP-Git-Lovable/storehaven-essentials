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
          warranty_end_date: string | null
          warranty_start_date: string | null
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
          warranty_end_date?: string | null
          warranty_start_date?: string | null
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
          warranty_end_date?: string | null
          warranty_start_date?: string | null
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
      inventory_items: {
        Row: {
          barcode: string | null
          category: string
          created_at: string
          expiry_tracking: boolean | null
          id: string
          max_stock: number | null
          min_stock: number
          name: string
          selling_price: number
          sku: string | null
          status: string
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category: string
          created_at?: string
          expiry_tracking?: boolean | null
          id?: string
          max_stock?: number | null
          min_stock?: number
          name: string
          selling_price?: number
          sku?: string | null
          status?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category?: string
          created_at?: string
          expiry_tracking?: boolean | null
          id?: string
          max_stock?: number | null
          min_stock?: number
          name?: string
          selling_price?: number
          sku?: string | null
          status?: string
          unit?: string
          unit_cost?: number
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
      planograms: {
        Row: {
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          image_url: string
          status: string
          title: string
          updated_at: string
          zone: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          image_url: string
          status?: string
          title: string
          updated_at?: string
          zone: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          image_url?: string
          status?: string
          title?: string
          updated_at?: string
          zone?: string
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
          source_warehouse_id: string
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
          source_warehouse_id: string
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
          source_warehouse_id?: string
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
          created_at: string
          description: string | null
          due_date: string
          frequency: string
          id: string
          planogram_id: string
          status: string
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          frequency?: string
          id?: string
          planogram_id: string
          status?: string
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          frequency?: string
          id?: string
          planogram_id?: string
          status?: string
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
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
