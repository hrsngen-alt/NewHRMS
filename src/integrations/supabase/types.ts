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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          hours_worked: number | null
          id: string
          notes: string | null
          status: string
          check_in_lat: number | null
          check_in_lng: number | null
          check_out_lat: number | null
          check_out_lng: number | null
          metadata: Json | null
          check_in_address: string | null
          check_out_address: string | null
          check_out_type: string | null
          employee_name: string | null
          department: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          status?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          metadata?: Json | null
          check_in_address?: string | null
          check_out_address?: string | null
          check_out_type?: string | null
          employee_name?: string | null
          department?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          status?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          metadata?: Json | null
          check_in_address?: string | null
          check_out_address?: string | null
          check_out_type?: string | null
          employee_name?: string | null
          department?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_policies: {
        Row: {
          id: string
          name: string
          auto_checkout_enabled: boolean
          auto_checkout_after_minutes: number
          qr_attendance_enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          auto_checkout_enabled?: boolean
          auto_checkout_after_minutes?: number
          qr_attendance_enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          auto_checkout_enabled?: boolean
          auto_checkout_after_minutes?: number
          qr_attendance_enabled?: boolean
          created_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          aadhaar_number: string | null
          bank_account: string | null
          bank_ifsc: string | null
          bank_name: string | null
          basic_salary: number
          conveyance: number
          created_at: string
          department: string | null
          designation: string | null
          email: string
          employee_code: string
          full_name: string
          hra: number
          id: string
          joining_date: string | null
          medical: number
          pan_number: string | null
          phone: string | null
          reporting_manager: string | null
          special_allowance: number
          status: string
          uan_number: string | null
          updated_at: string
          user_id: string | null
          photo_url: string | null
          pf_eligible: boolean | null
          esic_eligible: boolean | null
          gratuity_eligible: boolean | null
          pf_amount: number | null
          esic_amount: number | null
          gratuity_amount: number | null
          bonus: number | null
          total_experience: number | null
          attendance_policy_id: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          basic_salary?: number
          conveyance?: number
          created_at?: string
          department?: string | null
          designation?: string | null
          email: string
          employee_code: string
          full_name: string
          hra?: number
          id?: string
          joining_date?: string | null
          medical?: number
          pan_number?: string | null
          phone?: string | null
          reporting_manager?: string | null
          special_allowance?: number
          status?: string
          uan_number?: string | null
          updated_at?: string
          user_id?: string | null
          photo_url?: string | null
          pf_eligible?: boolean | null
          esic_eligible?: boolean | null
          gratuity_eligible?: boolean | null
          pf_amount?: number | null
          esic_amount?: number | null
          gratuity_amount?: number | null
          bonus?: number | null
          total_experience?: number | null
          attendance_policy_id?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          basic_salary?: number
          conveyance?: number
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string
          employee_code?: string
          full_name?: string
          hra?: number
          id?: string
          joining_date?: string | null
          medical?: number
          pan_number?: string | null
          phone?: string | null
          reporting_manager?: string | null
          special_allowance?: number
          status?: string
          uan_number?: string | null
          updated_at?: string
          user_id?: string | null
          photo_url?: string | null
          pf_eligible?: boolean | null
          esic_eligible?: boolean | null
          gratuity_eligible?: boolean | null
          pf_amount?: number | null
          esic_amount?: number | null
          gratuity_amount?: number | null
          bonus?: number | null
          total_experience?: number | null
          attendance_policy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_attendance_policy_id_fkey"
            columns: ["attendance_policy_id"]
            isOneToOne: false
            referencedRelation: "attendance_policies"
            referencedColumns: ["id"]
          }
        ]
      }
      employee_assets: {
        Row: {
          id: string
          employee_id: string
          asset_name: string
          asset_id: string | null
          asset_type: string | null
          assigned_date: string | null
          status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          asset_name: string
          asset_id?: string | null
          asset_type?: string | null
          assigned_date?: string | null
          status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          asset_name?: string
          asset_id?: string | null
          asset_type?: string | null
          assigned_date?: string | null
          status?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_assets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          }
        ]
      }
      holidays: {
        Row: {
          id: string
          date: string
          name: string
          is_mandatory: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          name: string
          is_mandatory?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          name?: string
          is_mandatory?: boolean | null
          created_at?: string
        }
        Relationships: []
      }
      leave_audit_logs: {
        Row: {
          id: string
          leave_id: string | null
          action_by: string | null
          action_type: string
          comments: string | null
          created_at: string
        }
        Insert: {
          id?: string
          leave_id?: string | null
          action_by?: string | null
          action_type: string
          comments?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          leave_id?: string | null
          action_by?: string | null
          action_type?: string
          comments?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_audit_logs_leave_id_fkey"
            columns: ["leave_id"]
            isOneToOne: false
            referencedRelation: "leaves"
            referencedColumns: ["id"]
          }
        ]
      }
      leave_balances: {
        Row: {
          id: string
          employee_id: string | null
          leave_type_code: string | null
          year: number
          total_allocated: number | null
          used: number | null
          balance: number | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id?: string | null
          leave_type_code?: string | null
          year: number
          total_allocated?: number | null
          used?: number | null
          balance?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string | null
          leave_type_code?: string | null
          year?: number
          total_allocated?: number | null
          used?: number | null
          balance?: number | null
          created_at?: string
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
            foreignKeyName: "leave_balances_leave_type_code_fkey"
            columns: ["leave_type_code"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["code"]
          }
        ]
      }
      leave_types: {
        Row: {
          id: string
          code: string
          name: string
          is_paid: boolean | null
          default_annual_allowance: number | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          is_paid?: boolean | null
          default_annual_allowance?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          is_paid?: boolean | null
          default_annual_allowance?: number | null
          created_at?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          approved_by: string | null
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          start_date: string
          status: string
          manager_id: string | null
          manager_status: string | null
          hr_status: string | null
          rejection_reason: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          days?: number
          employee_id: string
          end_date: string
          id?: string
          leave_type: string
          reason?: string | null
          start_date: string
          status?: string
          manager_id?: string | null
          manager_status?: string | null
          hr_status?: string | null
          rejection_reason?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          days?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          start_date?: string
          status?: string
          manager_id?: string | null
          manager_status?: string | null
          hr_status?: string | null
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          id: string
          period_month: number
          period_year: number
          processed_at: string | null
          status: string
          total_net: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          period_month: number
          period_year: number
          processed_at?: string | null
          status?: string
          total_net?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          period_month?: number
          period_year?: number
          processed_at?: string | null
          status?: string
          total_net?: number | null
        }
        Relationships: []
      }
      payslips: {
        Row: {
          basic: number
          bonus: number
          conveyance: number
          created_at: string
          employee_id: string
          esic: number
          gross: number
          hra: number
          id: string
          leave_deduction: number
          medical: number
          net_pay: number
          paid_days: number
          payroll_run_id: string
          pf: number
          pt: number
          special_allowance: number
          tds: number
          total_deductions: number
          working_days: number
          gratuity: number
        }
        Insert: {
          basic?: number
          bonus?: number
          conveyance?: number
          created_at?: string
          employee_id: string
          esic?: number
          gross?: number
          hra?: number
          id?: string
          leave_deduction?: number
          medical?: number
          net_pay?: number
          paid_days?: number
          payroll_run_id: string
          pf?: number
          pt?: number
          special_allowance?: number
          tds?: number
          total_deductions?: number
          working_days?: number
          gratuity?: number
        }
        Update: {
          basic?: number
          bonus?: number
          conveyance?: number
          created_at?: string
          employee_id?: string
          esic?: number
          gross?: number
          hra?: number
          id?: string
          leave_deduction?: number
          medical?: number
          net_pay?: number
          paid_days?: number
          payroll_run_id?: string
          pf?: number
          pt?: number
          special_allowance?: number
          tds?: number
          total_deductions?: number
          working_days?: number
          gratuity?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
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
      create_invited_user: {
        Args: {
          p_email: string
          p_full_name: string
        }
        Returns: string
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
      app_role: "admin" | "employee"
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
      app_role: ["admin", "employee"],
    },
  },
} as const
