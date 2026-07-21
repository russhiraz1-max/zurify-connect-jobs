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
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      application_settings: {
        Row: {
          created_at: string
          fee_bps_per_unit: number
          id: string
          min_withdrawal_cents: number
          paypal_instructions: string | null
          singleton: boolean
          site_name: string
          staff_bootstrap_email: string | null
          super_admin_email: string
          updated_at: string
          withdrawal_unit_cents: number
        }
        Insert: {
          created_at?: string
          fee_bps_per_unit?: number
          id?: string
          min_withdrawal_cents?: number
          paypal_instructions?: string | null
          singleton?: boolean
          site_name?: string
          staff_bootstrap_email?: string | null
          super_admin_email?: string
          updated_at?: string
          withdrawal_unit_cents?: number
        }
        Update: {
          created_at?: string
          fee_bps_per_unit?: number
          id?: string
          min_withdrawal_cents?: number
          paypal_instructions?: string | null
          singleton?: boolean
          site_name?: string
          staff_bootstrap_email?: string | null
          super_admin_email?: string
          updated_at?: string
          withdrawal_unit_cents?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          meta: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          headline: string | null
          id: string
          location: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id: string
          location?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          location?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          handled_by: string | null
          handler_notes: string | null
          id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string | null
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          handled_by?: string | null
          handler_notes?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string | null
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          handled_by?: string | null
          handler_notes?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string | null
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["staff_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["staff_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["staff_permission"]
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_staff_reply: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_applications: {
        Row: {
          created_at: string
          id: string
          note: string | null
          rejection_reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["application_status"]
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_applications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      task_submissions: {
        Row: {
          attachments: Json
          created_at: string
          id: string
          proof_text: string | null
          proof_url: string | null
          rejection_reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          id?: string
          proof_text?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          id?: string
          proof_text?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          allow_reapplication: boolean
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          ends_at: string | null
          est_minutes: number | null
          featured: boolean
          id: string
          instructions: string
          max_applications: number | null
          max_per_user: number
          max_total: number | null
          priority: number
          proof_requirements: string | null
          requires_application: boolean
          reward_cents: number
          starts_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          allow_reapplication?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          ends_at?: string | null
          est_minutes?: number | null
          featured?: boolean
          id?: string
          instructions: string
          max_applications?: number | null
          max_per_user?: number
          max_total?: number | null
          priority?: number
          proof_requirements?: string | null
          requires_application?: boolean
          reward_cents: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          allow_reapplication?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          est_minutes?: number | null
          featured?: boolean
          id?: string
          instructions?: string
          max_applications?: number | null
          max_per_user?: number
          max_total?: number | null
          priority?: number
          proof_requirements?: string | null
          requires_application?: boolean
          reward_cents?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
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
      wallet_transactions: {
        Row: {
          amount_cents: number
          balance_after_cents: number
          created_at: string
          id: string
          memo: string | null
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount_cents: number
          balance_after_cents: number
          created_at?: string
          id?: string
          memo?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
          wallet_id: string
        }
        Update: {
          amount_cents?: number
          balance_after_cents?: number
          created_at?: string
          id?: string
          memo?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          available_cents: number
          created_at: string
          id: string
          lifetime_earned_cents: number
          lifetime_withdrawn_cents: number
          pending_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_cents?: number
          created_at?: string
          id?: string
          lifetime_earned_cents?: number
          lifetime_withdrawn_cents?: number
          pending_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_cents?: number
          created_at?: string
          id?: string
          lifetime_earned_cents?: number
          lifetime_withdrawn_cents?: number
          pending_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount_cents: number
          created_at: string
          destination: Json
          fee_cents: number
          id: string
          method: Database["public"]["Enums"]["withdrawal_method"]
          net_cents: number
          processed_at: string | null
          rejection_reason: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          destination?: Json
          fee_cents?: number
          id?: string
          method?: Database["public"]["Enums"]["withdrawal_method"]
          net_cents: number
          processed_at?: string | null
          rejection_reason?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          destination?: Json
          fee_cents?: number
          id?: string
          method?: Database["public"]["Enums"]["withdrawal_method"]
          net_cents?: number
          processed_at?: string | null
          rejection_reason?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_to_task: {
        Args: { _note?: string; _task_id: string }
        Returns: string
      }
      approve_application: {
        Args: { _id: string; _notes?: string }
        Returns: undefined
      }
      approve_submission: {
        Args: { _notes: string; _submission_id: string }
        Returns: undefined
      }
      approve_withdrawal: {
        Args: { _id: string; _notes: string }
        Returns: undefined
      }
      cancel_application: { Args: { _id: string }; Returns: undefined }
      get_withdrawal_settings: {
        Args: never
        Returns: {
          fee_bps_per_unit: number
          min_withdrawal_cents: number
          paypal_instructions: string
          withdrawal_unit_cents: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_staff_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["staff_permission"]
          _uid: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      quote_withdrawal_fee: {
        Args: { _amount_cents: number }
        Returns: {
          fee_cents: number
          net_cents: number
          unit_cents: number
        }[]
      }
      reject_application: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      reject_submission: {
        Args: {
          _allow_resubmit: boolean
          _reason: string
          _submission_id: string
        }
        Returns: undefined
      }
      reject_withdrawal: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      request_withdrawal: {
        Args: {
          _amount_cents: number
          _destination: Json
          _method: Database["public"]["Enums"]["withdrawal_method"]
        }
        Returns: string
      }
      submit_task: {
        Args: {
          _attachments: Json
          _proof_text: string
          _proof_url: string
          _task_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "job_seeker"
        | "employer"
        | "admin"
        | "super_admin"
        | "staff"
        | "user"
        | "advertiser"
      application_status: "pending" | "approved" | "rejected" | "cancelled"
      notification_type:
        | "account_verified"
        | "task_approved"
        | "task_rejected"
        | "task_resubmit"
        | "withdrawal_approved"
        | "withdrawal_rejected"
        | "featured_task"
        | "system"
        | "announcement"
        | "application_approved"
        | "application_rejected"
        | "support_reply"
      report_status: "open" | "investigating" | "resolved" | "dismissed"
      staff_permission:
        | "review_submissions"
        | "review_reports"
        | "reply_tickets"
        | "view_users"
        | "view_tasks"
        | "view_withdrawals"
        | "approve_withdrawals"
        | "review_applications"
      submission_status: "pending" | "approved" | "rejected" | "resubmit"
      task_status: "draft" | "published" | "paused" | "archived"
      ticket_status: "open" | "pending" | "resolved" | "closed"
      tx_type: "earning" | "withdrawal" | "fee" | "adjustment" | "refund"
      withdrawal_method: "paypal" | "manual"
      withdrawal_status: "pending" | "approved" | "rejected" | "cancelled"
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
      app_role: [
        "job_seeker",
        "employer",
        "admin",
        "super_admin",
        "staff",
        "user",
        "advertiser",
      ],
      application_status: ["pending", "approved", "rejected", "cancelled"],
      notification_type: [
        "account_verified",
        "task_approved",
        "task_rejected",
        "task_resubmit",
        "withdrawal_approved",
        "withdrawal_rejected",
        "featured_task",
        "system",
        "announcement",
        "application_approved",
        "application_rejected",
        "support_reply",
      ],
      report_status: ["open", "investigating", "resolved", "dismissed"],
      staff_permission: [
        "review_submissions",
        "review_reports",
        "reply_tickets",
        "view_users",
        "view_tasks",
        "view_withdrawals",
        "approve_withdrawals",
        "review_applications",
      ],
      submission_status: ["pending", "approved", "rejected", "resubmit"],
      task_status: ["draft", "published", "paused", "archived"],
      ticket_status: ["open", "pending", "resolved", "closed"],
      tx_type: ["earning", "withdrawal", "fee", "adjustment", "refund"],
      withdrawal_method: ["paypal", "manual"],
      withdrawal_status: ["pending", "approved", "rejected", "cancelled"],
    },
  },
} as const
