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
      affiliates: {
        Row: {
          commission_rate: number
          created_at: string
          id: string
          payout_details: string | null
          payout_method: string | null
          referral_code: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          id?: string
          payout_details?: string | null
          payout_method?: string | null
          referral_code: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          id?: string
          payout_details?: string | null
          payout_method?: string | null
          referral_code?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audio_files: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          file_path: string
          id: string
          program_id: string | null
          title: string
          track_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          file_path: string
          id?: string
          program_id?: string | null
          title: string
          track_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          file_path?: string
          id?: string
          program_id?: string | null
          title?: string
          track_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "audio_files_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_hidden: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_hidden?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_hidden?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          purchase_id: string
          status: string
        }
        Insert: {
          affiliate_id: string
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          purchase_id: string
          status?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          purchase_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          program_ids: string[] | null
          times_used: number
          updated_at: string
          usage_limit: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          program_ids?: string[] | null
          times_used?: number
          updated_at?: string
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          program_ids?: string[] | null
          times_used?: number
          updated_at?: string
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          address_postcode: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          legacy_password_hash: string | null
          name: string | null
          phone: string | null
          updated_at: string
          user_id: string
          wp_user_id: number | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_postcode?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legacy_password_hash?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          wp_user_id?: number | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_postcode?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legacy_password_hash?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          wp_user_id?: number | null
        }
        Relationships: []
      }
      program_audio_files: {
        Row: {
          audio_file_id: string
          created_at: string
          id: string
          program_id: string
          track_order: number
        }
        Insert: {
          audio_file_id: string
          created_at?: string
          id?: string
          program_id: string
          track_order?: number
        }
        Update: {
          audio_file_id?: string
          created_at?: string
          id?: string
          program_id?: string
          track_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_audio_files_audio_file_id_fkey"
            columns: ["audio_file_id"]
            isOneToOne: false
            referencedRelation: "audio_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_audio_files_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          categories: string[] | null
          country: string | null
          created_at: string
          description: string | null
          duration_text: string | null
          id: string
          image_url: string | null
          is_active: boolean
          pdf_file_path: string | null
          price: number
          short_description: string | null
          sku: string | null
          slug: string
          title: string
          updated_at: string
          wc_id: number | null
        }
        Insert: {
          categories?: string[] | null
          country?: string | null
          created_at?: string
          description?: string | null
          duration_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          pdf_file_path?: string | null
          price?: number
          short_description?: string | null
          sku?: string | null
          slug: string
          title: string
          updated_at?: string
          wc_id?: number | null
        }
        Update: {
          categories?: string[] | null
          country?: string | null
          created_at?: string
          description?: string | null
          duration_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          pdf_file_path?: string | null
          price?: number
          short_description?: string | null
          sku?: string | null
          slug?: string
          title?: string
          updated_at?: string
          wc_id?: number | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_paid: number
          id: string
          program_id: string
          purchase_date: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          id?: string
          program_id: string
          purchase_date?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          id?: string
          program_id?: string
          purchase_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      referrals: {
        Row: {
          affiliate_id: string
          converted: boolean
          converted_user_id: string | null
          id: string
          landed_at: string
          referrer_url: string | null
          visitor_ip: string | null
        }
        Insert: {
          affiliate_id: string
          converted?: boolean
          converted_user_id?: string | null
          id?: string
          landed_at?: string
          referrer_url?: string | null
          visitor_ip?: string | null
        }
        Update: {
          affiliate_id?: string
          converted?: boolean
          converted_user_id?: string | null
          id?: string
          landed_at?: string
          referrer_url?: string | null
          visitor_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
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
      generate_slug: { Args: { title: string }; Returns: string }
      has_purchased_program: {
        Args: { program_uuid: string }
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
