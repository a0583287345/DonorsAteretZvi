// =====================================================================
// נוצר אוטומטית ממסד הנתונים (Supabase generate_typescript_types).
// לא לערוך ידנית – לייצר מחדש אחרי כל שינוי סכמה.
// =====================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          table_name: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          id?: string
          table_name: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          table_name?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      donations: {
        Row: {
          external_source: string | null
          external_id: string | null
          installments: number | null
          category: string | null
          recurring_external_id: string | null
          imported_at: string | null
          amount: number
          created_at: string | null
          currency: string | null
          donation_date: string | null
          donor_id: string | null
          file_url: string | null
          id: string
          notes: string | null
          payment_method: string | null
          receipt_number: string | null
        }
        Insert: {
          external_source?: string | null
          external_id?: string | null
          installments?: number | null
          category?: string | null
          recurring_external_id?: string | null
          imported_at?: string | null
          amount: number
          created_at?: string | null
          currency?: string | null
          donation_date?: string | null
          donor_id?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_number?: string | null
        }
        Update: {
          external_source?: string | null
          external_id?: string | null
          installments?: number | null
          category?: string | null
          recurring_external_id?: string | null
          imported_at?: string | null
          amount?: number
          created_at?: string | null
          currency?: string | null
          donation_date?: string | null
          donor_id?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_yahrzeits: {
        Row: {
          created_at: string
          donor_id: string
          hebrew_day: number
          hebrew_month: number
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          donor_id: string
          hebrew_day: number
          hebrew_month: number
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          donor_id?: string
          hebrew_day?: number
          hebrew_month?: number
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          body: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          donor_id: string | null
          error: string | null
          id: string
          kind: string
          occurrence_date: string | null
          reminder_id: string | null
          send_on: string
          sent_at: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          body: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          donor_id?: string | null
          error?: string | null
          id?: string
          kind: string
          occurrence_date?: string | null
          reminder_id?: string | null
          send_on?: string
          sent_at?: string | null
          status: string
          subject: string
          to_email: string
        }
        Update: {
          body?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          donor_id?: string | null
          error?: string | null
          id?: string
          kind?: string
          occurrence_date?: string | null
          reminder_id?: string | null
          send_on?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      email_secrets: {
        Row: {
          gmail_app_password: string | null
          id: number
          updated_at: string
        }
        Insert: {
          gmail_app_password?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          gmail_app_password?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          enabled: boolean
          from_name: string
          gmail_user: string | null
          id: number
          manager_emails: string[]
          templates: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          from_name?: string
          gmail_user?: string | null
          id?: number
          manager_emails?: string[]
          templates?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          from_name?: string
          gmail_user?: string | null
          id?: number
          manager_emails?: string[]
          templates?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      donor_documents: {
        Row: {
          created_at: string | null
          donation_id: string | null
          donor_id: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          donation_id?: string | null
          donor_id?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          donation_id?: string | null
          donor_id?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "donor_documents_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donor_documents_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
        ]
      }
      donors: {
        Row: {
          zeout: string | null
          birthday: string | null
          city: string | null
          connected_contact: string | null
          country: string | null
          created_at: string | null
          email: string | null
          first_name_en: string | null
          first_name_he: string | null
          has_yissachar_zevulun: boolean | null
          house_number: string | null
          id: string
          is_recurring: boolean | null
          last_name_en: string | null
          last_name_he: string | null
          notes: string | null
          phone_1: string | null
          phone_2: string | null
          street: string | null
          yahrzeit_date: string | null
          yissachar_zevulun_name: string | null
          birthday_after_sunset: boolean
          yahrzeit_hebrew_day: number | null
          yahrzeit_hebrew_month: number | null
          yahrzeit_of: string | null
        }
        Insert: {
          zeout?: string | null
          birthday?: string | null
          city?: string | null
          connected_contact?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          first_name_en?: string | null
          first_name_he?: string | null
          has_yissachar_zevulun?: boolean | null
          house_number?: string | null
          id?: string
          is_recurring?: boolean | null
          last_name_en?: string | null
          last_name_he?: string | null
          notes?: string | null
          phone_1?: string | null
          phone_2?: string | null
          street?: string | null
          yahrzeit_date?: string | null
          yissachar_zevulun_name?: string | null
          birthday_after_sunset?: boolean
          yahrzeit_hebrew_day?: number | null
          yahrzeit_hebrew_month?: number | null
          yahrzeit_of?: string | null
        }
        Update: {
          zeout?: string | null
          birthday?: string | null
          city?: string | null
          connected_contact?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          first_name_en?: string | null
          first_name_he?: string | null
          has_yissachar_zevulun?: boolean | null
          house_number?: string | null
          id?: string
          is_recurring?: boolean | null
          last_name_en?: string | null
          last_name_he?: string | null
          notes?: string | null
          phone_1?: string | null
          phone_2?: string | null
          street?: string | null
          yahrzeit_date?: string | null
          yissachar_zevulun_name?: string | null
          birthday_after_sunset?: boolean
          yahrzeit_hebrew_day?: number | null
          yahrzeit_hebrew_month?: number | null
          yahrzeit_of?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          recurring_id: string | null
          attachments: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          donor_id: string | null
          email_sent: boolean | null
          file_url: string | null
          gregorian_date: string
          hebrew_date: string | null
          id: string
          is_completed: boolean | null
          is_recurring: boolean | null
          notify_email: boolean | null
          notify_time: string | null
          recurring_type: string | null
          title: string
          completed_through: string | null
          date_type: string
          donor_message_custom: string | null
          donor_message_type: string
          hebrew_day: number | null
          hebrew_month: number | null
          hebrew_year: number | null
          lead_days: number
          repeat_count: number | null
          repeat_end_type: string
          repeat_interval: number
          repeat_unit: string
          repeat_until: string | null
          snoozed_until: string | null
          source: string
          yahrzeit_id: string | null
        }
        Insert: {
          recurring_id?: string | null
          attachments?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          donor_id?: string | null
          email_sent?: boolean | null
          file_url?: string | null
          gregorian_date: string
          hebrew_date?: string | null
          id?: string
          is_completed?: boolean | null
          is_recurring?: boolean | null
          notify_email?: boolean | null
          notify_time?: string | null
          recurring_type?: string | null
          title: string
          completed_through?: string | null
          date_type?: string
          donor_message_custom?: string | null
          donor_message_type?: string
          hebrew_day?: number | null
          hebrew_month?: number | null
          hebrew_year?: number | null
          lead_days?: number
          repeat_count?: number | null
          repeat_end_type?: string
          repeat_interval?: number
          repeat_unit?: string
          repeat_until?: string | null
          snoozed_until?: string | null
          source?: string
          yahrzeit_id?: string | null
        }
        Update: {
          recurring_id?: string | null
          attachments?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          donor_id?: string | null
          email_sent?: boolean | null
          file_url?: string | null
          gregorian_date?: string
          hebrew_date?: string | null
          id?: string
          is_completed?: boolean | null
          is_recurring?: boolean | null
          notify_email?: boolean | null
          notify_time?: string | null
          recurring_type?: string | null
          title?: string
          completed_through?: string | null
          date_type?: string
          donor_message_custom?: string | null
          donor_message_type?: string
          hebrew_day?: number | null
          hebrew_month?: number | null
          hebrew_year?: number | null
          lead_days?: number
          repeat_count?: number | null
          repeat_end_type?: string
          repeat_interval?: number
          repeat_unit?: string
          repeat_until?: string | null
          snoozed_until?: string | null
          source?: string
          yahrzeit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_donations: {
        Row: {
          start_date: string | null
          amount: number
          charge_day: number | null
          created_at: string
          currency: string
          donor_id: string | null
          external_id: string | null
          external_source: string | null
          id: string
          last_synced_at: string | null
          months_remaining: number | null
          months_total: number | null
          next_charge_date: string | null
          notes: string | null
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          start_date?: string | null
          amount?: number
          charge_day?: number | null
          created_at?: string
          currency?: string
          donor_id?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          last_synced_at?: string | null
          months_remaining?: number | null
          months_total?: number | null
          next_charge_date?: string | null
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          start_date?: string | null
          amount?: number
          charge_day?: number | null
          created_at?: string
          currency?: string
          donor_id?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          last_synced_at?: string | null
          months_remaining?: number | null
          months_total?: number | null
          next_charge_date?: string | null
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_review: {
        Row: {
          candidate_donor_ids: string[]
          created_at: string
          external_id: string | null
          id: string
          incoming_donor: Json
          incoming_payload: Json | null
          payload_kind: string | null
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_donor_id: string | null
          source: string
          status: string
        }
        Insert: {
          candidate_donor_ids?: string[]
          created_at?: string
          external_id?: string | null
          id?: string
          incoming_donor: Json
          incoming_payload?: Json | null
          payload_kind?: string | null
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_donor_id?: string | null
          source?: string
          status?: string
        }
        Update: {
          candidate_donor_ids?: string[]
          created_at?: string
          external_id?: string | null
          id?: string
          incoming_donor?: Json
          incoming_payload?: Json | null
          payload_kind?: string | null
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_donor_id?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      donor_duplicate_dismissals: {
        Row: {
          created_at: string
          created_by: string | null
          donor_a: string
          donor_b: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          donor_a: string
          donor_b: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          donor_a?: string
          donor_b?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          import_from: string | null
          enabled: boolean
          last_history_id: string | null
          last_sync_at: string | null
          last_sync_result: Json | null
          mosad_id: string | null
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          import_from?: string | null
          enabled?: boolean
          last_history_id?: string | null
          last_sync_at?: string | null
          last_sync_result?: Json | null
          mosad_id?: string | null
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          import_from?: string | null
          enabled?: boolean
          last_history_id?: string | null
          last_sync_at?: string | null
          last_sync_result?: Json | null
          mosad_id?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      integration_secrets: {
        Row: {
          webhook_secret: string | null
          api_password: string | null
          callback_key: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          webhook_secret?: string | null
          api_password?: string | null
          callback_key?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          webhook_secret?: string | null
          api_password?: string | null
          callback_key?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string | null
          denied_display: Json
          id: string
          name: string
          permissions: Json
        }
        Insert: {
          created_at?: string | null
          denied_display?: Json
          id?: string
          name: string
          permissions?: Json
        }
        Update: {
          created_at?: string | null
          denied_display?: Json
          id?: string
          name?: string
          permissions?: Json
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: { Args: { p: string }; Returns: boolean }
      recurring_last_charge: {
        Args: { p_start: string | null; p_total: number | null; p_next: string | null; p_remaining: number | null }
        Returns: string | null
      }
      merge_donors: { Args: { p_keep: string; p_remove: string }; Returns: undefined }
      my_role_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicTables = Database["public"]["Tables"]

/** שורה מטבלה: Tables<'donors'> */
export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"]
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]["Insert"]
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]["Update"]
