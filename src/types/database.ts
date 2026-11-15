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
        }
        Insert: {
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
        }
        Update: {
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
