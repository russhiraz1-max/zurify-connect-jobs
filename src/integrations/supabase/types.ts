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
          referral_allowed_chars: string
          referral_code_length: number
          referral_commission_bps: number
          referral_default_max_uses: number | null
          referral_enabled: boolean
          referral_min_withdrawal_cents: number
          referral_unlimited_uses: boolean
          referral_welcome_bonus_cents: number
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
          referral_allowed_chars?: string
          referral_code_length?: number
          referral_commission_bps?: number
          referral_default_max_uses?: number | null
          referral_enabled?: boolean
          referral_min_withdrawal_cents?: number
          referral_unlimited_uses?: boolean
          referral_welcome_bonus_cents?: number
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
          referral_allowed_chars?: string
          referral_code_length?: number
          referral_commission_bps?: number
          referral_default_max_uses?: number | null
          referral_enabled?: boolean
          referral_min_withdrawal_cents?: number
          referral_unlimited_uses?: boolean
          referral_welcome_bonus_cents?: number
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
      badges: {
        Row: {
          active: boolean
          created_at: string
          description: string
          icon: string
          id: string
          metric: string
          name: string
          reward_cents: number
          slug: string
          sort_order: number
          threshold: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          icon?: string
          id?: string
          metric?: string
          name: string
          reward_cents?: number
          slug: string
          sort_order?: number
          threshold?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          icon?: string
          id?: string
          metric?: string
          name?: string
          reward_cents?: number
          slug?: string
          sort_order?: number
          threshold?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      challenge_claims: {
        Row: {
          challenge_id: string
          created_at: string
          id: string
          reward_cents: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          id?: string
          reward_cents: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          id?: string
          reward_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_claims_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string
          ends_at: string
          id: string
          metric: string
          min_approved_jobs: number
          name: string
          require_kyc: boolean
          reward_cents: number
          starts_at: string
          target: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          id?: string
          metric?: string
          min_approved_jobs?: number
          name: string
          require_kyc?: boolean
          reward_cents?: number
          starts_at?: string
          target?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          id?: string
          metric?: string
          min_approved_jobs?: number
          name?: string
          require_kyc?: boolean
          reward_cents?: number
          starts_at?: string
          target?: number
          updated_at?: string
        }
        Relationships: []
      }
      engagement_settings: {
        Row: {
          badges_enabled: boolean
          challenges_enabled: boolean
          challenges_require_kyc: boolean
          created_at: string
          id: string
          lucky_cooldown_days: number
          lucky_duration_minutes: number
          lucky_enabled: boolean
          lucky_max_winners: number
          lucky_min_approved_jobs: number
          lucky_open_time: string
          lucky_require_kyc: boolean
          lucky_reward_cents: number
          mystery_enabled: boolean
          mystery_frequency_days: number
          mystery_min_approved_jobs: number
          mystery_outcomes: Json
          mystery_require_kyc: boolean
          pro_benefits: string[]
          pro_duration_days: number
          pro_enabled: boolean
          pro_faq: string
          pro_payment_instructions: string
          pro_price_cents: number
          rep_star_thresholds: Json
          rep_star1_label: string
          rep_w_account_age: number
          rep_w_approval_rate: number
          rep_w_approved_jobs: number
          rep_w_clean_record: number
          rep_w_completed_jobs: number
          rep_w_kyc: number
          rep_w_recent_activity: number
          rep_w_withdrawals: number
          singleton: boolean
          streak_after_30: string
          streak_enabled: boolean
          streak_grace_days: number
          streak_max_reward_cents: number
          streak_stage1_rewards: number[]
          streak_stage2_required_jobs: number
          streak_stage2_rewards: number[]
          streak_stage3_required_jobs: number
          streak_stage3_rewards: number[]
          updated_at: string
        }
        Insert: {
          badges_enabled?: boolean
          challenges_enabled?: boolean
          challenges_require_kyc?: boolean
          created_at?: string
          id?: string
          lucky_cooldown_days?: number
          lucky_duration_minutes?: number
          lucky_enabled?: boolean
          lucky_max_winners?: number
          lucky_min_approved_jobs?: number
          lucky_open_time?: string
          lucky_require_kyc?: boolean
          lucky_reward_cents?: number
          mystery_enabled?: boolean
          mystery_frequency_days?: number
          mystery_min_approved_jobs?: number
          mystery_outcomes?: Json
          mystery_require_kyc?: boolean
          pro_benefits?: string[]
          pro_duration_days?: number
          pro_enabled?: boolean
          pro_faq?: string
          pro_payment_instructions?: string
          pro_price_cents?: number
          rep_star_thresholds?: Json
          rep_star1_label?: string
          rep_w_account_age?: number
          rep_w_approval_rate?: number
          rep_w_approved_jobs?: number
          rep_w_clean_record?: number
          rep_w_completed_jobs?: number
          rep_w_kyc?: number
          rep_w_recent_activity?: number
          rep_w_withdrawals?: number
          singleton?: boolean
          streak_after_30?: string
          streak_enabled?: boolean
          streak_grace_days?: number
          streak_max_reward_cents?: number
          streak_stage1_rewards?: number[]
          streak_stage2_required_jobs?: number
          streak_stage2_rewards?: number[]
          streak_stage3_required_jobs?: number
          streak_stage3_rewards?: number[]
          updated_at?: string
        }
        Update: {
          badges_enabled?: boolean
          challenges_enabled?: boolean
          challenges_require_kyc?: boolean
          created_at?: string
          id?: string
          lucky_cooldown_days?: number
          lucky_duration_minutes?: number
          lucky_enabled?: boolean
          lucky_max_winners?: number
          lucky_min_approved_jobs?: number
          lucky_open_time?: string
          lucky_require_kyc?: boolean
          lucky_reward_cents?: number
          mystery_enabled?: boolean
          mystery_frequency_days?: number
          mystery_min_approved_jobs?: number
          mystery_outcomes?: Json
          mystery_require_kyc?: boolean
          pro_benefits?: string[]
          pro_duration_days?: number
          pro_enabled?: boolean
          pro_faq?: string
          pro_payment_instructions?: string
          pro_price_cents?: number
          rep_star_thresholds?: Json
          rep_star1_label?: string
          rep_w_account_age?: number
          rep_w_approval_rate?: number
          rep_w_approved_jobs?: number
          rep_w_clean_record?: number
          rep_w_completed_jobs?: number
          rep_w_kyc?: number
          rep_w_recent_activity?: number
          rep_w_withdrawals?: number
          singleton?: boolean
          streak_after_30?: string
          streak_enabled?: boolean
          streak_grace_days?: number
          streak_max_reward_cents?: number
          streak_stage1_rewards?: number[]
          streak_stage2_required_jobs?: number
          streak_stage2_rewards?: number[]
          streak_stage3_required_jobs?: number
          streak_stage3_rewards?: number[]
          updated_at?: string
        }
        Relationships: []
      }
      kyc_verifications: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          id_back_path: string
          id_front_path: string
          paypal_email: string
          phone: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          selfie_path: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          id_back_path: string
          id_front_path: string
          paypal_email: string
          phone: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          selfie_path: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          id_back_path?: string
          id_front_path?: string
          paypal_email?: string
          phone?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          selfie_path?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lucky_claims: {
        Row: {
          amount_cents: number
          claim_date: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          claim_date?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          claim_date?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      mystery_claims: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          outcome_label: string
          period_key: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          id?: string
          outcome_label: string
          period_key: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          outcome_label?: string
          period_key?: string
          user_id?: string
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
      platform_events: {
        Row: {
          accent: string
          banner_text: string | null
          created_at: string
          created_by: string | null
          description: string
          ends_at: string
          id: string
          name: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          accent?: string
          banner_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          id?: string
          name: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          accent?: string
          banner_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          id?: string
          name?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pro_requests: {
        Row: {
          activated_at: string | null
          admin_notes: string | null
          created_at: string
          duration_days: number
          expires_at: string | null
          id: string
          note: string | null
          payment_reference: string | null
          price_cents: number
          reviewer_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          admin_notes?: string | null
          created_at?: string
          duration_days?: number
          expires_at?: string | null
          id?: string
          note?: string | null
          payment_reference?: string | null
          price_cents?: number
          reviewer_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          admin_notes?: string | null
          created_at?: string
          duration_days?: number
          expires_at?: string | null
          id?: string
          note?: string | null
          payment_reference?: string | null
          price_cents?: number
          reviewer_id?: string | null
          status?: string
          updated_at?: string
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
          suspended: boolean
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
          website: string | null
          withdrawal_hold: boolean
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id: string
          location?: string | null
          suspended?: boolean
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          website?: string | null
          withdrawal_hold?: boolean
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          location?: string | null
          suspended?: boolean
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          website?: string | null
          withdrawal_hold?: boolean
        }
        Relationships: []
      }
      referral_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          eligibility: string
          ends_at: string
          id: string
          name: string
          prize: string
          starts_at: string
          status: string
          updated_at: string
          winner_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: string
          ends_at: string
          id?: string
          name: string
          prize: string
          starts_at: string
          status?: string
          updated_at?: string
          winner_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: string
          ends_at?: string
          id?: string
          name?: string
          prize?: string
          starts_at?: string
          status?: string
          updated_at?: string
          winner_count?: number
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          campaign_name: string | null
          code: string
          commission_bps: number | null
          commission_duration_days: number | null
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          leaderboard_eligible: boolean
          max_uses: number | null
          min_withdrawal_cents: number | null
          notes: string | null
          owner_user_id: string
          status: string
          total_uses: number
          updated_at: string
          welcome_bonus_cents: number | null
        }
        Insert: {
          campaign_name?: string | null
          code: string
          commission_bps?: number | null
          commission_duration_days?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          leaderboard_eligible?: boolean
          max_uses?: number | null
          min_withdrawal_cents?: number | null
          notes?: string | null
          owner_user_id: string
          status?: string
          total_uses?: number
          updated_at?: string
          welcome_bonus_cents?: number | null
        }
        Update: {
          campaign_name?: string | null
          code?: string
          commission_bps?: number | null
          commission_duration_days?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          leaderboard_eligible?: boolean
          max_uses?: number | null
          min_withdrawal_cents?: number | null
          notes?: string | null
          owner_user_id?: string
          status?: string
          total_uses?: number
          updated_at?: string
          welcome_bonus_cents?: number | null
        }
        Relationships: []
      }
      referral_uses: {
        Row: {
          applied_at: string
          bonus_amount_cents: number
          bonus_awarded_at: string | null
          code: string
          code_id: string
          commission_expires_at: string | null
          id: string
          owner_user_id: string
          referred_user_id: string
          total_commission_cents: number
        }
        Insert: {
          applied_at?: string
          bonus_amount_cents?: number
          bonus_awarded_at?: string | null
          code: string
          code_id: string
          commission_expires_at?: string | null
          id?: string
          owner_user_id: string
          referred_user_id: string
          total_commission_cents?: number
        }
        Update: {
          applied_at?: string
          bonus_amount_cents?: number
          bonus_awarded_at?: string | null
          code?: string
          code_id?: string
          commission_expires_at?: string | null
          id?: string
          owner_user_id?: string
          referred_user_id?: string
          total_commission_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_uses_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
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
      streak_claims: {
        Row: {
          amount_cents: number
          claim_date: string
          created_at: string
          day_number: number
          id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          claim_date?: string
          created_at?: string
          day_number: number
          id?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          claim_date?: string
          created_at?: string
          day_number?: number
          id?: string
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
          cover_letter: string | null
          created_at: string
          cv_path: string | null
          experience: string | null
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
          cover_letter?: string | null
          created_at?: string
          cv_path?: string | null
          experience?: string | null
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
          cover_letter?: string | null
          created_at?: string
          cv_path?: string | null
          experience?: string | null
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
          active: boolean
          color: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string | null
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
          difficulty: Database["public"]["Enums"]["job_difficulty"]
          ends_at: string | null
          est_minutes: number | null
          experience_level: Database["public"]["Enums"]["experience_level"]
          featured: boolean
          id: string
          instructions: string
          is_recommended: boolean
          is_remote: boolean
          is_urgent: boolean
          job_type: Database["public"]["Enums"]["job_type"]
          max_applications: number | null
          max_per_user: number
          max_total: number | null
          priority: number
          proof_requirements: string | null
          requires_application: boolean
          reward_cents: number
          skills: string[]
          starts_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[]
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          allow_reapplication?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          difficulty?: Database["public"]["Enums"]["job_difficulty"]
          ends_at?: string | null
          est_minutes?: number | null
          experience_level?: Database["public"]["Enums"]["experience_level"]
          featured?: boolean
          id?: string
          instructions: string
          is_recommended?: boolean
          is_remote?: boolean
          is_urgent?: boolean
          job_type?: Database["public"]["Enums"]["job_type"]
          max_applications?: number | null
          max_per_user?: number
          max_total?: number | null
          priority?: number
          proof_requirements?: string | null
          requires_application?: boolean
          reward_cents: number
          skills?: string[]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          allow_reapplication?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          difficulty?: Database["public"]["Enums"]["job_difficulty"]
          ends_at?: string | null
          est_minutes?: number | null
          experience_level?: Database["public"]["Enums"]["experience_level"]
          featured?: boolean
          id?: string
          instructions?: string
          is_recommended?: boolean
          is_remote?: boolean
          is_urgent?: boolean
          job_type?: Database["public"]["Enums"]["job_type"]
          max_applications?: number | null
          max_per_user?: number
          max_total?: number | null
          priority?: number
          proof_requirements?: string | null
          requires_application?: boolean
          reward_cents?: number
          skills?: string[]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          views_count?: number
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
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
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
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          last_claim_date: string | null
          longest_streak: number
          total_claimed_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_claim_date?: string | null
          longest_streak?: number
          total_claimed_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_claim_date?: string | null
          longest_streak?: number
          total_claimed_cents?: number
          updated_at?: string
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
          pending_withdrawal_cents: number
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
          pending_withdrawal_cents?: number
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
          pending_withdrawal_cents?: number
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
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_analytics_overview: { Args: never; Returns: Json }
      admin_analytics_series: {
        Args: { _days?: number }
        Returns: {
          day: string
          expenses_cents: number
          payout_cents: number
          profit_cents: number
          referrals: number
          revenue_cents: number
          signups: number
          tasks_completed: number
          withdrawals: number
        }[]
      }
      admin_approve_kyc: {
        Args: { _id: string; _notes?: string }
        Returns: undefined
      }
      admin_assign_referral_code: {
        Args: { _id: string; _new_owner_user_id: string }
        Returns: undefined
      }
      admin_create_referral_code: {
        Args: {
          _campaign_name?: string
          _code: string
          _commission_bps?: number
          _commission_duration_days?: number
          _description?: string
          _expires_at?: string
          _leaderboard_eligible?: boolean
          _max_uses: number
          _min_withdrawal_cents?: number
          _notes?: string
          _owner_user_id: string
          _welcome_bonus_cents?: number
        }
        Returns: string
      }
      admin_delete_referral_code: { Args: { _id: string }; Returns: undefined }
      admin_kyc_detail: { Args: { _id: string }; Returns: Json }
      admin_list_kyc: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          paypal_email: string
          pending_withdrawals: number
          phone: string
          reviewed_at: string
          status: string
          suspended: boolean
          user_id: string
          withdrawal_hold: boolean
        }[]
      }
      admin_list_pro_requests: {
        Args: never
        Returns: {
          activated_at: string
          admin_notes: string
          created_at: string
          duration_days: number
          email: string
          expires_at: string
          full_name: string
          id: string
          note: string
          payment_reference: string
          price_cents: number
          status: string
          user_id: string
        }[]
      }
      admin_list_referral_codes: {
        Args: never
        Returns: {
          awarded_bonus_users: number
          campaign_name: string
          code: string
          commission_bps: number
          commission_duration_days: number
          created_at: string
          description: string
          expires_at: string
          id: string
          leaderboard_eligible: boolean
          max_uses: number
          min_withdrawal_cents: number
          notes: string
          owner_email: string
          owner_full_name: string
          owner_user_id: string
          pending_bonus_users: number
          status: string
          total_bonus_cents: number
          total_commission_cents: number
          total_uses: number
          users_referred: number
          welcome_bonus_cents: number
        }[]
      }
      admin_list_staff: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_super_admin: boolean
          last_sign_in_at: string
          permissions: string[]
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          applications_count: number
          approved_tasks: number
          available_cents: number
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          lifetime_earned_cents: number
          lifetime_withdrawn_cents: number
          pending_tasks: number
          pending_withdrawal_cents: number
          roles: string[]
          suspended: boolean
          withdrawal_hold: boolean
          withdrawals_count: number
        }[]
      }
      admin_promote_staff: { Args: { _user_id: string }; Returns: undefined }
      admin_publish_announcement: {
        Args: { _audience?: string; _body: string; _title: string }
        Returns: string
      }
      admin_referral_details: {
        Args: { _id: string }
        Returns: {
          applied_at: string
          approved_tasks: number
          bonus_amount_cents: number
          bonus_awarded_at: string
          email: string
          full_name: string
          lifetime_withdrawn_cents: number
          referred_user_id: string
          total_commission_cents: number
          wallet_available_cents: number
        }[]
      }
      admin_reject_kyc: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      admin_remove_staff: { Args: { _user_id: string }; Returns: undefined }
      admin_search_users_for_referral: {
        Args: { _q: string }
        Returns: {
          email: string
          full_name: string
          has_code: boolean
          id: string
        }[]
      }
      admin_set_pro_status: {
        Args: { _id: string; _notes?: string; _status: string }
        Returns: undefined
      }
      admin_set_referral_status: {
        Args: { _id: string; _status: string }
        Returns: undefined
      }
      admin_set_suspended: {
        Args: { _reason?: string; _suspended: boolean; _user_id: string }
        Returns: undefined
      }
      admin_set_withdrawal_hold: {
        Args: { _hold: boolean; _user_id: string }
        Returns: undefined
      }
      admin_update_referral_code: {
        Args: {
          _campaign_name?: string
          _code: string
          _commission_bps?: number
          _commission_duration_days?: number
          _description?: string
          _expires_at?: string
          _id: string
          _leaderboard_eligible?: boolean
          _max_uses: number
          _min_withdrawal_cents?: number
          _notes?: string
          _welcome_bonus_cents?: number
        }
        Returns: undefined
      }
      apply_referral_code: { Args: { _code: string }; Returns: string }
      apply_to_task: {
        Args: {
          _cover_letter?: string
          _cv_path?: string
          _experience?: string
          _note?: string
          _task_id: string
        }
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
      challenge_progress: {
        Args: {
          _c: Database["public"]["Tables"]["challenges"]["Row"]
          _user_id: string
        }
        Returns: number
      }
      claim_challenge: { Args: { _id: string }; Returns: Json }
      claim_daily_streak: { Args: never; Returns: Json }
      claim_lucky_reward: { Args: never; Returns: Json }
      credit_engagement_reward: {
        Args: {
          _cents: number
          _memo: string
          _ref_id: string
          _ref_type: string
          _user_id: string
        }
        Returns: undefined
      }
      get_job_categories: {
        Args: never
        Returns: {
          color: string
          description: string
          icon: string
          id: string
          job_count: number
          name: string
          slug: string
          sort_order: number
        }[]
      }
      get_my_account_status: {
        Args: never
        Returns: {
          suspended: boolean
          suspended_at: string
          suspension_reason: string
          withdrawal_hold: boolean
        }[]
      }
      get_my_engagement: { Args: never; Returns: Json }
      get_my_kyc: {
        Args: never
        Returns: {
          created_at: string
          id: string
          paypal_email: string
          phone: string
          rejection_reason: string
          reviewed_at: string
          status: string
        }[]
      }
      get_my_referral_code: {
        Args: never
        Returns: {
          awarded_bonus_users: number
          campaign_name: string
          code: string
          commission_bps: number
          commission_duration_days: number
          commission_last_30_cents: number
          description: string
          expires_at: string
          id: string
          leaderboard_eligible: boolean
          leaderboard_rank: number
          max_uses: number
          next_commission_expiry: string
          pending_bonus_users: number
          status: string
          total_bonus_cents: number
          total_commission_cents: number
          total_uses: number
          total_withdrawn_by_referred_cents: number
          users_referred: number
          welcome_bonus_cents: number
        }[]
      }
      get_my_referral_status: {
        Args: never
        Returns: {
          applied: boolean
          applied_at: string
          bonus_amount_cents: number
          bonus_awarded_at: string
          code: string
        }[]
      }
      get_my_referral_timeline: {
        Args: { _limit?: number }
        Returns: {
          actor_name: string
          amount_cents: number
          event_at: string
          kind: string
          memo: string
        }[]
      }
      get_my_referred_users: {
        Args: never
        Returns: {
          applied_at: string
          approved_tasks: number
          bonus_amount_cents: number
          bonus_awarded_at: string
          full_name: string
          lifetime_withdrawn_cents: number
          referred_user_id: string
          total_commission_cents: number
          wallet_available_cents: number
        }[]
      }
      get_referral_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          badge: string
          commission_earned_cents: number
          display_name: string
          month_referrals: number
          owner_user_id: string
          rank: number
          successful_referrals: number
          week_referrals: number
        }[]
      }
      get_user_reputation: { Args: { _user_id: string }; Returns: Json }
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
      is_suspended: { Args: { _uid: string }; Returns: boolean }
      open_mystery_box: { Args: never; Returns: Json }
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
      reject_withdrawal:
        | { Args: { _id: string; _reason: string }; Returns: undefined }
        | {
            Args: {
              _id: string
              _reason: string
              _suspend_withdrawals?: boolean
            }
            Returns: undefined
          }
      request_pro: {
        Args: { _note: string; _payment_reference: string }
        Returns: string
      }
      request_withdrawal: {
        Args: {
          _amount_cents: number
          _destination: Json
          _method: Database["public"]["Enums"]["withdrawal_method"]
        }
        Returns: string
      }
      submit_kyc: {
        Args: {
          _id_back: string
          _id_front: string
          _paypal_email: string
          _phone: string
          _selfie: string
        }
        Returns: string
      }
      submit_task: {
        Args: {
          _attachments?: Json
          _proof_text?: string
          _proof_url?: string
          _task_id: string
        }
        Returns: string
      }
      sync_my_badges: { Args: never; Returns: number }
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
      experience_level: "entry" | "intermediate" | "expert"
      job_difficulty: "easy" | "medium" | "hard"
      job_type:
        | "micro_task"
        | "freelance_project"
        | "gig"
        | "remote_job"
        | "service_request"
        | "contest"
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
        | "application_received"
        | "submission_received"
        | "withdrawal_requested"
        | "withdrawal_hold_enabled"
        | "withdrawal_hold_removed"
        | "reward_credited"
        | "referral_applied"
        | "referral_bonus_pending"
        | "referral_bonus_awarded"
        | "referral_commission_earned"
        | "referral_disabled"
        | "referral_enabled"
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
      tx_type:
        | "earning"
        | "withdrawal"
        | "fee"
        | "adjustment"
        | "refund"
        | "referral_bonus"
        | "referral_commission"
        | "manual_credit"
        | "manual_debit"
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
      experience_level: ["entry", "intermediate", "expert"],
      job_difficulty: ["easy", "medium", "hard"],
      job_type: [
        "micro_task",
        "freelance_project",
        "gig",
        "remote_job",
        "service_request",
        "contest",
      ],
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
        "application_received",
        "submission_received",
        "withdrawal_requested",
        "withdrawal_hold_enabled",
        "withdrawal_hold_removed",
        "reward_credited",
        "referral_applied",
        "referral_bonus_pending",
        "referral_bonus_awarded",
        "referral_commission_earned",
        "referral_disabled",
        "referral_enabled",
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
      tx_type: [
        "earning",
        "withdrawal",
        "fee",
        "adjustment",
        "refund",
        "referral_bonus",
        "referral_commission",
        "manual_credit",
        "manual_debit",
      ],
      withdrawal_method: ["paypal", "manual"],
      withdrawal_status: ["pending", "approved", "rejected", "cancelled"],
    },
  },
} as const
