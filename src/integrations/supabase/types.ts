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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          line1: string
          line2: string | null
          phone: string | null
          postal_code: string
          recipient_name: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          line1: string
          line2?: string | null
          phone?: string | null
          postal_code: string
          recipient_name: string
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          line1?: string
          line2?: string | null
          phone?: string | null
          postal_code?: string
          recipient_name?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      lab_auth_accounts: {
        Row: {
          created_at: string
          display_name: string
          id: string
          locked_until: string | null
          otp_code: string
          otp_expires_at: string
          password_hash: string
          password_salt: string
          secure_failed_attempts: number
          secure_otp_attempts: number
          session_counter: number
          updated_at: string
          username: string
          vuln_failed_attempts: number
          vuln_otp_attempts: number
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          locked_until?: string | null
          otp_code?: string
          otp_expires_at?: string
          password_hash: string
          password_salt: string
          secure_failed_attempts?: number
          secure_otp_attempts?: number
          session_counter?: number
          updated_at?: string
          username: string
          vuln_failed_attempts?: number
          vuln_otp_attempts?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          locked_until?: string | null
          otp_code?: string
          otp_expires_at?: string
          password_hash?: string
          password_salt?: string
          secure_failed_attempts?: number
          secure_otp_attempts?: number
          session_counter?: number
          updated_at?: string
          username?: string
          vuln_failed_attempts?: number
          vuln_otp_attempts?: number
        }
        Relationships: []
      }
      lab_bizflow_purchases: {
        Row: {
          client_signature: string
          created_at: string
          id: string
          quantity: number
          user_id: string
          variant: string
        }
        Insert: {
          client_signature?: string
          created_at?: string
          id?: string
          quantity: number
          user_id: string
          variant: string
        }
        Update: {
          client_signature?: string
          created_at?: string
          id?: string
          quantity?: number
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      lab_bizflow_stock: {
        Row: {
          remaining: number
          sku: string
          updated_at: string
          variant: string
        }
        Insert: {
          remaining?: number
          sku?: string
          updated_at?: string
          variant: string
        }
        Update: {
          remaining?: number
          sku?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      lab_bopla_profiles: {
        Row: {
          account_credit_cents: number
          created_at: string
          date_of_birth: string | null
          display_name: string
          email: string
          id: string
          internal_notes: string
          internal_risk_score: number
          is_vip: boolean
          loyalty_tier: string
          marketing_opt_in: boolean
          phone: string
          support_pin: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_credit_cents?: number
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          email?: string
          id?: string
          internal_notes?: string
          internal_risk_score?: number
          is_vip?: boolean
          loyalty_tier?: string
          marketing_opt_in?: boolean
          phone?: string
          support_pin?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_credit_cents?: number
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          email?: string
          id?: string
          internal_notes?: string
          internal_risk_score?: number
          is_vip?: boolean
          loyalty_tier?: string
          marketing_opt_in?: boolean
          phone?: string
          support_pin?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lab_rc_records: {
        Row: {
          amount_cents: number
          created_at: string
          customer_label: string
          id: string
          issued_on: string
          reference: string
          region: string
          seq: number
        }
        Insert: {
          amount_cents: number
          created_at?: string
          customer_label: string
          id?: string
          issued_on: string
          reference: string
          region: string
          seq: number
        }
        Update: {
          amount_cents?: number
          created_at?: string
          customer_label?: string
          id?: string
          issued_on?: string
          reference?: string
          region?: string
          seq?: number
        }
        Relationships: []
      }
      lab_rc_usage: {
        Row: {
          budget_spent_cents: number
          compute_units: number
          id: string
          notifications_sent: number
          request_count: number
          rows_returned: number
          updated_at: string
          user_id: string
          variant: string
          window_started_at: string
        }
        Insert: {
          budget_spent_cents?: number
          compute_units?: number
          id?: string
          notifications_sent?: number
          request_count?: number
          rows_returned?: number
          updated_at?: string
          user_id: string
          variant: string
          window_started_at?: string
        }
        Update: {
          budget_spent_cents?: number
          compute_units?: number
          id?: string
          notifications_sent?: number
          request_count?: number
          rows_returned?: number
          updated_at?: string
          user_id?: string
          variant?: string
          window_started_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total_cents: number
          order_id: string
          product_id: string | null
          product_name_snapshot: string
          product_slug_snapshot: string
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_cents: number
          order_id: string
          product_id?: string | null
          product_name_snapshot: string
          product_slug_snapshot?: string
          quantity: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total_cents?: number
          order_id?: string
          product_id?: string | null
          product_name_snapshot?: string
          product_slug_snapshot?: string
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          id: string
          order_number: string
          shipping_address_snapshot: Json
          shipping_cents: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          order_number?: string
          shipping_address_snapshot: Json
          shipping_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tax_cents?: number
          total_cents: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          order_number?: string
          shipping_address_snapshot?: Json
          shipping_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          order_id: string
          provider: string
          provider_reference: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          provider?: string
          provider_reference: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          provider?: string
          provider_reference?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string
          category_id: string | null
          created_at: string
          currency: string
          description: string
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          price_cents: number
          rating: number
          review_count: number
          short_description: string
          sku: string
          slug: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          brand?: string
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          price_cents: number
          rating?: number
          review_count?: number
          short_description?: string
          sku: string
          slug: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          brand?: string
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price_cents?: number
          rating?: number
          review_count?: number
          short_description?: string
          sku?: string
          slug?: string
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          marketing_opt_in: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          marketing_opt_in?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          marketing_opt_in?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      cancel_order: { Args: { _order_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_catalog_manager: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      lab_bfla_reset: { Args: never; Returns: Json }
      lab_bizflow_reset: { Args: never; Returns: Json }
      lab_bola_reset: { Args: never; Returns: Json }
      lab_bopla_reset: { Args: never; Returns: Json }
      lab_broken_auth_reset: { Args: never; Returns: Json }
      lab_rc_reset: { Args: never; Returns: Json }
      place_order: {
        Args: { _address_id: string; _payment_method: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "customer" | "employee" | "manager" | "administrator"
      order_status:
        | "pending"
        | "paid"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_status: "pending" | "succeeded" | "failed"
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
      app_role: ["customer", "employee", "manager", "administrator"],
      order_status: [
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_status: ["pending", "succeeded", "failed"],
    },
  },
} as const
