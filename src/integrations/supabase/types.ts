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
      access_sessions: {
        Row: {
          associate_id: string | null
          authorization_type: string | null
          completed_at: string | null
          created_at: string
          denial_reason: string | null
          expires_at: string
          first_scan: string
          id: string
          operator_id: string | null
          person_credential_id: string | null
          session_type: string
          status: string
          vehicle_credential_id: string | null
          visitor_id: string | null
        }
        Insert: {
          associate_id?: string | null
          authorization_type?: string | null
          completed_at?: string | null
          created_at?: string
          denial_reason?: string | null
          expires_at: string
          first_scan: string
          id?: string
          operator_id?: string | null
          person_credential_id?: string | null
          session_type: string
          status?: string
          vehicle_credential_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          associate_id?: string | null
          authorization_type?: string | null
          completed_at?: string | null
          created_at?: string
          denial_reason?: string | null
          expires_at?: string
          first_scan?: string
          id?: string
          operator_id?: string | null
          person_credential_id?: string | null
          session_type?: string
          status?: string
          vehicle_credential_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_sessions_associate_id_fkey"
            columns: ["associate_id"]
            isOneToOne: false
            referencedRelation: "associates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_sessions_person_credential_id_fkey"
            columns: ["person_credential_id"]
            isOneToOne: false
            referencedRelation: "employee_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_sessions_vehicle_credential_id_fkey"
            columns: ["vehicle_credential_id"]
            isOneToOne: false
            referencedRelation: "employee_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_sessions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      associates: {
        Row: {
          created_at: string
          created_by: string | null
          document: string
          employee_credential_id: string
          full_name: string
          id: string
          pass_id: string
          phone: string | null
          photo_url: string | null
          relationship_type: string
          status: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          validity_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document: string
          employee_credential_id: string
          full_name: string
          id?: string
          pass_id: string
          phone?: string | null
          photo_url?: string | null
          relationship_type: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          validity_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document?: string
          employee_credential_id?: string
          full_name?: string
          id?: string
          pass_id?: string
          phone?: string | null
          photo_url?: string | null
          relationship_type?: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          validity_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "associates_employee_credential_id_fkey"
            columns: ["employee_credential_id"]
            isOneToOne: false
            referencedRelation: "employee_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["audit_action_type"]
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["audit_action_type"]
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["audit_action_type"]
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      companies: {
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
          is_active: boolean
          must_change_password: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
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
      vehicle_authorized_drivers: {
        Row: {
          associate_id: string | null
          authorization_type: string
          created_at: string
          created_by: string | null
          driver_type: string
          employee_credential_id: string | null
          id: string
          is_active: boolean
          valid_from: string | null
          valid_until: string | null
          vehicle_credential_id: string
        }
        Insert: {
          associate_id?: string | null
          authorization_type: string
          created_at?: string
          created_by?: string | null
          driver_type: string
          employee_credential_id?: string | null
          id?: string
          is_active?: boolean
          valid_from?: string | null
          valid_until?: string | null
          vehicle_credential_id: string
        }
        Update: {
          associate_id?: string | null
          authorization_type?: string
          created_at?: string
          created_by?: string | null
          driver_type?: string
          employee_credential_id?: string | null
          id?: string
          is_active?: boolean
          valid_from?: string | null
          valid_until?: string | null
          vehicle_credential_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_authorized_drivers_associate_id_fkey"
            columns: ["associate_id"]
            isOneToOne: false
            referencedRelation: "associates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_authorized_drivers_employee_credential_id_fkey"
            columns: ["employee_credential_id"]
            isOneToOne: false
            referencedRelation: "employee_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_authorized_drivers_vehicle_credential_id_fkey"
            columns: ["vehicle_credential_id"]
            isOneToOne: false
            referencedRelation: "employee_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          access_type: Database["public"]["Enums"]["visitor_access_type"]
          company_id: string | null
          company_reason: string
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
          vehicle_brand: string | null
          vehicle_color: string | null
          vehicle_model: string | null
          vehicle_pass_id: string | null
          vehicle_plate: string | null
          visit_to_name: string
          visit_to_type: Database["public"]["Enums"]["visit_to_type"]
        }
        Insert: {
          access_type?: Database["public"]["Enums"]["visitor_access_type"]
          company_id?: string | null
          company_reason?: string
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
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_pass_id?: string | null
          vehicle_plate?: string | null
          visit_to_name: string
          visit_to_type?: Database["public"]["Enums"]["visit_to_type"]
        }
        Update: {
          access_type?: Database["public"]["Enums"]["visitor_access_type"]
          company_id?: string | null
          company_reason?: string
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
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_pass_id?: string | null
          vehicle_plate?: string | null
          visit_to_name?: string
          visit_to_type?: Database["public"]["Enums"]["visit_to_type"]
        }
        Relationships: [
          {
            foreignKeyName: "visitors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      access_events_enriched: {
        Row: {
          company_name: string | null
          company_reason: string | null
          created_at: string | null
          credential_id: string | null
          department_name: string | null
          direction: string | null
          document: string | null
          entity_status: string | null
          gate_id: string | null
          id: string | null
          job_title: string | null
          operator_id: string | null
          person_name: string | null
          person_type: string | null
          relationship_type: string | null
          responsible_name: string | null
          subject_id: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          visit_to_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_sessions: { Args: never; Returns: number }
      expire_unused_visitor_passes: { Args: never; Returns: number }
      get_activity_chart_data: {
        Args: never
        Returns: {
          date_label: string
          day: string
          day_label: string
          entries: number
          exits: number
        }[]
      }
      get_critical_events: {
        Args: { p_limit?: number }
        Returns: {
          action_type: Database["public"]["Enums"]["audit_action_type"]
          created_at: string
          details: Json
          id: string
          user_email: string
          user_id: string
        }[]
      }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_last_access_direction: {
        Args: {
          p_subject_id: string
          p_subject_type: Database["public"]["Enums"]["subject_type"]
        }
        Returns: Database["public"]["Enums"]["access_direction"]
      }
      get_recent_visitors: {
        Args: { p_limit?: number }
        Returns: {
          company_name: string
          company_reason: string
          created_at: string
          full_name: string
          id: string
          status: Database["public"]["Enums"]["visitor_status"]
          visit_to_name: string
          visit_to_type: Database["public"]["Enums"]["visit_to_type"]
        }[]
      }
      get_today_stats: { Args: never; Returns: Json }
      get_visitors_inside: {
        Args: { p_limit?: number }
        Returns: {
          company_name: string
          created_at: string
          full_name: string
          id: string
          visit_to_name: string
          visit_to_type: Database["public"]["Enums"]["visit_to_type"]
        }[]
      }
      has_role: {
        Args: { check_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin_or_rh: { Args: never; Returns: boolean }
      report_access_summary: {
        Args: { p_end: string; p_start: string }
        Returns: {
          day: string
          total_entries: number
          total_exits: number
          unique_employees: number
          unique_visitors: number
        }[]
      }
      report_associates_detailed: {
        Args: {
          p_end?: string
          p_limit?: number
          p_offset?: number
          p_start?: string
          p_status?: string
        }
        Returns: {
          access_count: number
          created_at: string
          document: string
          full_name: string
          id: string
          last_access: string
          pass_id: string
          relationship_type: string
          responsible_document: string
          responsible_name: string
          status: string
          valid_from: string
          valid_until: string
          validity_type: string
          vehicle_auth_count: number
        }[]
      }
      report_denials: {
        Args: {
          p_end?: string
          p_limit?: number
          p_offset?: number
          p_start?: string
        }
        Returns: {
          created_at: string
          denial_reason: string
          document: string
          id: string
          operator_name: string
          person_name: string
          person_type: string
          session_type: string
          vehicle_plate: string
        }[]
      }
      report_employees_detailed: {
        Args: {
          p_department?: string
          p_end?: string
          p_limit?: number
          p_offset?: number
          p_start?: string
          p_status?: string
        }
        Returns: {
          access_count: number
          associate_count: number
          created_at: string
          credential_id: string
          department_name: string
          document: string
          full_name: string
          id: string
          job_title: string
          last_access: string
          status: string
          vehicle_count: number
        }[]
      }
      report_executive_summary: {
        Args: { p_end?: string; p_start?: string }
        Returns: Json
      }
      report_permanence: {
        Args: {
          p_document?: string
          p_end?: string
          p_limit?: number
          p_offset?: number
          p_person_type?: string
          p_start?: string
        }
        Returns: {
          document: string
          duration_minutes: number
          entry_time: string
          exit_time: string
          gate_id: string
          person_name: string
          person_type: string
          subject_id: string
          vehicle_plate: string
        }[]
      }
      report_person_timeline: {
        Args: {
          p_document?: string
          p_end?: string
          p_limit?: number
          p_name?: string
          p_offset?: number
          p_person_type?: string
          p_start?: string
        }
        Returns: {
          company_name: string
          company_reason: string
          created_at: string
          department_name: string
          direction: string
          document: string
          entity_status: string
          gate_id: string
          id: string
          person_name: string
          person_type: string
          relationship_type: string
          responsible_name: string
          vehicle_model: string
          vehicle_plate: string
          visit_to_name: string
        }[]
      }
      report_presence_now: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          department_name: string
          document: string
          duration_minutes: number
          entry_time: string
          gate_id: string
          person_name: string
          person_type: string
          responsible_name: string
          subject_id: string
          vehicle_plate: string
        }[]
      }
      report_sessions: {
        Args: {
          p_end?: string
          p_limit?: number
          p_offset?: number
          p_session_type?: string
          p_start?: string
          p_status?: string
        }
        Returns: {
          authorization_type: string
          completed_at: string
          created_at: string
          denial_reason: string
          expires_at: string
          first_scan: string
          id: string
          person_name: string
          person_type: string
          session_type: string
          status: string
          vehicle_model: string
          vehicle_plate: string
          visitor_name: string
        }[]
      }
      report_vehicle_activity: {
        Args: {
          p_end?: string
          p_limit?: number
          p_offset?: number
          p_owner?: string
          p_plate?: string
          p_start?: string
        }
        Returns: {
          created_at: string
          direction: string
          document: string
          entity_status: string
          gate_id: string
          id: string
          person_name: string
          person_type: string
          responsible_name: string
          vehicle_model: string
          vehicle_plate: string
        }[]
      }
      report_visitors_by_company: {
        Args: { p_end: string; p_start: string }
        Returns: {
          company_name: string
          total_visitors: number
          visitors_closed: number
          visitors_inside: number
        }[]
      }
      report_visitors_detailed: {
        Args: {
          p_end?: string
          p_limit?: number
          p_offset?: number
          p_start?: string
          p_status?: string
        }
        Returns: {
          access_type: string
          company_name: string
          company_reason: string
          created_at: string
          document: string
          entry_count: number
          exit_count: number
          full_name: string
          id: string
          last_access: string
          status: string
          valid_from: string
          valid_until: string
          vehicle_plate: string
          visit_to_name: string
          visit_to_type: string
        }[]
      }
    }
    Enums: {
      access_direction: "in" | "out"
      app_role: "admin" | "rh" | "security" | "operador_acesso"
      audit_action_type:
        | "LOGIN"
        | "LOGOUT"
        | "LOGIN_FAILED"
        | "USER_CREATE"
        | "USER_UPDATE"
        | "USER_DELETE"
        | "USER_DEACTIVATE"
        | "USER_ACTIVATE"
        | "PASSWORD_RESET"
        | "PASSWORD_CHANGE"
        | "ROLE_UPDATE"
        | "CONFIG_UPDATE"
        | "VISITOR_CREATE"
        | "VISITOR_UPDATE"
        | "VISITOR_DELETE"
        | "EMPLOYEE_CREATE"
        | "EMPLOYEE_UPDATE"
        | "EMPLOYEE_DELETE"
        | "DEPARTMENT_CREATE"
        | "DEPARTMENT_DELETE"
        | "BACKUP_EXPORT"
        | "ACCESS_SCAN"
        | "ASSOCIATE_CREATE"
        | "ASSOCIATE_UPDATE"
        | "ASSOCIATE_DELETE"
        | "ACCESS_SESSION_CREATE"
        | "ACCESS_SESSION_COMPLETE"
        | "ACCESS_SESSION_DENY"
        | "ACCESS_SESSION_EXPIRE"
      credential_status: "allowed" | "blocked"
      credential_type: "personal" | "vehicle"
      subject_type: "visitor" | "employee" | "associate"
      visit_to_type: "setor" | "pessoa"
      visitor_access_type: "pedestrian" | "driver"
      visitor_status:
        | "pending"
        | "inside"
        | "outside"
        | "closed"
        | "expired_unused"
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
      app_role: ["admin", "rh", "security", "operador_acesso"],
      audit_action_type: [
        "LOGIN",
        "LOGOUT",
        "LOGIN_FAILED",
        "USER_CREATE",
        "USER_UPDATE",
        "USER_DELETE",
        "USER_DEACTIVATE",
        "USER_ACTIVATE",
        "PASSWORD_RESET",
        "PASSWORD_CHANGE",
        "ROLE_UPDATE",
        "CONFIG_UPDATE",
        "VISITOR_CREATE",
        "VISITOR_UPDATE",
        "VISITOR_DELETE",
        "EMPLOYEE_CREATE",
        "EMPLOYEE_UPDATE",
        "EMPLOYEE_DELETE",
        "DEPARTMENT_CREATE",
        "DEPARTMENT_DELETE",
        "BACKUP_EXPORT",
        "ACCESS_SCAN",
        "ASSOCIATE_CREATE",
        "ASSOCIATE_UPDATE",
        "ASSOCIATE_DELETE",
        "ACCESS_SESSION_CREATE",
        "ACCESS_SESSION_COMPLETE",
        "ACCESS_SESSION_DENY",
        "ACCESS_SESSION_EXPIRE",
      ],
      credential_status: ["allowed", "blocked"],
      credential_type: ["personal", "vehicle"],
      subject_type: ["visitor", "employee", "associate"],
      visit_to_type: ["setor", "pessoa"],
      visitor_access_type: ["pedestrian", "driver"],
      visitor_status: [
        "pending",
        "inside",
        "outside",
        "closed",
        "expired_unused",
      ],
    },
  },
} as const
