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
      api_configs: {
        Row: {
          api_key: string
          api_url: string
          created_at: string
          id: string
          instance_name: string
          is_active: boolean | null
          max_messages_per_hour: number
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string
          id?: string
          instance_name: string
          is_active?: boolean | null
          max_messages_per_hour?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string
          id?: string
          instance_name?: string
          is_active?: boolean | null
          max_messages_per_hour?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          api_config_id: string | null
          created_at: string
          description: string | null
          group_ids: string[]
          id: string
          instance_name: string | null
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_config_id?: string | null
          created_at?: string
          description?: string | null
          group_ids?: string[]
          id?: string
          instance_name?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_config_id?: string | null
          created_at?: string
          description?: string | null
          group_ids?: string[]
          id?: string
          instance_name?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_api_config_id_fkey"
            columns: ["api_config_id"]
            isOneToOne: false
            referencedRelation: "api_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      global_config: {
        Row: {
          created_at: string
          evolution_api_key: string
          evolution_api_url: string
          id: string
          openai_api_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evolution_api_key?: string
          evolution_api_url?: string
          id?: string
          openai_api_key?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evolution_api_key?: string
          evolution_api_url?: string
          id?: string
          openai_api_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_logs: {
        Row: {
          api_config_id: string | null
          content: Json
          created_at: string
          error_message: string | null
          group_id: string
          group_name: string | null
          id: string
          instance_name: string | null
          message_type: string
          scheduled_message_id: string | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          api_config_id?: string | null
          content?: Json
          created_at?: string
          error_message?: string | null
          group_id: string
          group_name?: string | null
          id?: string
          instance_name?: string | null
          message_type?: string
          scheduled_message_id?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          api_config_id?: string | null
          content?: Json
          created_at?: string
          error_message?: string | null
          group_id?: string
          group_name?: string | null
          id?: string
          instance_name?: string | null
          message_type?: string
          scheduled_message_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_api_config_id_fkey"
            columns: ["api_config_id"]
            isOneToOne: false
            referencedRelation: "api_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string | null
          content: Json
          created_at: string
          id: string
          message_type: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content?: Json
          created_at?: string
          id?: string
          message_type?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: Json
          created_at?: string
          id?: string
          message_type?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          api_config_id: string | null
          campaign_id: string | null
          content: Json
          created_at: string
          cron_expression: string | null
          group_ids: string[]
          id: string
          instance_name: string | null
          is_active: boolean | null
          last_completed_at: string | null
          last_run_at: string | null
          message_type: string
          next_run_at: string | null
          processing_started_at: string | null
          schedule_type: string
          scheduled_at: string | null
          sent_group_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          api_config_id?: string | null
          campaign_id?: string | null
          content?: Json
          created_at?: string
          cron_expression?: string | null
          group_ids?: string[]
          id?: string
          instance_name?: string | null
          is_active?: boolean | null
          last_completed_at?: string | null
          last_run_at?: string | null
          message_type?: string
          next_run_at?: string | null
          processing_started_at?: string | null
          schedule_type?: string
          scheduled_at?: string | null
          sent_group_index?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          api_config_id?: string | null
          campaign_id?: string | null
          content?: Json
          created_at?: string
          cron_expression?: string | null
          group_ids?: string[]
          id?: string
          instance_name?: string | null
          is_active?: boolean | null
          last_completed_at?: string | null
          last_run_at?: string | null
          message_type?: string
          next_run_at?: string | null
          processing_started_at?: string | null
          schedule_type?: string
          scheduled_at?: string | null
          sent_group_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_api_config_id_fkey"
            columns: ["api_config_id"]
            isOneToOne: false
            referencedRelation: "api_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_ai_requests_per_month: number
          max_campaigns: number
          max_instances: number
          max_messages_per_hour: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_ai_requests_per_month?: number
          max_campaigns?: number
          max_instances?: number
          max_messages_per_hour?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_ai_requests_per_month?: number
          max_campaigns?: number
          max_instances?: number
          max_messages_per_hour?: number
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_due_messages: {
        Args: never
        Returns: {
          api_config_id: string | null
          campaign_id: string | null
          content: Json
          created_at: string
          cron_expression: string | null
          group_ids: string[]
          id: string
          instance_name: string | null
          is_active: boolean | null
          last_completed_at: string | null
          last_run_at: string | null
          message_type: string
          next_run_at: string | null
          processing_started_at: string | null
          schedule_type: string
          scheduled_at: string | null
          sent_group_index: number
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scheduled_messages"
          isOneToOne: false
          isSetofReturn: true
        }
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
