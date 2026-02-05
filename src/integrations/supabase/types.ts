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
      access_logs: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["access_direction"]
          gate_id: string
          id: string
          operator_id: string | null
          subject_id: string
          subject_type: Database["public"]["Enums"]["subject_type"]
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["access_direction"]
          gate_id?: string
          id?: string
          operator_id?: string | null
          subject_id: string
          subject_type: Database["public"]["Enums"]["subject_type"]
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["access_direction"]
          gate_id?: string
          id?: string
          operator_id?: string | null
          subject_id?: string
          subject_type?: Database["public"]["Enums"]["subject_type"]
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      employee_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          credential_id: string
          department_id: string | null
          document: string
          full_name: string
          id: string
          job_title: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["credential_status"]
          type: Database["public"]["Enums"]["credential_type"]
          updated_at: string
          vehicle_make_model: string | null
          vehicle_plate: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credential_id: string
          department_id?: string | null
          document: string
          full_name: string
          id?: string
          job_title?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["credential_status"]
          type: Database["public"]["Enums"]["credential_type"]
          updated_at?: string
          vehicle_make_model?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credential_id?: string
          department_id?: string | null
          document?: string
          full_name?: string
          id?: string
          job_title?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["credential_status"]
          type?: Database["public"]["Enums"]["credential_type"]
          updated_at?: string
          vehicle_make_model?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_credentials_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      visitors: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          document: string
          full_name: string
          gate_obs: string | null
          id: string
          pass_id: string
          phone: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          updated_at: string
          valid_from: string
          valid_until: string
          visit_to_name: string
          visit_to_type: Database["public"]["Enums"]["visit_to_type"]
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          document: string
          full_name: string
          gate_obs?: string | null
          id?: string
          pass_id: string
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          updated_at?: string
          valid_from: string
          valid_until: string
          visit_to_name: string
          visit_to_type?: Database["public"]["Enums"]["visit_to_type"]
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          document?: string
          full_name?: string
          gate_obs?: string | null
          id?: string
          pass_id?: string
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          updated_at?: string
          valid_from?: string
          valid_until?: string
          visit_to_name?: string
          visit_to_type?: Database["public"]["Enums"]["visit_to_type"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: { check_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin_or_rh: { Args: never; Returns: boolean }
    }
    Enums: {
      access_direction: "in" | "out"
      app_role: "admin" | "rh" | "security"
      credential_status: "allowed" | "blocked"
      credential_type: "personal" | "vehicle"
      subject_type: "visitor" | "employee"
      visit_to_type: "setor" | "pessoa"
      visitor_status: "pending" | "inside" | "outside" | "closed"
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
      access_direction: ["in", "out"],
      app_role: ["admin", "rh", "security"],
      credential_status: ["allowed", "blocked"],
      credential_type: ["personal", "vehicle"],
      subject_type: ["visitor", "employee"],
      visit_to_type: ["setor", "pessoa"],
      visitor_status: ["pending", "inside", "outside", "closed"],
    },
  },
} as const
